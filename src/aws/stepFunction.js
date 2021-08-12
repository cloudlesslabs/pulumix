const aws = require('@pulumi/aws')
const { resolve } = require('./utils')

const VALID_CLOUDWATCH_LEVELS = ['ALL', 'ERROR', 'FATAL']

/**
 * Creates a step function. 
 * Resources:
 * 	1. IAM role
 * 	2. (Optional) IAM policy to access CloudWatch is 'cloudWatchLevel' is set.
 * 	3. (Optional) CloudWatch Log Group is 'cloudWatchLevel' is set.
 * 	4. Step function.
 * 
 * @param  {String} 		   name						
 * @param  {String} 		   description		
 * @param  {String} 		   type									Valid values: 'standard' (default) or 'express'
 * @param  {String}  		   states[].name
 * @param  {Output<String>}    states[].activityArn
 * @param  {String}  		   states[].choices[]
 * @param  {[State]} 		   states[].parallel.states[]			e.g., [{ name:'task_1' },[{ name:'task_2A', next:'task_2B' },{ name:'task_2b' }]]
 * @param  {String}  		   states[].parallel.resultPath
 * @param  {String}  		   states[].parallel.resultSelector
 * @param  {Object}  		   states[].parallel.retry
 * @param  {Object}  		   states[].parallel.catch
 * @param  {String}  		   states[].map.states[]
 * @param  {String}  		   states[].map.inputPath
 * @param  {String}  		   states[].map.itemsPath
 * @param  {Number}  		   states[].map.maxConcurrency
 * @param  {String}  		   states[].map.resultPath
 * @param  {String}  		   states[].map.resultSelector
 * @param  {Object}  		   states[].map.retry
 * @param  {Object}  		   states[].map.catch
 * @param  {String}  		   states[].wait
 * @param  {String}  		   states[].waitSecondsPath
 * @param  {String}  		   states[].waitTimestampPath
 * @param  {String}  		   states[].next						
 * @param  {Boolean}  		   states[].end						
 * @param  {String}  		   states[].default						Only applied when 'choices' is set.
 * @param  {Boolean} 		   states[].succeed						If set to true, the type is 'success'
 * @param  {String}  		   states[].error.name
 * @param  {String}  		   states[].error.cause					
 * @param  {[Output<Policy>]}  policies						
 * @param  {String} 		   cloudWatchLevel						Default is 'OFF'. Valid values: 'ALL', 'ERROR', 'FATAL'
 * @param  {Number}			   logsRetentionInDays					Default 0 (i.e., never expires). Only applies when 'cloudWatch' is true.
 * @param  {Object} 		   tags	
 * 					
 * @return {String}						
 */
const createStepFunction = async ({ name, description, type, states, policies, cloudWatchLevel, logsRetentionInDays, tags }) => {
	
	if (!name)
		throw new Error('Missing required argument \'name\'.')
	if (!states)
		throw new Error('Missing required argument \'states\'.')
	if (!states.length)
		throw new Error('\'states\' argument cannot be empty.')
	
	cloudWatchLevel = (cloudWatchLevel || 'OFF').trim().toUpperCase()
	const cloudWatch = VALID_CLOUDWATCH_LEVELS.indexOf(cloudWatchLevel) >= 0
	tags = tags || {}
	policies = policies || []
	const dependsOn = []

	
	const canonicalName = `${name}-step-function`
	const { lambda, resolvedStates } = await resolveActivitiesArns(states)

	// IAM role. Doc: https://www.pulumi.com/docs/reference/pkg/aws/iam/role/
	const stepFuncRole = new aws.iam.Role(canonicalName, {
		assumeRolePolicy: {
			Version: '2012-10-17',
			Statement: [{
				Action: 'sts:AssumeRole',
				Principal: {
					Service: 'states.amazonaws.com',
				},
				Effect: 'Allow',
				Sid: ''
			}],
		},
		tags: {
			...tags,
			Name: canonicalName
		}
	})

	// Configure CloudWatch
	let loggingConfiguration
	let logGroup = null
	if (cloudWatch) {
		// IAM: Allow step-function to log to CloudWatch. Doc: https://docs.aws.amazon.com/step-functions/latest/dg/cw-logs.html#cloudwatch-iam-policy
		policies.push(new aws.iam.Policy(`${canonicalName}-cloudwatch`, {
			path: '/',
			description: `IAM policy to allow Step Function ${name} to send logs to CloudWatch.`,
			policy: JSON.stringify({
				Version: '2012-10-17',
				Statement: [
					{
						Effect: 'Allow',
						Action: [
							'logs:CreateLogDelivery',
							'logs:GetLogDelivery',
							'logs:UpdateLogDelivery',
							'logs:DeleteLogDelivery',
							'logs:ListLogDeliveries',
							'logs:PutResourcePolicy',
							'logs:DescribeResourcePolicies',
							'logs:DescribeLogGroups'
						],
						Resource: '*'
					}
				]
			})
		}))

		// LogGroup. Doc: https://www.pulumi.com/docs/reference/pkg/aws/cloudwatch/loggroup/
		logGroup = new aws.cloudwatch.LogGroup(canonicalName, { 
			retentionInDays: logsRetentionInDays || 0,
			tags 
		})
		loggingConfiguration = {
			logDestination: logGroup.arn.apply(arn => `${arn}:*`),
			includeExecutionData: true,
			level: cloudWatchLevel
		}
	}

	if (lambda)
		// Allow the step function to invoke lambdas
		policies.push({ name:`${canonicalName}-lambda`, arn:'arn:aws:iam::aws:policy/service-role/AWSLambdaRole' })

	// Attach policies
	for (let i=0;i<policies.length;i++) {
		const policy = policies[i]
		if (!policy.name)
			throw new Error(`Invalid argument exception. Some policies in step-function ${name} don't have a name.`)	
		if (!policy.arn)
			throw new Error(`Invalid argument exception. Some policies in step-function ${name} don't have an arn.`)	
		
		const policyName = await resolve(policy.name)
		dependsOn.push(new aws.iam.RolePolicyAttachment(policyName, {
			role: stepFuncRole.name,
			policyArn: policy.arn
		}))
	}

	// Step function. Doc: https://www.pulumi.com/docs/reference/pkg/aws/sfn/statemachine/
	const awsStates = formatStates(resolvedStates)
	const stepFunction = new aws.sfn.StateMachine(name, {
		roleArn: stepFuncRole.arn,
		type: (type||'').trim().toLowerCase() == 'express' ? 'EXPRESS' : 'STANDARD',
		definition: JSON.stringify({
			Comment: description,
			StartAt: resolvedStates[0].name,
			States: awsStates
		}, null, '	'),
		loggingConfiguration,
		dependsOn,
		tags: {
			...tags,
			Name: name
		}
	})

	return {
		stepFunction,
		logGroup
	}
}

const arnIsLambda = arn => /^arn:aws:lambda:/.test((arn||'').trim().toLowerCase())

/**
 * Resolves the states[].activityArn
 * 
 * @param  {String}			states[].name
 * @param  {Output<String>}	states[].activityArn
 * @param  {[State]}		states[].parallel.states[]				e.g., [{ name:'task_1' },[{ name:'task_2A', next:'task_2B' },{ name:'task_2b' }] ]
 * @param  {[State]}		states[].map.states[]					e.g., [{ name:'task_1' },[{ name:'task_2A', next:'task_2B' },{ name:'task_2b' }] ]
 * 
 * @return {Boolean}		output.lambda							True indicates that at least one of the state uses a lambda.
 * @return {String}			output.resolvedStates[].name						
 * @return {String}			output.resolvedStates[].activityArn						
 * @return {Object}			output.resolvedStates[].parallel
 * @return {Object}			output.resolvedStates[].map					
 */
const resolveActivitiesArns = async states => {
	const resolvedStates = []
	const l = (states||[]).length
	if (!l)
		return {
			lambda:false,
			resolvedStates
		}

	let atLeastOneActivityIsALambda = false
	for (let i=0;i<l;i++) {
		const state = states[i]||{}
		const { name, activityArn, parallel, map } = state
		if (!name)
			continue

		if (!activityArn) {
			const [nestedCollection, collectionLabel] = parallel && parallel.states 
				? [parallel.states, 'parallel'] 
				: map && map.states ? [map.states, 'map'] : [null, null]
			if (nestedCollection) {
				const resolvedParallelTasks = []
				for (let j=0;j<nestedCollection.length;j++) {
					const task = nestedCollection[i]
					const parallelTasks = Array.isArray(task) ? task : [task]
					const { lambda, resolvedStates:resolvedTasks } = await resolveActivitiesArns(parallelTasks)
					resolvedParallelTasks.push(resolvedTasks)
					if (!atLeastOneActivityIsALambda)
						atLeastOneActivityIsALambda = lambda
				}
				resolvedStates.push({...state, [collectionLabel]:resolvedParallelTasks })	
			} else
				resolvedStates.push(state)
		} else if (typeof(activityArn) == 'string') {
			if (!atLeastOneActivityIsALambda)
				atLeastOneActivityIsALambda = arnIsLambda(activityArn)
			resolvedStates.push({...state, activityArn })
		} else if (activityArn.apply) {
			const arn = await resolve(activityArn)
			if (arn && typeof(arn) == 'string') {
				if (!atLeastOneActivityIsALambda)
					atLeastOneActivityIsALambda = arnIsLambda(arn)
				resolvedStates.push({...state, activityArn:arn })
			}
		} 
	}

	return {
		lambda: atLeastOneActivityIsALambda,
		resolvedStates
	}
}

/**
 * Format states using the AWS standard. 
 * 
 * @param  {String}  states[].name
 * @param  {String}  states[].activityArn
 * @param  {String}  states[].choices[]
 * @param  {[State]} states[].parallel.states[]			e.g., [{ name:'task_1' },[{ name:'task_2A', next:'task_2B' },{ name:'task_2b' }]]
 * @param  {String}  states[].parallel.resultPath
 * @param  {String}  states[].parallel.resultSelector
 * @param  {Object}  states[].parallel.retry
 * @param  {Object}  states[].parallel.catch
 * @param  {String}  states[].map.states[]
 * @param  {String}  states[].map.inputPath
 * @param  {String}  states[].map.itemsPath
 * @param  {Number}  states[].map.maxConcurrency
 * @param  {String}  states[].map.resultPath
 * @param  {String}  states[].map.resultSelector
 * @param  {Object}  states[].map.retry
 * @param  {Object}  states[].map.catch
 * @param  {String}  states[].wait
 * @param  {String}  states[].waitSecondsPath
 * @param  {String}  states[].waitTimestampPath
 * @param  {String}  states[].next
 * @param  {Boolean} states[].end
 * @param  {String}  states[].default					Only applied when 'choices' is set.
 * @param  {Boolean} states[].succeed					If set to true, the type is 'success'
 * @param  {String}  states[].error.name
 * @param  {String}  states[].error.cause
 * 
 * @return {String}	 output['stepName'].Type			Valid values: 'Pass', 'Task', 'Choice', 'Wait', 'Succeed', 'Fail', 'Parallel', 'Map'
 * @return {String}	 output['stepName'].Resource		Only valid for 'Task'
 * @return {String}	 output['stepName'].Next			
 * @return {String}	 output['stepName'].End
 * @return {String}	 output['stepName'].Choices			Only valid for 'Choice'
 * @return {String}	 output['stepName'].Default			Only valid for 'Choice'
 * @return {String}	 output['stepName'].Seconds			Only valid for 'Wait'
 * @return {String}	 output['stepName'].Timestamp		Only valid for 'Wait'
 * @return {String}	 output['stepName'].TimestampPath	Only valid for 'Wait'
 * @return {String}	 output['stepName'].SecondsPath		Only valid for 'Wait'
 * @return {String}	 output['stepName'].Error			Only valid for 'Fail'
 * @return {String}	 output['stepName'].Cause			Only valid for 'Fail'
 * @return {String}	 output['stepName'].Branches		Only valid for 'Parallel'
 * @return {String}	 output['stepName'].InputPath		Only valid for 'Map'
 * @return {String}	 output['stepName'].ItemsPath		Only valid for 'Map'
 * @return {String}	 output['stepName'].MaxConcurrency	Only valid for 'Map'
 * @return {String}	 output['stepName'].ResultPath		Only valid for 'Map'
 * @return {String}	 output['stepName'].Iterator		Only valid for 'Map'
 */
const formatStates = states => {
	const l = (states||[]).length
	if (!l)
		return {}

	return states.reduce((acc,state,idx) => {
		const nextStateName = idx == l-1 ? null : states[idx+1].name
		if (state && state.name) {
			const s = {}
			let setNextOrEnd = false
			if (state.activityArn) {
				// Doc: https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-task-state.html
				s.Type = 'Task'
				s.Resource = state.activityArn
				setNextOrEnd = true
			} else if (state.choices && state.choices.length) {
				// Doc: https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-choice-state.html
				s.Type = 'Choice'
				s.Choices = state.choices
				s.Default = state.default
			} else if (state.wait || state.waitSecondsPath || state.waitTimestampPath) {
				// Doc: https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-wait-state.html
				s.Type = 'Wait'
				if (state.waitTimestampPath)
					s.TimestampPath = state.waitTimestampPath
				else if (state.waitSecondsPath)
					s.SecondsPath = state.waitSecondsPath
				else {
					if (state.wait instanceof Date)
						s.Timestamp = state.wait.toISOString()
					else {
						const waitSeconds = state.wait*1
						if (isNaN(waitSeconds)) {
							const timestamp = new Date(state.wait)
							if (isNaN(timestamp))
								throw new Error(`Wrong argument exception. 'states[${idx}].wait' must be a valid UTC date. Found '${state.wait}' instead.`)
							else
								s.Timestamp = timestamp.toISOString()
						} else
							s.Seconds = waitSeconds
					}
					
				}
				setNextOrEnd = true
			} else if (state.succeed) {
				// Doc: https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-succeed-state.html
				s.Type = 'Succeed'
			} else if (state.error) {
				// Doc: https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-fail-state.html
				s.Type = 'Fail'
				if (state.error.name)
					s.Error = state.error.name
				if (state.error.cause)
					s.Cause = state.error.cause
			} else if (state.parallel && state.parallel.states && state.parallel.states.length) {
				// Doc: https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-parallel-state.html
				s.Type = 'Parallel'
				s.Branches = state.parallel.states.map((task,i) => {
					const [tasks,idxLabel] = Array.isArray(task) ? [task,'[0]'] : [[task],'']
					if (!tasks[0].name)
						throw new Error(`Missing required argument. 'states[${idx}].parallel.states[${i}]${idxLabel}.name' is required.`)

					return { 
						StartAt:tasks[0].name,
						States: formatStates(tasks)
					}
				})
				setNextOrEnd = true
			} else if (state.map && state.map.states) {
				// Doc: https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-map-state.html
				s.Type = 'Map'
				s.InputPath = state.map.inputPath
				s.ItemsPath = state.map.itemsPath
				s.MaxConcurrency = state.map.maxConcurrency
				s.ResultPath = state.map.resultPath
				const [tasks,idxLabel] = Array.isArray(state.map.states) ? [state.map.states,'[0]'] : [[state.map.states],'']
				if (!tasks[0].name)
					throw new Error(`Missing required argument. 'states[${idx}].map.states${idxLabel}.name' is required.`)

				s.Iterator = {
					StartAt:tasks[0].name,
					States: formatStates(tasks)
				}
				setNextOrEnd = true
			}

			if (setNextOrEnd) {
				if (state.next)
					s.Next = state.next
				else if (state.end)
					s.End = true
				else if (nextStateName)
					s.Next = nextStateName
				else
					s.End = true
			}

			acc[state.name] = s
		}

		return acc
	}, {})
}

module.exports = createStepFunction






