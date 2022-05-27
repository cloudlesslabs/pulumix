/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

// Version: 0.1.1

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const fs = require('fs')
const path = require('path')
const { Image } = require('./ecr')
const { unwrap, keepResourcesOnly } = require('../utils')
const { SecurityGroup } = require('./securityGroup')

class Lambda extends aws.lambda.Function {
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
	 * @param  {String}						name	
	 * @param  {String}						description		
	 * @param  {String}						architecture						Valid values: 'x86_64', 'arm64'(default) WARNING (3)
	 * @param  {Output<Object>}				fn
	 * @param  {Output<String>}					.dir							The absolute path to the local folder containing the Lambda code that will be zipped.
	 * @param  {Output<String>}					.type							Valid values: 'zip' (default), 'image' (1)											
	 * @param  {Output<String>}					.runtime						Only required if 'fn.type' is 'zip'. e.g., 'nodejs14.x'. All runtimes: https://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html#SSS-CreateFunction-request-Runtime
	 * @param  {Output<Object>}					.args							Only valid when 'fn.type' is 'image' (1). This is what would be passed in the --build-arg option of `docker build`.
	 * @param  {Output<Object>}					.env							Environment variables for that fn. It works a bit differently when 'fn.type' is 'image' (2).
	 * @param  {[Output<String>]}			layers								Layer ARNS.
	 * @param  {Number}						timeout								Unit seconds. Default is 3 and max is 900 (15 minutes).
	 * @param  {Number}						memorySize							Unit is MB. Default is 128 and max is 10,240
	 * @param  {String}						handler								Default is 'index.handler'.
	 * @param  {[Output<Policy>]}			policies							Policies to attach to the lambda role.
	 * @param  {Output<Object>}				vpcConfig
	 * @param  {Output<String>}					.vpcId							Only required if 'vpcConfig.allResponsesAllowed' is true.
	 * @param  {Output<[Subnet]>}				.subnets
	 * @param  {Output<[String]>}				.subnetIds
	 * @param  {Output<[SecurityGroup]>}		.securityGroups
	 * @param  {Output<[String]>}				.securityGroupIds				
	 * @param  {Boolean}						.allResponsesAllowed			Default false. When true, a new security group with an egress allowing all traffic is created and associted with this lambda.
	 * @param  {Output<Object>}				fileSystemConfig
	 * @param  {Output<String>}					.arn							Used to mount an AWS EFS access point.
	 * @param  {Output<String>}					.localMountPath					Used to mount an AWS EFS access point.
	 * @param  {Object}						schedule					
	 * @param  {String}							.expression						e.g., 'rate(1 minute)'. Full doc at https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html
	 * @param  {Object}							.payload						Optional. When specified, the object is passed to the Lambda's event. Otherwise, the default object is passed as the event (4)
	 * @param  {Boolean}					publish								Default false. True publishes the lambda to a new version.
	 * @param  {Boolean}					cloudwatch 							Default false. When true, cloudwatch is enabled.
	 * @param  {Boolean}					cloudWatch 							Deprecated. Use 'cloudwatch' instead.
	 * @param  {Number}						logsRetentionInDays					Default 0 (i.e., never expires). Only applies when 'cloudwatch' is true.
	 * @param  {String}						tags	
	 * @param  {Output<Resource>}			parent
	 * @param  {Output<[Resource]>}			dependsOn
	 * @param  {Boolean}					protect		
	 * 				
	 * @return {Output<Lambda>}				lambda
	 * @return {Output<String>} 				.id
	 * @return {Output<String>} 				.name
	 * @return {Output<String>} 				.arn
	 * @return {Output<Object>} 				...
	 * @return {Function}						.attachPolicy					(policy: Output<Policy>) => Output<RolePolicyAttachment> or
	 *                              		           							(attachName:String, policy: Output<Policy>) => Output<RolePolicyAttachment>				
	 * @return {Output<Role>}					.role
	 * @return {Output<LogGroup>}				.logGroup
	 * @return {Object}							.schedule
	 * @return {Output<EventRule>}					.eventRule						
	 * @return {Output<EventTarget>}				.eventTarget
	 * @return {Output<Permission>}					.permission
	 *
	 * Example (there are more properties, but the following are the usual suspects):
	 * {
	 * 		id: '1st-step',
	 * 		name: '1st-step',
	 * 		arn: 'arn:aws:lambda:ap-southeast-2:123456:function:1st-step',
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
	 * (4) The default object is:
	 * {
	 * 	version: '0',
	 * 	id: 'cee5b84f-57b6-c60b-2c8c-9e1867b7e9ac',
	 * 	'detail-type': 'Scheduled Event',
	 * 	source: 'aws.events',
	 * 	account: '12345677',
	 * 	time: '2022-01-27T02:18:59Z',
	 * 	region: 'ap-southeast-2',
	 * 	resources: [
	 *  	'arn:aws:events:ap-southeast-2:12345677:rule/some-event-name'
	 * 	],
	 * 	detail: {}
	 * }
	 */
	constructor({ name, description, architecture, fn, layers, timeout=3, memorySize=128, handler, policies:_policies, vpcConfig:_vpcConfig, fileSystemConfig, schedule, publish, cloudWatch, cloudwatch, logsRetentionInDays, tags, parent, dependsOn:_dependsOn, protect }) {
		tags = tags || {}
		if (cloudWatch !== undefined && cloudwatch === undefined)
			cloudwatch = cloudWatch
		
		if (!name)
			throw new Error('Missing required argument \'name\'.')
		if (!fn)
			throw new Error('Missing required argument \'fn\'.')
		if (!fn.dir)
			throw new Error('Missing required argument \'fn.dir\'.')
		
		const canonicalName = `${name}-lambda`

		// IAM role. Doc: https://www.pulumi.com/docs/reference/pkg/aws/iam/role/
		const lambdaRole = new aws.iam.Role(canonicalName, {
			name: canonicalName,
			description: `Role for lambda '${name}'`,
			assumeRolePolicy: {
				Version: '2012-10-17',
				Statement: [{
					Action: 'sts:AssumeRole',
					Principal: {
						Service: 'lambda.amazonaws.com'
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

		const asyncData = unwrap(fn).apply(_fn => pulumi.all([
			_fileExists(_fn.dir), 
			_fileExists(path.join(_fn.dir, 'Dockerfile')),
			_fn.dir, 
			_fn.type, 
			_fn.runtime, 
			_fn.args, 
			_fn.env,
			_parseVpcConfig({ ...(_vpcConfig||{}), name, tags }),
			_dependsOn,
			_policies
		]).apply(([fnDirFound, dockerFileFound, dir, type, runtime, args, env, { config:vpcConfig, securityGroups, subnets, allowAllResponsesSg }, dependsOn, policies]) => {
			dependsOn = dependsOn || []
			if (!fnDirFound)
				throw new Error(`Function folder '${dir}' not found.`)	

			if (securityGroups && securityGroups.length)
				dependsOn.push(...securityGroups)
			if (subnets && subnets.length)
				dependsOn.push(...subnets)

			// ECR images. Doc:
			// 	- buildAndPushImage API: https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/awsx/ecr/#buildAndPushImage
			// 	- 2nd argument is a DockerBuild object: https://www.pulumi.com/docs/reference/pkg/docker/image/#dockerbuild
			// image = awsx.ecr.buildAndPushImage(canonicalName, {
			// 	context: dir,
			// 	args,
			// 	tags: {
			// 		...tags,
			// 		Name: canonicalName
			// 	}
			// })
			const image = type == 'image' || dockerFileFound 
				? new Image({ 
					name: canonicalName,
					dir: dir,
					args: args || env ? { ...(args||{}), ...(env||{}) } : undefined,
					tags
				})
				: null

			const imageUri = image ? image.imageValues[0] : null

			// Attach policies
			const updatedPolicies = _configurePolicies(policies, canonicalName, { cloudwatch, vpcConfig, fileSystemConfig })

			return pulumi.all([imageUri, ...updatedPolicies.map(p => unwrap(p))]).apply(([_imageUri, ..._policies]) => {

				for (let i=0;i<_policies.length;i++) {
					const policy = _policies[i]
					if (!policy.name)
						throw new Error(`Invalid argument exception. Some policies in lambda ${name} don't have a name.`)	
					if (!policy.arn)
						throw new Error(`Invalid argument exception. Some policies in lambda ${name} don't have an arn.`)	
						
					dependsOn.push(new aws.iam.RolePolicyAttachment(`${canonicalName}-${policy.name}`, {
						role: lambdaRole.name,
						policyArn: policy.arn
					}))
				}

				// Configure the function code used for that lambda
				if (!_imageUri && !runtime)
					throw new Error('Missing required argument \'fn.runtime\'. Please select one amongst the list at https://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html#SSS-CreateFunction-request-Runtime')
				
				return {
					image: _leanifyImage(image),
					functionCode: _imageUri 
						? {
							packageType: 'Image',
							imageUri: _imageUri
						} : {
							runtime,
							code: new pulumi.asset.AssetArchive({
								'.': new pulumi.asset.FileArchive(dir),
							}),
							handler: handler || 'index.handler'
						},
					allowAllResponsesSg,
					vpcConfig,
					dependsOn: keepResourcesOnly(dependsOn)
				}
			})
		}))

		// Create tha Lambda. Doc: https://www.pulumi.com/docs/reference/pkg/aws/lambda/function/ 
		super(name, {
			name,
			description,
			architectures: [architecture == 'x86_64' ? 'x86_64' : 'arm64'],
			packageType: asyncData.functionCode.packageType,
			imageUri: asyncData.functionCode.imageUri,
			runtime: asyncData.functionCode.runtime,
			code: asyncData.functionCode.code,
			vpcConfig: asyncData.vpcConfig,
			handler: asyncData.functionCode.handler,
			timeout,
			memorySize,
			layers: layers && layers.length ? layers : undefined,
			role: lambdaRole.arn,
			fileSystemConfig,
			publish,
			tags: {
				...tags,
				Name: name
			},
		}, {
			parent,
			dependsOn: asyncData.dependsOn,
			protect
		})

		// Create schedule trigger
		let _schedule = null
		if (schedule && schedule.expression) {
			// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/cloudwatch/eventrule/
			const eventRuleName = `${name}-eventrule`
			const eventRule = new aws.cloudwatch.EventRule(eventRuleName, {
				name: eventRuleName,
				description: `Fire lambda ${name} on a schedule`,
				scheduleExpression: schedule.expression,
				tags: {
					...tags,
					Name: eventRuleName
				}
			}, { 
				protect, 
				dependsOn:[this] 
			})

			// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/cloudwatch/eventtarget/
			const eventTargetName = `${name}-eventtarget`
			const eventTargetConfig = {
				rule: eventRule.name,
				arn: this.arn,
				tags: {
					...tags,
					Name: eventTargetName
				}
			}
			if (schedule.payload) {
				if (typeof(schedule.payload) != 'object')
					throw new Error(`Wrong argument exception. 'schedule.payload' is expecting an object. Found ${typeof(schedule.payload)} instead.`)
				eventTargetConfig.input = JSON.stringify(schedule.payload)
			}
			const eventTarget = new aws.cloudwatch.EventTarget(eventTargetName, eventTargetConfig, { 
				protect, 
				dependsOn:[this] 
			})

			// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/lambda/permission/
			const schedulePermissionName = `${name}-schedule-permission`
			const permission = new aws.lambda.Permission(schedulePermissionName, {
				action: 'lambda:invokeFunction',
				function: this.name,
				principal: 'events.amazonaws.com',
				sourceArn: eventRule.arn
			}, { 
				protect, 
				dependsOn:[this] 
			})

			_schedule = {
				eventRule,
				eventTarget,
				permission
			}
		}

		this.image = asyncData.image
		this.role = lambdaRole
		this.logGroup = logGroup
		this.schedule = _schedule
		this.allowAllResponsesSg = asyncData.allowAllResponsesSg
	}

	/**
	 * Attach a  policy to a Lambda role. Potentially creates a new Policy. This API supports multiple signatures:
	 * 
	 * ('policy-attachement-123', { name:'xxx', description:'xxx', policy:'xxxx' }) => ... or
	 * ('policy-attachement-123', policyOutput) => ... or
	 * ({ name:'xxx', description:'xxx', policy:'xxxx' }) => ... or
	 * (policyOutput) => ... or
	 *
	 * When the 'attachName' is not specified, its default is `${lambdaRoleName}-${policyName}`.
	 * 
	 * @param  {Object} 						attachName|policyDef|policy	
	 * @param  {Object} 						policyDef|policy	
	 * 
	 * @return {Output<Object>}					output
	 * @return {Output<Policy>}						.policy
	 * @return {Output<RolePolicyAttachment>}		.rolePolicyAttachment
	 */
	static attachPolicy(lambda, ...args) {
		if (!lambda)
			throw new Error('Missing 1st argument \'lambda\'.')
		if (!lambda.role)
			throw new Error('Wrong argument exception. \'lambda\' argument is missing its required \'role\' property.')

		const [attachName, policyDef] = args.length == 1 ? [null, args[0]] : args
		if (!policyDef)
			throw new Error('Missing required argument \'policyDef\'')
		if (!policyDef.name)
			throw new Error('Missing required argument \'policyDef.name\'.')
		
		const policyDefExists = !policyDef.arn && policyDef.policy

		const policy = policyDefExists
			? new aws.iam.Policy(policyDef.name, policyDef)
			: policyDef
		
		if (!policy.arn)
			throw new Error('Missing required argument \'policy.arn\'')

		return pulumi.all([lambda.role.name, policy.name, policy.arn]).apply(([role, policyName, policyArn]) => {
			if (!role)
				throw new Error('Missing required argument \'lambda.role.name\'')

			const name = attachName && typeof(attachName) == 'string' 
				? attachName
				: `${role}-${policyName}`
			return {
				policy,
				rolePolicyAttachment: new aws.iam.RolePolicyAttachment(name, { 
					role, 
					policyArn 
				}, {
					dependsOn:[policy]
				})
			}
		})
	}
}

class LambdaLayer extends aws.lambda.LayerVersion {
	/**
	 * Creates a new Lambda layer. Doc: https://www.pulumi.com/docs/reference/pkg/aws/lambda/layerversion/
	 * 
	 * @param  {String}					name        
	 * @param  {String}					runtime					e.g., 'nodejs12.x', 'nodejs14.x'. Full list at https://docs.aws.amazon.com/lambda/latest/dg/API_PublishLayerVersion.html#SSS-PublishLayerVersion-request-CompatibleRuntimes
	 * @param  {String}					dir						Absolute path to the folder that contains the layer's code.
	 * @param  {String}					description		
	 * @param  {String}					licenseInfo 			e.g., 'BSD-3-Clause' (or 'https://opensource.org/licenses/BSD-3-Clause'), 'MIT' (or 'https://opensource.org/licenses/MIT') doc: https://docs.aws.amazon.com/lambda/latest/dg/API_PublishLayerVersion.html#SSS-PublishLayerVersion-request-LicenseInfo
	 * @param  {Object}					tags
	 * @param  {Output<Resource>}		parent
	 * @param  {Output<[Resource]>}		dependsOn
	 * @param  {Boolean}				protect		
	 * 
	 * @return {Output<LayerVersion>}	layer
	 * @return {Output<String>} 			.id
	 * @return {Output<String>} 			.name
	 * @return {Output<String>} 			.arn
	 * @return {Output<Object>} 			...
	 * @return {Output<String>}				.version			e.g., '1', '2'
	 * @return {Output<String>}				.layerArn			Different from the 'arn'. The 'arn' includes the version (1). 
	 *
	 * (1) 'arn' vs 'layerArn': 
	 * 		- arn: 		'arn:aws:lambda:ap-southeast-2:1234:layer:aws-layer-dev-layer-01:1' 
	 * 		- layerArn: 'arn:aws:lambda:ap-southeast-2:1234:layer:aws-layer-dev-layer-01' 
	 */
	constructor({ name, runtime, dir, description, licenseInfo, tags, parent, dependsOn, protect }) {
		if (!name)
			throw new Error('Missing required \'name\' argument .')
		if (!runtime)
			throw new Error('Missing required \'runtime\' argument .')
		if (!dir)
			throw new Error('Missing required \'dir\' argument .')

		tags = tags || {}

		const asyncCheck = pulumi.output(_fileExists(dir)).apply(dirFound => {
			if (!dirFound)
				throw new Error(`Directory '${dir}' not found.`)
		})

		// Lambda layer doc: https://www.pulumi.com/docs/reference/pkg/aws/lambda/layerversion/
		super(name, {
			layerName: name,
			compatibleRuntimes: [runtime],
			description,
			licenseInfo,
			code: asyncCheck.apply(() => new pulumi.asset.AssetArchive({
				'.': new pulumi.asset.FileArchive(dir),
			})),
			// code: new pulumi.asset.FileArchive("lambda_layer_payload.zip"),
			tags: {
				...tags,
				Name: name
			}
		}, {
			parent, 
			dependsOn, 
			protect
		})
	}
}

/**
 * 
 * 
 * @param  {Object}						vpcConfig
 * @param  {String}							.name							Lambda's name.
 * @param  {Object}							.tags							Lambda's tags.
 * @param  {Output<String>}					.vpcId							Only required if 'vpcConfig.allResponsesAllowed' is true.
 * @param  {Output<[Subnet]>}				.subnets
 * @param  {Output<[String]>}				.subnetIds
 * @param  {Output<[SecurityGroup]>}		.securityGroups
 * @param  {Output<[String]>}				.securityGroupIds				
 * @param  {Boolean}						.allResponsesAllowed			Default false. When true, a new security group with an egress allowing all traffic is created and associted with this lambda.
 * 
 * @return {Output<Object>}				output
 * @return {Output<Object>}					.config
 * @return {Output<[String]>}						.subnetIds
 * @return {Output<[String]>}						.securityGroupIds
 * @return {Output<[SecurityGroup]>}		.securityGroups					All security groups. They will be used to create a dependency on the Lambda to avoid deleting conflicts and the stack is destroyed.
 * @return {Output<[Subnet]>}				.subnets						vpcConfig.subnets
 * @return {Output<SecurityGroup>}			.allowAllResponsesSg			New security group created to allow all responses from the Lambda. It is also included in the 'output.securityGroups'
 */
const _parseVpcConfig = vpcConfig => {
	vpcConfig = vpcConfig || {}
	return pulumi.all([
		vpcConfig.vpcId,
		vpcConfig.allResponsesAllowed,
		pulumi.output(vpcConfig.subnets).apply(subnets => {
			return [
				subnets||[],
				pulumi.all((subnets||[]).map(s => s.id))
			]
		}),
		pulumi.output(vpcConfig.subnetIds).apply(ids => pulumi.all(ids||[])),
		pulumi.output(vpcConfig.securityGroups).apply(groups => pulumi.all(groups||[])),
		pulumi.output(vpcConfig.securityGroupIds).apply(ids => pulumi.all(ids||[]))
	]).apply(([vpcId, allResponsesAllowed, [subnets, implicitSubnetIds], explicitSubnetIds, securityGroups, securityGroupIds]) => {
		let allowAllResponsesSg = null
		if (allResponsesAllowed) {
			if (!vpcId)
				throw new Error('Missing required argument \'vpcConfig.vpcId\'. When \'vpcConfig.allResponsesAllowed\' is set to true, \'vpcConfig.vpcId\' is required.')

			securityGroups = securityGroups || []
			// Creates new Security Group to allow all responses from the Lambda.
			allowAllResponsesSg = new SecurityGroup({
				name: `allow-all-response-sg-${vpcConfig.name}`, 
				description: `Allow all responses for Lambda ${vpcConfig.name}.`, 
				vpcId, 
				egress: [{  
					protocol: '-1',  
					fromPort:0, toPort:65535, cidrBlocks: ['0.0.0.0/0'],  
					ipv6CidrBlocks: ['::/0'],  
					description:'Allow all traffic' 
				}], 
				tags: vpcConfig.tags
			})
			securityGroups.push(allowAllResponsesSg)
		}

		const subnetIds = [...(implicitSubnetIds||[]), ...(explicitSubnetIds||[])]

		const common = {
			subnets,
			securityGroups,
			allowAllResponsesSg
		}

		if (!subnetIds || !subnetIds.length)
			return common
		else if (!securityGroups || !securityGroups.length)
			return { config: { subnetIds, securityGroupIds }, ...common }
		else 
			return pulumi.all(securityGroups.map(sg => sg.id)).apply(sgIds => ({
				config: {
					subnetIds,
					securityGroupIds: sgIds.reduce((acc, id) => {
						if (id)
							acc.push(id)
						return acc
					}, securityGroupIds || [])
				},
				...common
			}))
	})
}

const _leanifyImage = resource => {
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

/**
 * Adds the policies based on the config. 
 * 
 * @param  {[Policy]}					policies
 * @param  {String}						prefix
 * @param  {Object}						config
 * @param  {Boolean}						.cloudwatch
 * @param  {Output<Object>}					.vpcConfig
 * @param  {Output<[String]>}					.subnetIds
 * @param  {Output<[SecurityGroup]>}			.securityGroups
 * @param  {Output<[String]>}					.securityGroupIds				Not recommended. 
 * @param  {Boolean}						.fileSystemConfig
 * 
 * @return {[Policy]}					updatedPolicies
 */
const _configurePolicies = (policies, prefix, config) => {
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
const _fileExists = filePath => new Promise(onSuccess => fs.exists(path.resolve(filePath||''), yes => onSuccess(yes ? true : false)))

module.exports = {
	Lambda,
	LambdaLayer
}




