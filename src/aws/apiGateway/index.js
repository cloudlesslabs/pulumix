/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const crypto = require('crypto')
const apiGatIntegrations = require('./integrations')
const { Snapshot } = require('./snapshot')

const REST_API_TYPES = ['edge', 'regional', 'private']
const HTTP_METHODS = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'ANY']
const INTEGRATION_TYPES = ['sns', 'sqs', 'http', 'http_proxy', 's3', 'lambda', 'lambda_proxy', 'kinesis']

class RestApi extends aws.apigateway.RestApi {
	/**
	 * Creates a new REST Api. 
	 * 
	 * @param	{String}						name
	 * @param	{String}						description
	 * @param	{String}						type							Default: 'egde'. Valid values: 'egde', 'regional', 'private'
	 * @param	{Object}						resources						e.g., { '/':{...}, 'dogs':{...}, 'blog/tech':{...} }
	 * @param	{Object}							.[name|methodName]			If name is '/', this means root resource.
	 * @param	{Object}								.[methodName]			e.g., 'GET', 'POST'
	 * @param	{[String]}									.contentTypes		Supported content types. Default ['application/json']
	 * @param	{Object}									.headers			Defines the required headers.
	 * @param	{Object}									.queryStrings		Defines the required query strings
	 * @param	{Object}									.authorizer
	 * @param	{Object}										.type			Valid values: 'NONE', 'CUSTOM', 'AWS_IAM', 'COGNITO_USER_POOLS'
	 * @param	{Object}									.sns
	 * @param	{Output<Topic>}									.topic
	 * @param	{Output<String>}									.arn		Required. 
	 * @param	{String}										.region			Default is the Pulumi AWS region from the stack config
	 * @param	{Object}									.sqs
	 * @param	{String}										.region			Default is the Pulumi AWS region from the stack config
	 * @param	{Object}									.http
	 * @param	{String}										.region			Default is the Pulumi AWS region from the stack config
	 * @param	{Object}									.http_proxy
	 * @param	{String}										.region			Default is the Pulumi AWS region from the stack config
	 * @param	{Object}									.s3
	 * @param	{String}										.region			Default is the Pulumi AWS region from the stack config
	 * @param	{Object}									.lambda
	 * @param	{String}										.region			Default is the Pulumi AWS region from the stack config
	 * @param	{Object}									.lambda_proxy
	 * @param	{Output<Lambda>}								.lambda
	 * @param	{Output<String>}									.name
	 * @param	{Output<String>}									.invokeArn
	 * @param	{String}										.region			Default is the Pulumi AWS region from the stack config
	 * @param	{Object}									.kinesis
	 * @param	{String}										.region			Default is the Pulumi AWS region from the stack config
	 * @param	{[Object]}						stages[]				 
	 * @param	{Object}							.name						e.g., 'dev', 'staging'					
	 * @param	{Object}							.snapshot					e.g., { hello:'world' }. Map of arbitrary keys and values that, when changed, will trigger a redeployment.
	 * @param	{String}								.version
	 * @param	{String}								.description
	 * @param	{Object}							.variables
	 * @param	{Boolean|Object}					.cloudwatch					(1) Default false. Toggles logging for that stage.
	 * @param	{[Object]}						domains[]
	 * @param	{String}							.name						e.g., 'example.com'
	 * @param	{String}							.validationMethod			Default 'DNS'. Valid values: 'DNS', 'EMAIL' or 'NONE'
	 * @param	{[String|Object]}					.stages						(2)
	 * @param	{Object}						tags		
	 * @param	{Output<Resource>}				parent
	 * @param	{Output<[Resource]>}			dependsOn
	 * @param	{Boolean}						protect	
	 *  
	 * @return	{Output<RestApi>}				api
	 * @return	{Output<String>}					.id
	 * @return	{Output<String>}					.arn
	 * @return	{Output<Object>}					...
	 * @return	{Output<Account>}					.account
	 * @return	{Output<Role>}						.apiGatewayRole
	 * @return	{[Output<IntegrationResponse>]}		.integrationResponses
	 * @return	{[Output<Integration>]}				.integrations
	 * @return	{[Output<MethodResponse>]}			.methodResponses
	 * @return	{[Output<Method>]}					.methods
	 * @return	{[Output<Resource>]}				.resources
	 * @return	{[Output<Stage>]}					.stages[]
	 * @return	{Output<String>}						.id
	 * @return	{Output<String>}						.arn
	 * @return	{Output<Object>}						...
	 * @return	{Output<Deployment>}					.snapshot
	 * @return	{Output<StageSetting>}					.settings
	 *
	 * (1) The 'stages[0].cloudwatch' property can be a boolean or a setting object. The setting object is structured as follow:
	 * 	{
	 *  	level: 'INFO',					// Default is 'INFO'. Valid values: 'INFO', 'ERROR' or 'OFF'.
	 *  	metrics: false,					// Default true.
	 *  	fullRequestResponse: false,		// Default false.
	 *  	logsRetentionInDays: 7			// Default 0, which means NEVER EXPIRES.
	 *	}
	 *
	 * 	When 'stages[0].cloudwatch' is set to true, this is equivalent to:
	 * 	{
	 *  	level: 'INFO',
	 *  	metrics: true,
	 *  	fullRequestResponse: false,
	 *  	logsRetentionInDays: 0
	 *	}
	 *
	 *  (2) ['dev'] or [{ name:'dev' }] or [{ name:'dev', path:'/hello' }]
	 * 
	 */
	constructor({ 
		name, 
		description, 
		type, 
		resources,
		stages,
		domains,
		tags, 
		protect, 
		dependsOn, 
		parent 
	}) {
		if (!name)
			throw new Error('Missing required argument \'name\'')
		type = type ? type.toLowerCase().trim() : type
		if (type && REST_API_TYPES.indexOf(type) < 0)
			throw new Error(`'type' value unsupported. Supported values are ${REST_API_TYPES}. Found ${type} instead.`)
		
		// Gets the unique stage names
		const stageNames = (stages||[]).reduce((acc,s,idx) => {
			if (!s || !s.name)
				throw new Error(`Missing required property 'name' in stages[${idx}].name`)
			if (acc.indexOf(s.name) < 0)
				acc.push(s.name)
			else
				throw new Error(`Stage '${s.name}' defined more than once`)
			return acc
		}, [])

		// Validates that the stages defined in the domains are valid.
		const domainsExist = domains && domains.length
		if (domainsExist) {
			if (!stageNames.length)
				throw new Error('Cannot provision domains if no stages are defined.')

			for (let i=0;i<domains.length;i++) {
				const d = domains[i]||{}
				if (!d.name)
					throw new Error(`Missing required 'name' in domains[${i}].name`)
				if (!d.stages || !d.stages.length)
					throw new Error(`Missing required 'name' in domains[${i}].stages`)
				const invalidStageIdx = d.stages.findIndex(s => {
					if (typeof(s) == 'string')
						return stageNames.indexOf(s) < 0
					else if (s.name)
						return stageNames.indexOf(s.name) < 0
					else
						return true
				})
				if (invalidStageIdx >= 0)
					throw new Error(`Stage '${d.stages[invalidStageIdx]}' located under domains[${i}].stages[${invalidStageIdx}] is not defined in the 'stages' property.`)
			}
		}


		const endpointConfiguration = type ? { types:type.toUpperCase() } : { types:'EDGE' }
		tags = tags || {}

		// Creates the REST Api. Doc: https://www.pulumi.com/registry/packages/aws/api-docs/apigateway/restapi/
		super(name, {
			name,
			description,
			endpointConfiguration,
			tags: {
				...tags,
				Name: name
			}
		}, {
			protect,
			dependsOn,
			parent
		})

		if (resources) {
			let _resources = resources
			if (resources['/'] && typeof(resources['/']) == 'object') {
				const { '/':rootMethods, ...rest } = resources
				_resources = { ...rootMethods, ...rest }
			}

			if (Object.keys(_resources).length) {
				// Creates an API Gateway role
				this.apiGatewayRole = new aws.iam.Role(name, {
					name,
					description: `IAM role for a ${name} API Gateway`,
					assumeRolePolicy: {
						Version: '2012-10-17',
						Statement: [{
							Action: 'sts:AssumeRole',
							Principal: {
								Service: 'apigateway.amazonaws.com', // tip: Use the command `npx get-principals` to find any AWS principal
							},
							Effect: 'Allow',
							Sid: ''
						}],
					},
					tags: {
						...tags,
						Name: name
					}
				}, {
					protect,
					dependsOn
				})

				const result = _createResourcesMethodsAndIntegrations({ 
					restApi: {
						id: this.id,
						name,
						executionArn: this.executionArn
					}, 
					apiGatewayRole: this.apiGatewayRole, 
					parentResource: {
						id: this.rootResourceId,
						name: '/',
						path: ''
					}, 
					resources: _resources,
					protect,
					tags
				})

				this.methods = result.methods
				this.resources = result.resources
				this.integrations = result.integrations
				this.integrationResponses = result.integrationResponses
				this.methodResponses = result.methodResponses
			}
		}

		const stageResourceNames = []
		if (stages.length) {
			this.stages = []
			for (let i=0;i<stages.length;i++) {
				const stageConfig = stages[i]
				const stageName = _sanitizeName(stageConfig.name)
				const stageResourceName = `${stageName}-${name}`
				if (!stageConfig.snapshot)
					throw new Error(`Missing required '${stageConfig.name}.snapshot' property`)
				if (!stageConfig.snapshot.version)
					throw new Error(`Missing required '${stageConfig.name}.snapshot.version' property`)

				// Creates the log group where the logs are sent. Doc: https://www.pulumi.com/docs/reference/pkg/aws/cloudwatch/loggroup/
				// This is a bit of a hack. We are anticipating that AWS would do that automatically in the background. 
				// However, because we cannot control this, the retention period would be set to NEVER EXPIRE. To control this setting,
				// we use the AWS naming convention to provision the Log Group ourselves in advance before the stage is created (this
				// order is guaranteed thanks to the 'dependsOn' option of the stage).
				const logGroupName = `loggroup-for-${stageResourceName}`
				const logsRetentionInDays = !stageConfig.cloudwatch
					? 0
					: stageConfig.cloudwatch.logsRetentionInDays||0
				const logGroup = new aws.cloudwatch.LogGroup(logGroupName, { 
					name: pulumi.interpolate `API-Gateway-Execution-Logs_${this.id}/${stageName}`,
					retentionInDays: logsRetentionInDays,
					tags: {
						...tags,
						Name: logGroupName
					}
				})

				// Creates a snapshot of the current API Gateway 
				const snapshotName = `snapshot-for-${stageResourceName}`
				const snapshot = new Snapshot(snapshotName, {
					restApiId: this.id,
					version: stageConfig.snapshot.version,
					description: stageConfig.snapshot.description
				}, {
					protect,
					dependsOn: [
						...(this.integrations||[]),
						...(this.integrationResponses||[])
					]
				})

				// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/apigateway/stage/
				const stage = new aws.apigateway.Stage(stageResourceName, {
					name: stageResourceName,
					deployment: snapshot.deploymentId,
					restApi: this.id,
					stageName,
					tags: {
						...tags,
						Name: stageName
					}
				}, {
					protect,
					dependsOn:[snapshot, logGroup]
				})

				stage.snapshot = snapshot
				stage.logGroup = logGroup

				if (stageConfig.cloudwatch) {
					const settingsName = `settings-for-${stageResourceName}`
					const settings = typeof(stageConfig.cloudwatch) == 'object' 
						? {
							metricsEnabled: stageConfig.cloudwatch.metrics,
							loggingLevel: stageConfig.cloudwatch.level || 'INFO',
							dataTraceEnabled: stageConfig.cloudwatch.fullRequestResponse
						} : {
							metricsEnabled: true,
							loggingLevel: 'INFO',
							dataTraceEnabled: false
						}

					// Enable logging on this stage. Doc: https://www.pulumi.com/registry/packages/aws/api-docs/apigateway/methodsettings/
					const stageSettings = new aws.apigateway.MethodSettings(settingsName, {
						name: settingsName,
						restApi: this.id,
						stageName: stage.stageName,
						methodPath: '*/*',
						settings,
						tags: {
							...tags,
							Name: settingsName
						}
					}, {
						protect
					})

					stage.settings = stageSettings
				}

				stageResourceNames.push({
					refName: stageConfig.name,
					name: stageResourceName,
					stageName
				})
				this.stages.push(stage)
			}
		}

		// Adds custom domain
		if (domainsExist) {
			this.domains = []
			for (let j=0;j<domains.length;j++) {
				const domainConfig = domains[j]
				const domainHash = crypto.createHash('sha1').update(domainConfig.name).digest('hex').substring(0,8)
				// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/acm/certificate/
				const certName = `cert-for-${domainHash}-${name}`
				const cert = new aws.acm.Certificate(certName, {
					name: certName,
					domainName: domainConfig.name,
					validationMethod: domainConfig.validationMethod || 'DNS',
					tags: {
						...tags,
						Name: certName
					}
				}, {
					protect,
					dependsOn: [...this.stages],
					provider: new aws.Provider('temp-provider', { region: 'us-east-1' })
				})

				// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/apigateway/domainname/
				const domainResourceName = `domain-for-${domainHash}-${name}`
				const domain = new aws.apigateway.DomainName(domainResourceName, {
					name: domainResourceName,
					certificateArn: cert.arn,
					domainName: domainConfig.name,
					tags: {
						...tags,
						Name: domainResourceName
					}
				}, {
					protect,
					dependsOn: [...this.stages]
				})

				const mappings = []
				for (let k=0;k<domainConfig.stages.length;k++) {
					const stage = domainConfig.stages[k]
					const [sName, basePath] = typeof(stage) == 'string' ? [stage] : [stage.name, stage.path]
					const stageResource = stageResourceNames.find(s => s.refName == sName)
					const mapName = `map-for-${domainHash}-${stageResource.name}`
					// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/apigateway/basepathmapping/
					mappings.push(new aws.apigateway.BasePathMapping(mapName, {
						name: mapName,
						restApi: this.id,
						stageName: stageResource.stageName,
						domainName: domain.domainName,
						basePath,
						tags: {
							...tags,
							Name: domainResourceName
						}
					}, {
						protect
					}))
				}

				domain.mappings = mappings

				this.domains.push(domain)
			}
		}
	}
}

class HttpApi extends aws.apigatewayv2.Api {
	constructor({ name, description }) {

		// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/apigatewayv2/api/
		super(name, {
			protocolType: 'HTTP',
			name,
			description
		})
	}
}

class WebSocketApi extends aws.apigatewayv2.Api {
	constructor({ name, description }) {

		// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/apigatewayv2/api/
		super(name, {
			protocolType: 'WEBSOCKET',
			routeSelectionExpression: '$request.body.action',
			name,
			description
		})
	}
}

/**
 * Enable Cloudwatch for the API Gateway service. This is a weird global design for each AWS account.
 * This is not enabled by default. 
 * 
 * WARNING: Use this method only once. If multiple stack use this method,
 * the last one overrides the previous ones. This means that if the last stack is destroyed, this setting
 * will also be destroed globally in the account, which will prevent the other stack to log their API Gateway
 * data to Cloudwatch.
 * 
 * @param	{Object}			tags		
 * @param	{Boolean}			protect	
 * 
 * @return	{Output<Account>}	account
 */
const enableCloudwatch = (name, options) => {
	// To enable CloudWatch logging on API Gateway, an IAM role with access to CloudWatch must be added to the 
	// singleton API Gateway account. This is a global setting.
	
	if (!name)
		throw new Error('Missing required argument \'name\'.')

	const { tags, protect } = options||{}

	// Creates an IAM role for allowing API Gateways to send logs to CloudWatch
	const accountRole = new aws.iam.Role(name, {
		name,
		assumeRolePolicy: JSON.stringify({
			Version: '2012-10-17',
			Statement: [{
				Sid: '',
				Effect: 'Allow',
				Principal: {
					Service: 'apigateway.amazonaws.com'
				},
				Action: 'sts:AssumeRole'
			}]
		}, null, '  '),
		tags: {
			...tags,
			Name: name
		}
	}, {
		retainOnDelete: true,
		protect
	})

	// Creates the policy that allows that role to access cloudwatch.
	const cloudwatchPolicyName = `allow-cloudwatch-for-${name}`
	const cloudwatchRolePolicy = new aws.iam.RolePolicy(cloudwatchPolicyName, {
		name: cloudwatchPolicyName,
		role: accountRole.id,
		policy: JSON.stringify({
			Version: '2012-10-17',
			Statement: [{
				Effect: 'Allow',
				Action: [
					'logs:CreateLogGroup',
					'logs:CreateLogStream',
					'logs:DescribeLogGroups',
					'logs:DescribeLogStreams',
					'logs:PutLogEvents',
					'logs:GetLogEvents',
					'logs:FilterLogEvents'
				],
				Resource: '*'
			}]
		}, null, '  '),
		tags: {
			...tags,
			Name: cloudwatchPolicyName
		}
	}, {
		retainOnDelete: true,
		protect
	})

	// Creates an account to configure attach the cloudwatch role to the any API Gateways. Doc: https://www.pulumi.com/registry/packages/aws/api-docs/apigateway/account/
	const account = new aws.apigateway.Account(name, {
		name,
		cloudwatchRoleArn: accountRole.arn,
		tags: {
			...tags,
			Name: name
		}
	}, {
		retainOnDelete: true,
		protect
	})

	account.config = {
		role: accountRole,
		policy: cloudwatchRolePolicy
	}

	return account
}

/**
 * 
 * @param	{Object}						restApi
 * @param	{String}							.name						e.g., 'my-rest-api'
 * @param	{Output<String>}					.id
 * @param	{Output<String>}					.executionArn
 * @param	{Output<Role>}					apiGatewayRole
 * @param	{Object}						parentResource
 * @param	{String}							.name						e.g., 'blog' or '/' to indicate the root resource.
 * @param	{Output<String>}					.id
 * @param	{Output<String>}					.path
 * @param	{Object}						resources					e.g., { '/':{...}, 'dogs':{...}, 'blog/tech':{...} }
 * @param	{Object}							.[name|methodName]		If name is '/', this means root resource.
 * @param	{Object}								.[methodName]		e.g., 'GET', 'POST'
 * @param	{[String]}									.contentTypes		Supported content types. Default ['application/json']
 * @param	{Object}									.headers			Defines the required headers.
 * @param	{Object}									.queryStrings		Defines the required query strings
 * @param	{Object}									.authorizer
 * @param	{Object}										.type		Valid values: 'NONE', 'CUSTOM', 'AWS_IAM', 'COGNITO_USER_POOLS'
 * @param	{Object}									.sns
 * @param	{Output<Topic>}									.topic		
 * @param	{Output<String>}									.arn	Required. 
 * @param	{String}										.region		Default is the Pulumi AWS region from the stack config
 * @param	{Object}									.sqs
 * @param	{String}										.region		Default is the Pulumi AWS region from the stack config
 * @param	{Object}									.http
 * @param	{String}										.region		Default is the Pulumi AWS region from the stack config
 * @param	{Object}									.http_proxy
 * @param	{String}										.region		Default is the Pulumi AWS region from the stack config
 * @param	{Object}									.s3
 * @param	{String}										.region		Default is the Pulumi AWS region from the stack config
 * @param	{Object}									.lambda
 * @param	{String}										.region		Default is the Pulumi AWS region from the stack config
 * @param	{Object}									.lambda_proxy
 * @param	{Output<Lambda>}								.lambda
 * @param	{Output<String>}									.name
 * @param	{Output<String>}									.invokeArn
 * @param	{String}										.region		Default is the Pulumi AWS region from the stack config
 * @param	{Object}									.kinesis
 * @param	{String}										.region		Default is the Pulumi AWS region from the stack config
 * @param	{Object}						tags		
 * @param	{Boolean}						protect	
 * 
 * @return {Object}							output
 * @return {[Output<Method>]}					.methods
 * @return {[Output<Resource>]}					.resources
 * @return {[Output<Integration>]}				.integrations
 * @return {[Output<IntegrationResponse>]}		.integrationResponses
 * @return {[Output<MethodResponse>]}			.methodResponses
 */
const _createResourcesMethodsAndIntegrations = ({ restApi, apiGatewayRole, parentResource, resources, tags, protect }) => {
	if (!restApi)
		throw new Error('Missing required argument \'restApi\'')
	if (!restApi.id)
		throw new Error('Missing required argument \'restApi.id\'')
	if (!restApi.name)
		throw new Error('Missing required argument \'restApi.name\'')
	if (typeof(restApi.name) != 'string')
		throw new Error(`Wrong argument exception. 'restApi.name' is expected to be a string. Found '${typeof(restApi.name)}' instead.`)
	if (!apiGatewayRole)
		throw new Error('Missing required argument \'apiGatewayRole\'')
	if (!parentResource)
		throw new Error('Missing required argument \'parentResource\'')
	if (!parentResource.id)
		throw new Error('Missing required argument \'parentResource.id\'')
	if (!parentResource.name)
		throw new Error('Missing required argument \'parentResource.name\'')
	if (typeof(parentResource.name) != 'string')
		throw new Error(`Wrong argument exception. 'parentResource.name' is expected to be a string. Found '${typeof(parentResource.name)}' instead.`)

	tags = tags || {}
	const parentResourcePrefix = parentResource.name == '/' ? '' : `${parentResource.name}-`

	const keys = Object.keys(resources||{})
	const [httpMethods, resourceNames] = keys.reduce((acc,k) => {
		acc[HTTP_METHODS.indexOf(k) >= 0 ? 0 : 1].push(k)
		return acc
	},[[],[]])

	const _methods = []
	const _resources = []
	const _integrations = []
	const _integrationResponses = []
	const _methodResponses = []

	// Adds all the verbs under this parentResource
	if (httpMethods.length) {
		for (let i=0;i<httpMethods.length;i++) {
			const httpMethod = httpMethods[i]
			const httpMethodConfig = resources[httpMethod]
			const methodName = _sanitizeName(`${parentResourcePrefix}${httpMethod}-${restApi.name}`)
			
			const integrationConfig = _getIntegrationConfig(httpMethodConfig)
			if (!integrationConfig)
				throw new Error(`Missing required integration config for method '${methodName}'.`)

			const authorizer = httpMethodConfig.authorizer
			// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/apigateway/method/
			const method = new aws.apigateway.Method(methodName, {
				name: methodName,
				authorization: !authorizer || !authorizer.type ? 'NONE' : authorizer.type,
				restApi: restApi.id,
				requestParameters: _getRequestParameters(httpMethodConfig),
				resourceId: parentResource.id,
				httpMethod,
				tags: {
					...tags,
					Name: methodName
				}
			}, {
				protect
			})

			_methods.push(method)
			const results = _createIntegrationsAndResponses({ 
				...integrationConfig,
				restApi,
				apiGatewayRole,
				name:methodName, 
				httpMethod,
				resourceId: parentResource.id,
				resourcePath: parentResource.path,
				resourcePrefix: parentResourcePrefix,
				tags,
				protect
			})
			_integrations.push(results.integration)
			_methodResponses.push(...results.methodResponses)
			_integrationResponses.push(...results.integrationResponses)
		}
	}
	
	if (resourceNames.length) {
		for (let i=0;i<resourceNames.length;i++) {
			const resourcePath = resourceNames[i]
			const resourceConfig = resources[resourcePath]
			if (resourceConfig && typeof(resourceConfig) == 'object') {
				const resourceParts = resourcePath.split('/').filter(x => x).map(x => x.trim())
				if (resourceParts.length) {
					const result = resourceParts.reduce((acc,pathPart) => {
						// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/apigateway/resource/
						const p = acc.path ? `${acc.path}-${pathPart}` : pathPart
						const resourceRef = _sanitizeName(`${parentResourcePrefix}${p}-${restApi.name}`)
						const resource = new aws.apigateway.Resource(resourceRef, {
							name: resourceRef,
							restApi: restApi.id,
							parentId: acc.parentResourceId,
							pathPart,
							tags: {
								...tags,
								Name: resourceRef
							}
						}, {
							protect
						})

						acc.path = p
						acc.parentResourceId = resource.id
						acc.parentResourcePath = resource.path
						acc.resources.push(resource)

						return acc
					}, { path:'', parentResourceId:parentResource.id, parentResourcePath: '', resources:[] })

					_resources.push(...result.resources)

					const nestedResults = _createResourcesMethodsAndIntegrations({
						restApi, 
						apiGatewayRole,
						parentResource: {
							id: result.parentResourceId,
							name: result.path,
							path: result.parentResourcePath
						},
						resources: resourceConfig,
						tags, 
						protect
					})

					_methods.push(...nestedResults.methods)
					_resources.push(...nestedResults.resources)
					_integrations.push(...nestedResults.integrations)
					_methodResponses.push(...nestedResults.methodResponses)
					_integrationResponses.push(...nestedResults.integrationResponses)
				}
			}
		}
	}

	return {
		methods: _methods,
		resources: _resources,
		integrations: _integrations,
		integrationResponses: _integrationResponses,
		methodResponses: _methodResponses
	}
}

const _sanitizeName = name => (name||'').toLowerCase().replace(/[^0-9a-z-_]/g,'')

/**
 * 
 * @param	{Object}	config
 * @param	{Object}		.headers			Defines the required headers.
 * @param	{Object}		.queryStrings		Defines the required query strings
 * 
 * @return	{Object}	requestParameters
 */
const _getRequestParameters = config => {
	const { headers, queryStrings } = config || {}
	if (!headers && !queryStrings)
		return

	let requestParameters
	if (headers && typeof(headers) == 'object')
		requestParameters = Object.keys(headers).reduce((acc,key) => {
			acc[`method.request.header.${key}`] = headers[key] ? true : false
			return acc
		}, {})
	if (queryStrings && typeof(queryStrings) == 'object')
		requestParameters = Object.keys(queryStrings).reduce((acc,key) => {
			acc[`method.request.querystring.${key}`] = queryStrings[key] ? true : false
			return acc
		}, {})

	return requestParameters
}

/**
 * Extract the integration config from the httpMethodConfig
 * 
 * @param	{Object}		httpMethodConfig
 * @param	{[String]}			.contentTypes			Supported content types. Default ['application/json']
 * @param	{String}			.passthroughBehavior	Valid values: 'WHEN_NO_MATCH' (default), 'WHEN_NO_TEMPLATES', 'NEVER'
 * @param	{Object}			.sns
 * @param	{Output<Topic>}			.topic		
 * @param	{Output<String>}			.arn	Required. 
 * @param	{String}				.region		Default is the Pulumi AWS region from the stack config
 * @param	{Object}			.sqs
 * @param	{String}				.region		Default is the Pulumi AWS region from the stack config
 * @param	{Object}			.http
 * @param	{String}				.region		Default is the Pulumi AWS region from the stack config
 * @param	{Object}			.http_proxy
 * @param	{String}				.region		Default is the Pulumi AWS region from the stack config
 * @param	{Object}			.s3
 * @param	{String}				.region		Default is the Pulumi AWS region from the stack config
 * @param	{Object}			.lambda
 * @param	{String}				.region		Default is the Pulumi AWS region from the stack config
 * @param	{Object}			.lambda_proxy
 * @param	{Output<Lambda>}		.lambda
 * @param	{Output<String>}			.name
 * @param	{Output<String>}			.invokeArn
 * @param	{String}				.region		Default is the Pulumi AWS region from the stack config
 * @param	{Object}			.kinesis
 * @param	{String}				.region		Default is the Pulumi AWS region from the stack config
 * 
 * @return	{Object}		config
 * @return	{String}			.type
 * @return	{Object}			.config
 * @return	{[String]}			.contentTypes
 */
const _getIntegrationConfig = httpMethodConfig => {
	if (!httpMethodConfig)
		return null
	const keys = Object.keys(httpMethodConfig)
	const type = INTEGRATION_TYPES.find(type => keys.indexOf(type) >= 0)

	if (!type)
		throw new Error(`Missing required integration config. Supported types: ${keys}.`)

	return { 
		config:httpMethodConfig[type], 
		type, 
		contentTypes: httpMethodConfig.contentTypes,
		passthroughBehavior: httpMethodConfig.passthroughBehavior 
	}
}

/**
 * @param	{Object}				restApi
 * @param	{String}					.name				e.g., 'my-rest-api'
 * @param	{Output<String>}			.id
 * @param	{Output<String>}			.executionArn
 * @param	{Output<Role>}			apiGatewayRole
 * @param	{String}				name	
 * @param	{String}				method					Valid values: 'DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'ANY'
 * @param	{String}				type					Valid values: 'sns', 'sqs', 'http', 'http_proxy', 's3', 'lambda', 'lambda_proxy', 'kinesis'
 * @param	{Object}				config					Config specific to the 'type'
 * @param	{[String]}				contentTypes			Supported content types. Default ['application/json']
 * @param	{String}				passthroughBehavior		Valid values: 'WHEN_NO_MATCH' (default), 'WHEN_NO_TEMPLATES', 'NEVER'
 * @param	{String}				resourcePrefix
 * @param	{Output<String>}		resourceId
 * @param	{Output<String>}		resourcePath
 * @param	{Object}				tags		
 * @param	{Boolean}				protect	
 * 
 * @return	{Object}				output
 * @return	{Output<Integration>}   	.integration
 * @return	{[Output<Integration>]}   	.integrationResponses
 * @return	{[Output<Integration>]}   	.methodResponses
 */
const _createIntegrationsAndResponses = input => {
	const { restApi, apiGatewayRole, type, config, contentTypes, passthroughBehavior, name, httpMethod, resourcePrefix, resourceId, resourcePath, protect } = input || {}

	if (!restApi)
		throw new Error('Missing required argument \'restApi\'')
	if (!restApi.id)
		throw new Error('Missing required argument \'restApi.id\'')
	if (!restApi.name)
		throw new Error('Missing required argument \'restApi.name\'')
	if (!apiGatewayRole)
		throw new Error('Missing required argument \'apiGatewayRole\'.')
	if (!apiGatewayRole.arn)
		throw new Error('Missing required argument \'apiGatewayRole.arn\'.')
	if (!name)
		throw new Error('Missing required argument \'name\'.')
	if (!httpMethod)
		throw new Error('Missing required argument \'httpMethod\'.')
	if (!resourceId)
		throw new Error('Missing required argument \'resourceId\'.')
	if (!type)
		throw new Error('Missing required argument \'type\'.')
	if (INTEGRATION_TYPES.indexOf(type) < 0)
		throw new Error(`Wrong argument exception. 'type' is expected to be one of those values: ${INTEGRATION_TYPES}. Found '${type}' instead.`)
	if (!config)
		throw new Error('Missing required argument \'config\'.')

	const tags = (input || {}).tags || {}

	const baseDef = {
		name,
		restApi: restApi.id,
		resourceId,
		httpMethod,
		tags: {
			...tags,
			Name: name
		}
	}

	if (!apiGatIntegrations[type])
		throw new Error(`'${type}' integration not supported yet. Coming soon...`)

	const { integration, integrationResponses, methodResponses } = apiGatIntegrations[type].create({ 
		...config, 
		baseDef, 
		restApi, 
		apiGatewayRole, 
		resourcePrefix, 
		resourcePath,
		contentTypes,
		passthroughBehavior,
		protect
	})

	return {
		integration,
		integrationResponses, 
		methodResponses
	}
}

module.exports = {
	RestApi,
	HttpApi,
	WebSocketApi,
	enableCloudwatch
}



