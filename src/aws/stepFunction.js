/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

// Version: 0.0.6

const aws = require('@pulumi/aws')
const { resolve } = require('../utils')

const VALID_CLOUDWATCH_LEVELS = ['ALL', 'ERROR', 'FATAL']

/**
 * Creates a step function. 
 * 
 * @param  {String} 		   name						
 * @param  {String} 		   description		
 * @param  {String} 		   type									Valid values: 'standard' (default) or 'express'
 * @param  {Object}  		   states								
 * @param  {[Output<Policy>]}  policies						
 * @param  {String} 		   cloudWatchLevel						Default is 'OFF'. Valid values: 'ALL', 'ERROR', 'FATAL'
 * @param  {Number}			   logsRetentionInDays					Default 0 (i.e., never expires). Only applies when 'cloudWatch' is true.
 * @param  {Object} 		   tags						
 * @return {String}						
 */
const createStateMachine = async ({ name, description, type, states, policies, cloudWatchLevel, logsRetentionInDays, tags }) => {
	
	if (!name)
		throw new Error('Missing required argument \'name\'.')
	if (!states)
		throw new Error('Missing required argument \'states\'.')
	
	cloudWatchLevel = (cloudWatchLevel || 'OFF').trim().toUpperCase()
	const cloudWatch = VALID_CLOUDWATCH_LEVELS.indexOf(cloudWatchLevel) >= 0
	tags = tags || {}
	policies = policies || []
	const dependsOn = []

	const canonicalName = `${name}-step-function`

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
	const stepFunction = new aws.sfn.StateMachine(name, {
		name,
		roleArn: stepFuncRole.arn,
		type: (type||'').trim().toLowerCase() == 'express' ? 'EXPRESS' : 'STANDARD',
		definition: JSON.stringify({
			Comment: description,
			StartAt: Object.keys(states)[0],
			States: states
		}, null, '	'),
		loggingConfiguration,
		dependsOn,
		tags: {
			...tags,
			Name: name
		}
	})

	return {
		...leanifyStepFunction(stepFunction),
		logGroup: leanify(logGroup)
	}
}

const leanify = resource => {
	/* eslint-disable */
	const { tags, urn, tagsAll, ...rest } = resource || {}	
	/* eslint-enable */
	return rest
}

const leanifyStepFunction = resource => {
	const { id, name, type, arn, creationDate, roleArn, status, tracingConfiguration, loggingConfiguration } = resource || {}	
	return { id, name, type, arn, creationDate, roleArn, status, tracingConfiguration, loggingConfiguration }
}

module.exports = {
	stateMachine: createStateMachine
}






