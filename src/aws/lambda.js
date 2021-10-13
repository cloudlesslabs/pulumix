/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

/*
 APIs:
 	- lambda
 	- layer
 */

import pulumi from '@pulumi/pulumi'
import aws from '@pulumi/aws'
import fs from 'fs'
import path from 'path'
import { ecr } from './ecr.js'
import { resolve } from '../utils.js'

/**
 * Creates an AWS Lambda. Doc: https://www.pulumi.com/docs/reference/pkg/aws/lambda/function/
 * Resources:
 * 	1. IAM role
 * 	2. (Optional) Log group if 'cloudwatch' is true.
 * 	3. (Optional) Up to 2 policies which are attached to the IAM role:
 * 		- If the Lambda is configured in a VPC (i.e., 'vpcConfig' exists), then the AWS managed policy 'AWSLambdaVPCAccessExecutionRole' is added. This policy automatically grant 'send-to' cloudwatch access.
 * 		- If 'cloudwatch' is true, then the AWS managed policy 'AWSLambdaBasicExecutionRole' is added.
 * 		- If 'fileSystemConfig' is configured, then the AWS managed policy 'AmazonElasticFileSystemClientFullAccess' is added.
 * 	4. Lambda.
 * 	
 * @param  {String}				name	
 * @param  {String}				description		
 * @param  {String}				architecture						Valid values: 'x86_64', 'arm64'(default) WARNING (3)
 * @param  {String}				fn.dir								The absolute path to the local folder containing the Lambda code that will be zipped.
 * @param  {String}				fn.type								Valid values: 'zip' (default), 'image' (1)											
 * @param  {String}				fn.runtime							Only required if 'fn.type' is 'zip'. e.g., 'nodejs14.x'. All runtimes: https://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html#SSS-CreateFunction-request-Runtime
 * @param  {Object}				fn.args								Only valid when 'fn.type' is 'image' (1). This is what would be passed in the --build-arg option of `docker build`.
 * @param  {Object}				fn.env								Environment variables for that fn. It works a bit differently when 'fn.type' is 'image' (2).
 * @param  {[Output<String>]}	layers								Layer ARNS.
 * @param  {Number}				timeout								Unit seconds. Default is 3 and max is 900 (15 minutes).
 * @param  {Number}				memorySize							Unit is MB. Default is 128 and max is 10,240
 * @param  {String}				handler								Default is 'index.handler'.
 * @param  {[String]}			allowedPrincipals					Default is null, which means only 'lambda.amazonaws.com' can invoke the lambda.
 * @param  {[Output<Policy>]}	policies							Policies to attach to the lambda role.
 * @param  {Output<[String]>}	vpcConfig.subnetIds
 * @param  {Output<[String]>}	vpcConfig.securityGroupIds
 * @param  {Output<String>}		fileSystemConfig.arn				Used to mount an AWS EFS access point.
 * @param  {Output<String>}		fileSystemConfig.localMountPath		Used to mount an AWS EFS access point.
 * @param  {Boolean}			cloudwatch 							Default false. When true, cloudwatch is enabled.
 * @param  {Boolean}			cloudWatch 							Deprecated. Use 'cloudwatch' instead.
 * @param  {Number}				logsRetentionInDays					Default 0 (i.e., never expires). Only applies when 'cloudwatch' is true.
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
 *
 * (1) 'fn.type' is not required. If it is not set and 'fn.dir' contains a 'Dockerfile', the type is 'image'.
 * (2) When 'fn.env' is set and 'fn.type' is 'image'(1), then this object is merged with the 'fn.arg'. This 
 * means there is an extra manual step to convert the docker ARG into ENV in the Dockerfile.
 * (3) If the lambda uses Docker, the architecture MUST BE COMPATIBLE with the Docker image. For a list of all the 
 * lambda images with their associated OS, please refer to https://hub.docker.com/r/amazon/aws-lambda-nodejs/tags?page=1&ordering=last_updated
 */
export const lambda = async ({ name, description, architecture, fn, layers, timeout=3, memorySize=128, handler, allowedPrincipals, policies, vpcConfig, fileSystemConfig, cloudWatch, cloudwatch, logsRetentionInDays, tags }) => {
	tags = tags || {}
	const dependsOn = []
	if (cloudWatch !== undefined && cloudwatch === undefined)
		cloudwatch = cloudWatch
	
	if (!name)
		throw new Error('Missing required argument \'name\'.')
	if (!fn)
		throw new Error('Missing required argument \'fn\'.')
	if (!fn.dir)
		throw new Error('Missing required argument \'fn.dir\'.')
	
	const canonicalName = `${name}-lambda`

	if (!(await fileExists(fn.dir)))
		throw new Error(`Function folder '${fn.dir}' not found.`)	

	const dockerFileFound = await fileExists(path.join(fn.dir, 'Dockerfile'))
	let image
	if (fn.type == 'image' || dockerFileFound) {
		const args = fn.args || fn.env ? { ...(fn.args||{}), ...(fn.env||{}) } : undefined
		// ECR images. Doc:
		// 	- buildAndPushImage API: https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/awsx/ecr/#buildAndPushImage
		// 	- 2nd argument is a DockerBuild object: https://www.pulumi.com/docs/reference/pkg/docker/image/#dockerbuild
		// image = awsx.ecr.buildAndPushImage(canonicalName, {
		// 	context: fn.dir,
		// 	args,
		// 	tags: {
		// 		...tags,
		// 		Name: canonicalName
		// 	}
		// })
		image = await ecr.image({ 
			name: canonicalName,
			dir: fn.dir,
			args,
			tags
		})
	}
	const imageUri = image ? image.imageValues[0] : null
	
	// IAM role. Doc: https://www.pulumi.com/docs/reference/pkg/aws/iam/role/
	allowedPrincipals = allowedPrincipals || []
	if (!allowedPrincipals.some(x => x == 'lambda.amazonaws.com'))
		allowedPrincipals.push('lambda.amazonaws.com')
	const lambdaRole = new aws.iam.Role(canonicalName, {
		name: canonicalName,
		description: `Role for lambda '${name}'`,
		assumeRolePolicy: {
			Version: '2012-10-17',
			Statement: allowedPrincipals.map(Service => ({
				Action: 'sts:AssumeRole',
				Principal: {
					Service
				},
				Effect: 'Allow',
				Sid: ''
			})),
		},
		tags: {
			...tags,
			Name: canonicalName
		}
	})

	// Configure cloudwatch
	let logGroup = null
	if (cloudwatch) {
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

	// Attach policies
	const updatedPolicies = configurePolicies(policies, canonicalName, { cloudwatch, vpcConfig, fileSystemConfig })
	for (let i=0;i<updatedPolicies.length;i++) {
		const policy = updatedPolicies[i]
		if (!policy.name)
			throw new Error(`Invalid argument exception. Some policies in lambda ${name} don't have a name.`)	
		if (!policy.arn)
			throw new Error(`Invalid argument exception. Some policies in lambda ${name} don't have an arn.`)	
		
		const policyName = await resolve(policy.name)
		dependsOn.push(new aws.iam.RolePolicyAttachment(`${canonicalName}-${policyName}`, {
			role: lambdaRole.name,
			policyArn: policy.arn
		}))
	}

	// Configure the function code used for that lambda
	if (!imageUri && !fn.runtime)
		throw new Error('Missing required argument \'fn.runtime\'. Please select one amongst the list at https://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html#SSS-CreateFunction-request-Runtime')
	
	const functionCode = imageUri 
		? {
			packageType: 'Image',
			imageUri
		} : {
			runtime: fn.runtime,
			code: new pulumi.asset.AssetArchive({
				'.': new pulumi.asset.FileArchive(fn.dir),
			}),
			handler: handler || 'index.handler'
		}

	// Create tha Lambda. Doc: https://www.pulumi.com/docs/reference/pkg/aws/lambda/function/ 
	const _lambda = new aws.lambda.Function(name, {
		name,
		description,
		architectures: [architecture == 'x86_64' ? 'x86_64' : 'arm64'],
		...functionCode,
		timeout,
		memorySize,
		layers: layers && layers.length ? layers : undefined,
		role: lambdaRole.arn,
		vpcConfig: Object.keys(vpcConfig||{}).length ? vpcConfig : undefined,
		fileSystemConfig,
		dependsOn,
		tags: {
			...tags,
			Name: name
		}
	})

	return {
		lambda: leanify(_lambda),
		image: leanifyImage(image),
		role:leanify(lambdaRole),
		logGroup: leanify(logGroup)
	}
}

/**
 * Creates a new Lambda layer. Doc: https://www.pulumi.com/docs/reference/pkg/aws/lambda/layerversion/
 * 
 * @param  {String}					name        
 * @param  {String}					runtime					e.g., 'nodejs12.x', 'nodejs14.x'. Full list at https://docs.aws.amazon.com/lambda/latest/dg/API_PublishLayerVersion.html#SSS-PublishLayerVersion-request-CompatibleRuntimes
 * @param  {String}					dir						Absolute path to the folder that contains the layer's code.
 * @param  {String}					description		
 * @param  {String}					licenseInfo 			e.g., 'BSD-3-Clause' (or 'https://opensource.org/licenses/BSD-3-Clause'), 'MIT' (or 'https://opensource.org/licenses/MIT') doc: https://docs.aws.amazon.com/lambda/latest/dg/API_PublishLayerVersion.html#SSS-PublishLayerVersion-request-LicenseInfo
 * @param  {Object}					tags
 * 
 * @return {Output<LayerVersion>}	LayerVersion
 * @return {Output<LayerVersion>}	LayerVersion...			All the usuals (id, arn, ...)
 * @return {Output<String>}			LayerVersion.version	e.g., '1', '2'
 * @return {Output<LayerVersion>}	LayerVersion.layerArn	Different from the 'arn'. The 'arn' includes the version (1). 
 *
 * (1) 'arn' vs 'layerArn': 
 * 		- arn: 		'arn:aws:lambda:ap-southeast-2:1234:layer:aws-layer-dev-layer-01:1' 
 * 		- layerArn: 'arn:aws:lambda:ap-southeast-2:1234:layer:aws-layer-dev-layer-01' 
 */
export const layer = async ({ name, runtime, dir, description, licenseInfo, tags }) => {
	if (!name)
		throw new Error('Missing required \'name\' argument .')
	if (!runtime)
		throw new Error('Missing required \'runtime\' argument .')
	if (!dir)
		throw new Error('Missing required \'dir\' argument .')
	if (!(await fileExists(dir)))
		throw new Error(`Directory '${dir}' not found.`)

	tags = tags || {}

	// Lambda layer doc: https://www.pulumi.com/docs/reference/pkg/aws/lambda/layerversion/
	const lambdaLayer = new aws.lambda.LayerVersion(name, {
		layerName: name,
		compatibleRuntimes: [runtime],
		description,
		licenseInfo,
		code: new pulumi.asset.AssetArchive({
			'.': new pulumi.asset.FileArchive(dir),
		}),
		// code: new pulumi.asset.FileArchive("lambda_layer_payload.zip"),
		tags: {
			...tags,
			Name: name
		}
	})

	return lambdaLayer
}


const leanifyImage = resource => {
	const { imageValue, repository } = resource || {}	
	if (!imageValue || !repository || !repository.repository)
		return resource

	const { id, arn, name, registryId, repositoryUrl } = repository.repository
	return {
		uri: imageValue,
		repository: {
			id, 
			arn, 
			name, 
			registryId, 
			url: repositoryUrl
		}
	}
}

const leanify = resource => {
	/* eslint-disable */
	const { tags, urn, tagsAll, ...rest } = resource || {}	
	/* eslint-enable */
	return rest
}

/**
 * Adds the policies based on the config. 
 * 
 * @param  {[Policy]} policies
 * @param  {String}   prefix
 * @param  {Boolean}  config.cloudwatch
 * @param  {Boolean}  config.vpcConfig
 * @param  {Boolean}  config.fileSystemConfig
 * 
 * @return {[Policy]} updatedPolicies
 */
const configurePolicies = (policies, prefix, config) => {
	const AWSLambdaVPCAccessExecutionRole = 'arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole'
	const AWSLambdaBasicExecutionRole = 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
	const AmazonElasticFileSystemClientFullAccess = 'arn:aws:iam::aws:policy/AmazonElasticFileSystemClientFullAccess'

	const updatedPolicies = [...(policies || [])]
	const { cloudwatch, fileSystemConfig, vpcConfig } = config || {}

	const efsAccess = fileSystemConfig && fileSystemConfig.arn
	const vpcAccess = efsAccess || (vpcConfig && vpcConfig.subnetIds)
	if (vpcAccess && !updatedPolicies.some(p => p.arn == AWSLambdaVPCAccessExecutionRole))
		updatedPolicies.push({
			name: `${prefix}-vpc-access`,
			// 'AWSLambdaVPCAccessExecutionRole' contains 'AWSLambdaBasicExecutionRole'
			arn: AWSLambdaVPCAccessExecutionRole
		})
	else if (cloudwatch && !updatedPolicies.some(p => p.arn == AWSLambdaBasicExecutionRole))
		// Enables the lambda to send logs to cloudwatch
		updatedPolicies.push({ 
			name: `${prefix}-cloudwatch`, 
			arn: AWSLambdaBasicExecutionRole
		})

	if (efsAccess && !updatedPolicies.some(p => p.arn == AmazonElasticFileSystemClientFullAccess))
		// To access EFS, the execution role for the lambda function must provide those two policies:
		// Doc: https://aws.amazon.com/blogs/compute/using-amazon-efs-for-aws-lambda-in-your-serverless-applications/
		updatedPolicies.push({
			name: `${prefix}-efs-access`,
			arn: AmazonElasticFileSystemClientFullAccess
		})

	return updatedPolicies
}

/**
 * Checks if a file or folder exists
 * 
 * @param  {String}  filePath 	Absolute or relative path to file or folder on the local machine
 * @return {Boolean}   
 */
const fileExists = filePath => new Promise(onSuccess => fs.exists(path.resolve(filePath||''), yes => onSuccess(yes ? true : false)))





