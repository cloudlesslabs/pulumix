/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

const aws = require('@pulumi/aws')

const DATA_SOURCE = { 
	lambda: { 
		typeName: 'AWS_LAMBDA', 
		configName: 'lambdaConfig' 
	}, 
	dynamodb: { 
		typeName: 'AMAZON_DYNAMODB', 
		configName: 'dynamodbConfig' 
	}, 
	opensearch: { 
		typeName: 'AMAZON_ELASTICSEARCH', 
		configName: 'elasticsearchConfig' 
	}, 
	http: { 
		typeName: 'HTTP', 
		configName: 'httpConfig' 
	}
}

/**
 * Creates an AWS AppSync GraphQL API. Doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/graphqlapi/
 * Resources:
 * 	1. IAM role.
 * 	2. (Optional) IAM Policy with the 'lambda:InvokeFunction' permission if 'resolver.lambdaArns' is defined.
 * 	2. GraphQL API.
 * 	
 * @param  {String}				name	
 * @param  {String}				description		
 * @param  {String}				schema							GraphQL schema	
 * @param  {[Output<String>]}	resolver.lambdaArns				Lambda ARNs. This is needed to create invoke policies
 * 
 * @param  {Object}				authConfig						Default { apiKey:true }
 * @param  {Boolean}				.apiKey						Default true if none of the other methods are enabled.
 * @param  {Boolean}				.iam
 * @param  {Object}					.cognito
 * @param  {Oupput<String>}				.userPoolId				Required.
 * @param  {Oupput<String>}				.appIdClientRegex
 * @param  {Oupput<String>}				.awsRegion
 * @param  {Object}					.oidc
 * @param  {Oupput<String>}				.issuer					Required.
 * @param  {Oupput<String>}				.clientId
 * @param  {Oupput<Number>}				.authTtl				Number of milliseconds a token is valid after being authenticated.
 * @param  {Oupput<Number>}				.iatTtl					Number of milliseconds a token is valid after being issued to a user.
 * @param  {String}				tags		
 * 				
 * @return {Output<GraphQLApi>}	output.api						The usual properties (i.e., id, arn, name)		
 * @return {Output<String>}		output.api.uris.GRAPHQL			HTTPS endpoint (e.g., 'https://1234.appsync-api.ap-southeast-2.amazonaws.com/graphql')
 * @return {Output<String>}		output.api.uris.REALTIME		Websocket endpoint for subscriptions (e.g., 'wss://1234.appsync-realtime-api.ap-southeast-2.amazonaws.com/graphql')
 * @return {Output<String>}		output.roleArn		
 *
 * (1) AuthConfig:
 * 		- type: Default ['API_KEY']. Valid values: 'API_KEY', 'AWS_IAM', 'AMAZON_COGNITO_USER_POOLS', 'OPENID_CONNECT' 
 * 		- openidConnectConfig: https://www.pulumi.com/docs/reference/pkg/aws/appsync/graphqlapi/#graphqlapiadditionalauthenticationprovideropenidconnectconfig
 * 		- userPoolConfig: https://www.pulumi.com/docs/reference/pkg/aws/appsync/graphqlapi/#graphqlapiadditionalauthenticationprovideruserpoolconfig 		
 */
const createApi = async ({ name, description, schema, resolver, authConfig, cloudwatch, tags }) => {
	tags = tags || {}
	const dependsOn = []
	
	if (!name)
		throw new Error('Missing required argument \'name\'.')
	
	const canonicalName = `${name}-appsync`
	// IAM role. Doc: https://www.pulumi.com/docs/reference/pkg/aws/iam/role/
	const appSyncRole = new aws.iam.Role(canonicalName, {
		name: canonicalName,
		description: `Role for AppSync '${name}'`,
		assumeRolePolicy: {
			Version: '2012-10-17',
			Statement: [{
				Action: 'sts:AssumeRole',
				Principal: {
					Service: 'appsync.amazonaws.com',
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

	// cloudwatch
	let logConfig
	if (cloudwatch) {
		logConfig = {
			cloudwatchLogsRoleArn: appSyncRole.arn,
			fieldLogLevel: 'ALL'
		}
		dependsOn.push(new aws.iam.RolePolicyAttachment(`${canonicalName}-cloudwatch`, {
			role: appSyncRole.name,
			policyArn: 'arn:aws:iam::aws:policy/service-role/AWSAppSyncPushToCloudWatchLogs'
		}))
	}

	// Creates a policy that allows to invoke Lambdas
	if (resolver && resolver.lambdaArns && resolver.lambdaArns.length) {
		if (resolver.lambdaArns.some(arn => typeof(arn) != 'string'))
			throw new Error('\'resolver.lambdaArns\' must be strings.')
		
		const invokeLambdaPolicy = new aws.iam.Policy(`${canonicalName}-invoke-lambdas`, {
			path: '/',
			description: `Allows AppSync API '${name}' to invoke AWS Lambdas`,
			policy: JSON.stringify({
				Version: '2012-10-17',
				Statement: [{
					Action: [
						'lambda:InvokeFunction'
					],
					Resource: resolver.lambdaArns,
					Effect: 'Allow'
				}]
			}),
			tags
		})
		dependsOn.push(new aws.iam.RolePolicyAttachment(`${canonicalName}-invoke-lambdas-attach`, {
			role: appSyncRole.name,
			policyArn: invokeLambdaPolicy.arn
		}))
	}

	// GraphQL API doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/graphqlapi/
	const graphQlApi = new aws.appsync.GraphQLApi(name, {
		name,
		description,
		...getAuth(authConfig),
		schema,
		logConfig,
		dependsOn,
		tags: {
			...tags,
			Name: name
		}
	})

	return {
		api: leanify(graphQlApi),
		roleArn: appSyncRole.arn
	}
}

/**
 * Creates an AppSync Resolver.
 * Resources:
 * 	1. AppSync data source.
 * 	2. AppSync resolver.
 * 
 * @param  {String} 		api.id			
 * @param  {String} 		api.roleArn		
 * @param  {String} 		name			
 * @param  {String} 		field									Query field or property field to be resolved (e.g., 'projects', 'name').	
 * @param  {String} 		type									e.g., 'Query', 'Mutation', 'Product', 'Person'.	
 * 
 * @param  {Output<String>} functionArn								(dataSource.type:'lambda')
 * @param  {Output<String>} tableName								(dataSource.type:'dynamodb')
 * @param  {Output<String>} useCallerCredentials					(dataSource.type:'dynamodb')	
 * @param  {Output<String>} region									(dataSource.type:'dynamodb','opensearch')	
 * @param  {Output<String>} endpoint								(dataSource.type:'opensearch','http')	
 * 
 * @param  {String} 		mappingTemplate.operation				(dataSource.type:'lambda') Optional. Valid values: 'Invoke' (default), 'BatchInvoke'
 * @param  {Object} 		mappingTemplate.payload					(dataSource.type:'lambda') Optional.
 * @return {String} 		mappingTemplate.responseTemplate		(dataSource.type:'lambda') Optional.
 * 
 * @param  {Object} 		tags									
 * @return {[type]}                    [description]
 */
const createResolver = async ({ api, name, field, type, functionArn, tableName, useCallerCredentials, region, httpEndpoint, openSearchEndpoint, mappingTemplate, tags }) => {
	tags = tags || {}
	const dataSource = getDataSource({ functionArn, tableName, useCallerCredentials, region, httpEndpoint, openSearchEndpoint })

	if (!api)
		throw new Error('Missing required argument \'api\'')
	if (!api.id)
		throw new Error('Missing required argument \'api.id\'')
	if (!api.roleArn)
		throw new Error('Missing required argument \'api.roleArn\'')
	if (!name)
		throw new Error('Missing required argument \'name\'')
	if (!field)
		throw new Error('Missing required argument \'field\'')
	if (!type)
		throw new Error('Missing required argument \'type\'')
	if (!dataSource)
		throw new Error('Missing required argument \'dataSource\'')
	if (!dataSource.type)
		throw new Error('Missing required argument \'dataSource.type\'')
	if (!dataSource.config)
		throw new Error('Missing required argument \'dataSource.config\'')
	if (!DATA_SOURCE[dataSource.type])
		throw new Error(`Data source type '${dataSource.type}' is not supported`)
	if (dataSource.type != 'lambda')
		throw new Error(`Data source type '${dataSource.type}' is not yet supported by @cloudlesslabs/pulumi-recipes`)

	// AppSync data source doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/datasource/
	const dataSourceName = `${name}-${dataSource.type}`.replace(/-/g,'_')
	const dataSourceConfig = getDataSourceConfig(dataSource)
	const _dataSource = new aws.appsync.DataSource(dataSourceName, {
		apiId: api.id,
		name: dataSourceName,
		description: `GraphQL ${dataSource.type} data source for API '${api.id}'.`,
		serviceRoleArn: api.roleArn,
		type: DATA_SOURCE[dataSource.type].typeName,
		...dataSourceConfig,
		tags: {
			...tags,
			Name: dataSourceName
		}
	})

	// AppSync resolver doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/resolver/
	const requestResponseTemplate = getRequestResponseTemplate(dataSource.type, mappingTemplate)
	const resolver = new aws.appsync.Resolver(name, {
		apiId: api.id,
		name: name,
		field: field,
		type: type,
		dataSource: _dataSource.name,
		...requestResponseTemplate
	})

	return {
		resolver: leanify(resolver),
		dataSource: leanify(_dataSource)
	}
}

/**
 * 
 * @param  {Object}				authConfig						Default { apiKey:true }
 * @param  {Boolean}				.apiKey						Default true if none of the other methods are enabled.
 * @param  {Boolean}				.iam
 * @param  {Object}					.cognito
 * @param  {Oupput<String>}				.userPoolId				Required.
 * @param  {Oupput<String>}				.appIdClientRegex
 * @param  {Oupput<String>}				.awsRegion
 * @param  {Object}					.oidc
 * @param  {Oupput<String>}				.issuer					Required.
 * @param  {Oupput<String>}				.clientId
 * @param  {Oupput<Number>}				.authTtl				Number of milliseconds a token is valid after being authenticated.
 * @param  {Oupput<Number>}				.iatTtl					Number of milliseconds a token is valid after being issued to a user.
 * 
 * @return {Object}				config
 * @return {String}					.authenticationType
 * @return {Object}					.openidConnectConfig
 * @return {String}						.issuer
 * @return {String}						.clientId
 * @return {Number}						.authTtl
 * @return {Number}						.iatTtl
 * @return {Object}					.userPoolConfig
 * @return {String}						.userPoolId
 * @return {String}						.appIdClientRegex
 * @return {String}						.awsRegion
 * @return {Object}					.additionalAuthenticationProviders[]
 * @return {String}						.authenticationType
 * @return {Object}						.openidConnectConfig
 * @return {String}							.issuer
 * @return {String}							.clientId
 * @return {Number}							.authTtl
 * @return {Number}							.iatTtl
 * @return {Object}						.userPoolConfig
 * @return {String}							.userPoolId
 * @return {String}							.appIdClientRegex
 * @return {String}							.awsRegion
 */
const getAuth = authConfig => {
	const { apiKey, iam, cognito, oidc } = authConfig || {}
	const { userPoolId, appIdClientRegex, awsRegion } = cognito || {}
	const { issuer, clientId, authTtl, iatTtl } = oidc || {}

	if (!apiKey && !iam && !cognito && !oidc)
		return { authenticationType:'API_KEY' }

	const authConfigs = []
	if (apiKey)
		authConfigs.push({ authenticationType:'API_KEY' })
	if (iam)
		authConfigs.push({ authenticationType:'AWS_IAM' })
	if (userPoolId)
		authConfigs.push({ 
			authenticationType:'AMAZON_COGNITO_USER_POOLS',
			userPoolConfig: {
				userPoolId, 
				appIdClientRegex, 
				awsRegion
			}
		})
	if (issuer)
		authConfigs.push({ 
			authenticationType:'OPENID_CONNECT',
			openidConnectConfig: {
				issuer, 
				clientId, 
				authTtl, 
				iatTtl
			}
		})

	const authConfiguration = !authConfigs || !authConfigs.length 
		? { authenticationType:'API_KEY' }
		: { 
			authenticationType:authConfigs[0].type, 
			openidConnectConfig:authConfigs[0].openidConnectConfig, 
			userPoolConfig:authConfigs[0].userPoolConfig,
			additionalAuthenticationProviders: authConfigs.length > 1 
				? authConfigs.slice(1).map(x => ({ authenticationType:x.type, userPoolConfig:x.userPoolConfig, openidConnectConfig:x.openidConnectConfig }))
				: undefined
		}

	return authConfiguration
}

/**
 * https://www.pulumi.com/docs/reference/pkg/aws/appsync/datasource/#inputs
 * 
 * @param  {String} type								Valid values: 'lambda', 'rds', 'http', 'dynamodb', 'opensearch'
 * @param  {Output<String>} config.functionArn			(type:'lambda')
 * @param  {Output<String>} config.tableName			(type:'dynamodb')
 * @param  {Output<String>} config.useCallerCredentials	(type:'dynamodb')	
 * @param  {Output<String>} config.region				(type:'dynamodb','opensearch')	
 * @param  {Output<String>} config.endpoint				(type:'opensearch','http')	
 * 
 * @return {Object}
 */
const getDataSourceConfig = ({ type, config }) => {
	const configName = DATA_SOURCE[type].configName
	if (type == 'lambda') {
		// doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/datasource/#datasourcelambdaconfig
		if (!config.functionArn)
			throw new Error('Missing required argument. When data source type is \'lambda\', \'config.functionArn\' is required.')
		return {
			[configName]: {
				functionArn: config.functionArn
			}
		}
	} else if (type == 'dynamodb') {
		// doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/datasource/#datasourcedynamodbconfig
		if (!config.tableName)
			throw new Error('Missing required argument. When data source type is \'dynamodb\', \'config.tableName\' is required.')
		return {
			[configName]: {
				tableName: config.tableName,
				region: config.region,
				useCallerCredentials: config.useCallerCredentials
			}
		}
	} else if (type == 'opensearch') {
		// doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/datasource/#datasourceelasticsearchconfig
		if (!config.endpoint)
			throw new Error('Missing required argument. When data source type is \'opensearch\', \'config.endpoint\' is required.')
		return {
			[configName]: {
				endpoint: config.endpoint,
				region: config.region
			}
		}
	} else if (type == 'http') {
		// doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/datasource/#datasourcehttpconfig
		if (!config.endpoint)
			throw new Error('Missing required argument. When data source type is \'http\', \'config.endpoint\' is required.')
		return {
			[configName]: {
				endpoint: config.endpoint
			}
		}
	} else
		throw new Error(`Data source type '${type}' is not supported`)
}

/**
 * 
 * @param  {String} type						Valid values: 'lambda', 'rds', 'http', 'dynamodb', 'opensearch'
 * @param  {String} template.operation			(type:'lambda') Optional. Valid values: 'Invoke' (default), 'BatchInvoke'
 * @param  {Object} template.payload			(type:'lambda') Optional.
 * @return {String} template.responseTemplate	(type:'lambda') Optional.
 * 
 * @return {String} requestTemplate				
 * @return {String} responseTemplate	
 */
const getRequestResponseTemplate = (type, template) => {
	if (type != 'lambda')
		throw new Error(`Data source type '${type}' is not yet supported by @cloudlesslabs/pulumi-recipes`)

	if (type == 'lambda')
		return getLambdaRequestResponseTemplate(template)
}

/**
 * Examples: 
 * 	- https://www.pulumi.com/docs/reference/pkg/aws/appsync/resolver/#example-usage
 * 	- https://docs.aws.amazon.com/appsync/latest/devguide/tutorial-lambda-resolvers.html
 * 
 * 
 * @param  {String} input.operation				Optional. Valid values: 'Invoke' (default), 'BatchInvoke'
 * @param  {Object} input.payload				Optional. e.g., { field: 'getProjects' }
 * @return {String} input.responseTemplate		Optional. 
 * 
 * @return {String} requestTemplate				(1)
 * @return {String} responseTemplate	
 *
 * (1)
 * 		{
 *   		version: '2017-02-28',
 *     		operation: 'Invoke',
 *       	payload: {
 *        		field: 'getProjects',
 *          	source: $utils.toJson($context.source)
 *          }
 *      }
 */
const getLambdaRequestResponseTemplate = input => {
	let { operation, payload, responseTemplate } = input || {}
	payload = payload || {}
	if (payload.source)
		throw new Error('\'source\' is a reserved payload property. It is reserved to contain \'$utils.toJson($context.source)\'.')
	if (payload.args)
		throw new Error('\'args\' is a reserved payload property. It is reserved to contain \'$utils.toJson($context.arguments)\'.')
	if (payload.identity)
		throw new Error('\'identity\' is a reserved payload property. It is reserved to contain \'$utils.toJson($context.identity)\'.')
	
	const requestTemplate = {
		version: '2017-02-28',
		operation: operation||'Invoke',
		payload: {
			...payload,
			source: '$utils.toJson($context.source)',
			args: '$utils.toJson($context.arguments)',
			identity: '$utils.toJson($context.identity)'
		}
	}
	
	const template = {
		requestTemplate: JSON.stringify(requestTemplate, null, '  ')
			.replace('"$utils.toJson($context.source)"','$utils.toJson($context.source)')
			.replace('"$utils.toJson($context.arguments)"','$utils.toJson($context.arguments)')
			.replace('"$utils.toJson($context.identity)"','$utils.toJson($context.identity)'),
	}

	if (responseTemplate)
		template.responseTemplate = responseTemplate
	
	return template
}

const leanify = resource => {
	/* eslint-disable */
	const { tags, urn, tagsAll, ...rest } = resource || {}	
	/* eslint-enable */
	return rest
}

/**
 * 
 * @param  {String} functionArn					
 * @param  {String} tableName					
 * @param  {String} useCallerCredentials					
 * @param  {String} region					
 * @param  {String} httpEndpoint					
 * @param  {String} openSearchEndpoint					
 * 
 * @return {String} config.type 
 * @return {Object} config.config
 */
const getDataSource = ({ functionArn, tableName, useCallerCredentials, region, httpEndpoint, openSearchEndpoint }) => {
	if (functionArn)
		return {
			type: 'lambda',
			config: {
				functionArn
			}
		}
	else if (tableName) 
		return {
			type: 'dynamodb',
			config: {
				tableName,
				region,
				useCallerCredentials
			}
		}
	else if (httpEndpoint)
		return {
			type: 'http',
			config: {
				endpoint: httpEndpoint
			}
		}
	else if (openSearchEndpoint)
		return {
			type: 'opensearch',
			config: {
				endpoint: openSearchEndpoint,
				region
			}
		}
	else
		return null
}

module.exports = {
	api: createApi,
	resolver: createResolver
}




