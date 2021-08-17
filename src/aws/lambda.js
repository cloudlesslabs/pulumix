// Version: 0.0.2

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const { resolve } = require('./utils')

/**
 * Creates an AWS Lambda. Doc: https://www.pulumi.com/docs/reference/pkg/aws/lambda/function/
 * Resources:
 * 	1. IAM role
 * 	2. (Optional) Log group if 'cloudWatch' is true.
 * 	3. (Optional) Attach AWSLambdaBasicExecutionRole AWS managed policy to the IAM role if 'cloudWatch' is true. 
 * 	4. Lambda.
 * 	
 * @param  {String}				name								
 * @param  {String}				runtime								e.g., 'nodejs14.x'. All runtimes: https://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html#SSS-CreateFunction-request-Runtime
 * @param  {String}				functionFolder						e.g., './app'. That's the absolute path to the local folder containing the Lambda code that will be zipped.
 * @param  {Number}				timeout								Unit seconds. Default is 3 and max is 900 (15 minutes).
 * @param  {Number}				memorySize							Unit is MB. Default is 128 and max is 10,240
 * @param  {String}				handler								Deafult is 'index.handler'.
 * @param  {[Output<Policy>]}	policies							Policies to attach to the lambda role.
 * @param  {Output<String>}		imageUri							URI of the Docker image. Conflicts with 'functionFolder'. If both are defined, 'imageUri' wins.
 * @param  {Output<[String]>}	vpcConfig.subnetIds
 * @param  {Output<[String]>}	vpcConfig.securityGroupIds
 * @param  {Boolean}			vpcConfig.enableENIcreation			Default false. True means that ENIs can be created if the lambda is in a private subnet.
 * @param  {Output<String>}		fileSystemConfig.arn				Used to mount an AWS EFS access point.
 * @param  {Output<String>}		fileSystemConfig.localMountPath		Used to mount an AWS EFS access point.
 * @param  {Boolean}			cloudWatch 							Default false. When true, CloudWatch is enabled.
 * @param  {Number}				logsRetentionInDays					Default 0 (i.e., never expires). Only applies when 'cloudWatch' is true.
 * @param  {String}				tags		
 * 				
 * @return {Output<Lambda>}		output.lambda						
 * @return {Output<Role>}		output.role
 * @return {Output<LogGroup>}	output.logGroup
 *
 * Example (there are more properties, but the following are the usual suspects):
 * {
 * 		lambda: {
 * 			id: '1st-step',
 * 			name: '1st-step',
 * 			arn: 'arn:aws:lambda:ap-southeast-2:123456:function:1st-step'
 * 		},
 * 		role: {
 * 			id: '1st-step-lambda-bd84160',
 * 			name: '1st-step-lambda-bd84160',
 * 			arn: 'arn:aws:iam::123456:role/1st-step-lambda-bd84160'
 * 		},
 * 		logGroup: {
 * 			id: '/aws/lambda/1st-step',
 * 			name: '/aws/lambda/1st-step',
 * 			arn: 'arn:aws:logs:ap-southeast-2:123456:log-group:/aws/lambda/1st-step'
 * 		}
 * }
 */
const createLambda = async ({ name, runtime, functionFolder, imageUri, timeout=3, memorySize=128, handler, policies, vpcConfig, fileSystemConfig, cloudWatch, logsRetentionInDays, tags }) => {
	tags = tags || {}
	policies = policies || []
	const { enableENIcreation, ..._vpcConfig } = vpcConfig||{}
	const dependsOn = []

	if (!name)
		throw new Error('Missing required argument \'name\'.')
	
	const canonicalName = `${name}-lambda`

	// IAM role. Doc: https://www.pulumi.com/docs/reference/pkg/aws/iam/role/
	const lambdaRole = new aws.iam.Role(canonicalName, {
		assumeRolePolicy: {
			Version: '2012-10-17',
			Statement: [{
				Action: 'sts:AssumeRole',
				Principal: {
					Service: 'lambda.amazonaws.com',
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
	let logGroup = null
	if (cloudWatch) {
		// Enables the lambda to send logs to CloudWatch
		policies.push({ name: `${canonicalName}-cloudwatch`, arn:'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole' })
		// Creates the log group where the logs are sent. Doc: https://www.pulumi.com/docs/reference/pkg/aws/cloudwatch/loggroup/
		const logGroupId = `/aws/lambda/${name}`
		logGroup = new aws.cloudwatch.LogGroup(logGroupId, { 
			name: logGroupId,
			retentionInDays: logsRetentionInDays || 0,
			tags: {
				...tags,
				Name: name
			}
		})
	}

	if (enableENIcreation)
		// Enables the lambda to send logs to CloudWatch
		policies.push({ 
			name: `${canonicalName}-eni-creation`, 
			arn:'arn:aws:iam::aws:policy/service-role/AWSLambdaENIManagementAccess' 
		})


	if (fileSystemConfig) {
		// To access EFS, the execution role for the lambda function must provide those two policies:
		// Doc: https://aws.amazon.com/blogs/compute/using-amazon-efs-for-aws-lambda-in-your-serverless-applications/
		policies.push({
			name: `${canonicalName}-vpc-access`,
			arn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole'
		}, {
			name: `${canonicalName}-efs-access`,
			arn: 'arn:aws:iam::aws:policy/AmazonElasticFileSystemClientFullAccess'
		})
	}

	// Attach policies
	for (let i=0;i<policies.length;i++) {
		const policy = policies[i]
		if (!policy.name)
			throw new Error(`Invalid argument exception. Some policies in lambda ${name} don't have a name.`)	
		if (!policy.arn)
			throw new Error(`Invalid argument exception. Some policies in lambda ${name} don't have an arn.`)	
		
		const policyName = await resolve(policy.name)
		dependsOn.push(new aws.iam.RolePolicyAttachment(policyName, {
			role: lambdaRole.name,
			policyArn: policy.arn
		}))
	}

	// Configure the function code used for that lambda
	if (!imageUri) {
		if (!runtime)
			throw new Error('Missing required argument \'runtime\'. Please select one amongst the list at https://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html#SSS-CreateFunction-request-Runtime')
		if (!functionFolder)
			throw new Error('Missing required argument \'functionFolder\'.')
	}
	const functionCode = imageUri 
		? {
			packageType: 'Image',
			imageUri
		} : {
			runtime,
			code: new pulumi.asset.AssetArchive({
				'.': new pulumi.asset.FileArchive(functionFolder),
			}),
			handler: handler || 'index.handler'
		}

	// Create tha Lambda. Doc: https://www.pulumi.com/docs/reference/pkg/aws/lambda/function/ 
	const lambda = new aws.lambda.Function(name, {
		name,
		...functionCode,
		timeout,
		memorySize,
		role: lambdaRole.arn,
		vpcConfig:_vpcConfig,
		fileSystemConfig,
		dependsOn,
		tags: {
			...tags,
			Name: name
		}
	})

	return {
		lambda,
		role: lambdaRole,
		logGroup
	}
}

module.exports = createLambda


