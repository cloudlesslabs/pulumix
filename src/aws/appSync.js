/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const { parse } = require('graphql')
const { unwrap } = require('../utils')

class Api extends aws.appsync.GraphQLApi {
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
	 * @param  {Object}				resolver
	 * @param  {[Output<String>]}		.lambdaArns					Lambda ARNs. This is needed to create 'invoke' policies
	 * @param  {Object}				authConfig						Default { apiKey:true }
	 * @param  {Boolean}				.apiKey						Default true if none of the other methods are enabled.
	 * @param  {Boolean}				.iam
	 * @param  {Object}					.cognito
	 * @param  {Oupput<String>}				.userPoolId				Required.
	 * @param  {Oupput<String>}				.awsRegion				Required.
	 * @param  {Oupput<String>}				.appIdClientRegex
	 * @param  {Object}					.oidc
	 * @param  {Oupput<String>}				.issuer					Required.
	 * @param  {Oupput<String>}				.clientId
	 * @param  {Oupput<Number>}				.authTtl				Number of milliseconds a token is valid after being authenticated.
	 * @param  {Oupput<Number>}				.iatTtl					Number of milliseconds a token is valid after being issued to a user.
	 * @param  {String}				tags		
	 * @param  {Output<Resource>}	parent
	 * @param  {Output<[Resource]>}	dependsOn
	 * @param  {Boolean}			protect	
	 * 				
	 * @return {Output<GraphQLApi>}	api
	 * @return {Output<String>} 		.id
	 * @return {Output<String>} 		.arn
	 * @return {Output<Object>} 		...	
	 * @return {Output<Object>}			.uris
	 * @return {Output<String>}				.GRAPHQL			HTTPS endpoint (e.g., 'https://1234.appsync-api.ap-southeast-2.amazonaws.com/graphql')
	 * @return {Output<String>}				.REALTIME			Websocket endpoint for subscriptions (e.g., 'wss://1234.appsync-realtime-api.ap-southeast-2.amazonaws.com/graphql')
	 * @return {Output<String>}			.roleArn		
	 *
	 * (1) AuthConfig:
	 * 		- type: Default ['API_KEY']. Valid values: 'API_KEY', 'AWS_IAM', 'AMAZON_COGNITO_USER_POOLS', 'OPENID_CONNECT' 
	 * 		- openidConnectConfig: https://www.pulumi.com/docs/reference/pkg/aws/appsync/graphqlapi/#graphqlapiadditionalauthenticationprovideropenidconnectconfig
	 * 		- userPoolConfig: https://www.pulumi.com/docs/reference/pkg/aws/appsync/graphqlapi/#graphqlapiadditionalauthenticationprovideruserpoolconfig 		
	 */
	constructor(input) {
		return unwrap(input).apply(({ name, description, schema, resolver, authConfig, cloudwatch, tags, parent, dependsOn, protect }) => {
			tags = tags || {}
			dependsOn = dependsOn || []
			
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

			const _lambdaArns = (resolver||{}).lambdaArns || []

			return pulumi.all(_lambdaArns).apply(lambdaArns => {
				// Creates a policy that allows to invoke Lambdas
				if (lambdaArns && lambdaArns.length) {
					if (lambdaArns.some(arn => typeof(arn) != 'string'))
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
								Resource: lambdaArns,
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
				super(name, {
					name,
					description,
					..._getAuth(authConfig),
					schema,
					logConfig,
					tags: {
						...tags,
						Name: name
					}
				}, {
					protect,
					dependsOn,
					parent
				})

				this.roleArn = appSyncRole.arn
			})
		})
	}
}

class DataSource extends aws.appsync.DataSource {
	/**
	 * Create a new data source. Doc at https://www.pulumi.com/docs/reference/pkg/aws/appsync/datasource/
	 * 
	 * @param  {String}					name					Required
	 * @param  {Object}					api						Required
	 * @param  {Output<String>}				.id					Required
	 * @param  {Output<String>}				.roleArn			Required
	 * @param  {Output<String>}			functionArn						
	 * @param  {Output<String>}			tableName						
	 * @param  {Output<String>}			useCallerCredentials						
	 * @param  {Output<String>}			region						
	 * @param  {Output<String>}			httpEndpoint						
	 * @param  {Output<String>}			openSearchEndpoint						
	 * @param  {Object}					tags
	 * @param  {Output<Resource>}		parent
	 * @param  {Output<[Resource]>}		dependsOn
	 * @param  {Boolean}				protect	
	 * 						
	 * @return {Object}					dataSource
	 * @return {Output<String>}				.id
	 * @return {Output<String>}				.arn
	 * @return {Output<String>}				.name
	 * @return {Output<Object>}				.tags
	 */
	constructor({ name, api, functionArn, tableName, useCallerCredentials, region, httpEndpoint, openSearchEndpoint, tags, parent, dependsOn, protect }) {
		tags = tags || {}

		if (!name)
			throw new Error('Missing required argument \'name\'')
		if (!api)
			throw new Error('Missing required argument \'api\'')
		if (!api.id)
			throw new Error('Missing required argument \'api.id\'')
		if (!api.roleArn)
			throw new Error('Missing required argument \'api.roleArn\'')
		
		const config = _getDataSourceConfig({ functionArn, tableName, useCallerCredentials, region, httpEndpoint, openSearchEndpoint })

		// AppSync data source doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/datasource/
		const dataSourceName = `${name}-${config.name}`.replace(/[-\s]/g,'_')
		super(dataSourceName, {
			apiId: api.id,
			name: dataSourceName,
			description: `GraphQL '${config.name}' data source for API '${api.id}'.`,
			serviceRoleArn: api.roleArn,
			type: config.type,
			...config.value,
			tags: {
				...tags,
				Name: dataSourceName
			}
		}, {
			parent, 
			dependsOn, 
			protect
		})
	}
}

class Resolver extends aws.appsync.Resolver {
	/**
	 * Creates an AppSync Resolver.
	 * Resources:
	 * 	1. AppSync resolver.
	 * 
	 * @param  {String} 			api.id			
	 * @param  {String} 			api.roleArn		
	 * @param  {String} 			name			
	 * @param  {String} 			type					e.g., 'Query', 'Mutation', 'Product', 'Person'.	
	 * @param  {String} 			field					Query field or property field to be resolved (e.g., 'projects', 'name').	
	 * @param  {Output<DataSource>} dataSource				System that can be queried to retrieve or store data (e.g., Lambda, DynamoDB, HTTP, OpenSearch)
	 * @param  {String} 			mappingTemplate			VTL that maps a field request to a query to the data source.	
	 * @param  {String} 				.operation			(dataSource.type:'lambda') Optional. Valid values: 'Invoke' (default), 'BatchInvoke'
	 * @param  {Object} 				.payload			(dataSource.type:'lambda') Optional. Example: { field:'projects' }
	 * @param  {String} 				.responseTemplate	(dataSource.type:'lambda') Optional.
	 * @param  {Object} 			tags	
	 * @param  {Output<Resource>}	parent
	 * @param  {Output<[Resource]>}	dependsOn
	 * @param  {Boolean}			protect	
	 * 								
	 * @return {Object}				resolver
	 * @return {Output<String>}			.id
	 * @return {Output<String>}			.arn
	 * @return {Output<String>}			.name
	 * @return {Output<Object>}			.tags
	 */
	constructor({ name, api, type, field, dataSource, mappingTemplate, tags, parent, dependsOn, protect }) {
		tags = tags || {}
		
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

		// AppSync resolver doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/resolver/
		const requestResponseTemplate = _getRequestResponseTemplate(mappingTemplate)
		super(name, {
			apiId: api.id,
			name: name,
			field: field,
			type: type,
			dataSource: dataSource.name,
			...requestResponseTemplate,
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
 * Creates a single Lambda data source and many resolvers that forward requests to that lambda. How it works:
 * 1. Creates a new DataSource for the AppSync 'api' object using the lambda's ARN 'functionArn'.
 * 2. Extracts all the fields out of the GraphQL schema string 'schema.value' for the GraphQL types defined in 'schema.includes' (default: ['Query', 'Mutation', 'Subscription']).
 * 3. For each extracted field, create a new resolver which uses the data source created in step 1.
 * 
 * Doc:
 * 	- AppSync resolver doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/resolver/
 * 	- AppSync data source doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/datasource/
 * 
 * Resources:
 * 	1. AppSync data source.
 * 	2. AppSync resolvers.
 * 
 * @param  {String}				api.id			
 * @param  {String}				api.roleArn		
 * @param  {String}				name			
 * @param  {Object}				schema					
 * @param  {String}					.value				GraphQL schema string
 * @param  {[String]}				.includes			Default ['Query', 'Mutation', 'Subscription']. Examples: ['Query', 'Product', 'Person'].	
 * @param  {Output<String>}		functionArn	
 * @param  {Object}				tags	
 * 								
 * @return {Object}				output
 * @return {Output<DataSource>}		.dataSource
 * @return {[Output<Resolver>]}		.resolvers
 */
const createDataSourceResolvers = ({ name, api, schema, functionArn, tags }) => {
	tags = tags || {}
	
	if (!api)
		throw new Error('Missing required argument \'api\'')
	if (!api.id)
		throw new Error('Missing required argument \'api.id\'')
	if (!api.roleArn)
		throw new Error('Missing required argument \'api.roleArn\'')
	if (!name)
		throw new Error('Missing required argument \'name\'')
	if (!schema)
		throw new Error('Missing required argument \'schema\'')
	if (!schema.value)
		throw new Error('Missing required argument \'schema.value\'')
	if (!functionArn)
		throw new Error('Missing required argument \'functionArn\'')

	// 1. Creates a new DataSource
	const dataSource = new DataSource({ name, api, functionArn, tags })

	// 2. Extracts all the fields out of the GraphQL schema string
	const includes = schema.includes && schema.includes.length ? schema.includes : ['Query', 'Mutation', 'Subscription']
	const getTypeFields = _getSchemaTypeFields(schema.value)
	
	const typeFields = includes.reduce((acc,type) => {
		const fields = getTypeFields(type)
		if (fields && fields.length) 
			acc.push({ type, fields })
		return acc
	}, [])

	if (!typeFields.length)
		throw new Error(`Fields not found in schema for types ${includes}.`)

	// 3. For each extracted field, create a new resolver which uses the data source created in step 1.
	const resolvers = typeFields.reduce((acc, { type, fields }) => {
		acc.push(...fields.map(field => {
			// AppSync resolver doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/resolver/
			const resolverName = `${name}-${type}-${field}`
			const requestResponseTemplate = _getRequestResponseTemplate({ payload:{ field } })
			const resolver = new aws.appsync.Resolver(resolverName, {
				apiId: api.id,
				name: resolverName,
				field: field,
				type: type,
				dataSource: dataSource.name,
				...requestResponseTemplate,
				tags: {
					...tags,
					Name: resolverName
				}
			})

			return _leanify(resolver)
		}))
		return acc
	}, [])

	return {
		dataSource,
		resolvers
	}
}

/**
 * https://www.pulumi.com/docs/reference/pkg/aws/appsync/datasource/#inputs
 * 
 * @param  {String} type								Valid values: 'lambda', 'rds', 'http', 'dynamodb', 'opensearch'
 * @param  {Output<String>} functionArn				(type:'lambda')
 * @param  {Output<String>} tableName				(type:'dynamodb')
 * @param  {Output<String>} useCallerCredentials	(type:'dynamodb')	
 * @param  {Output<String>} region					(type:'dynamodb','opensearch')	
 * @param  {Output<String>} httpEndpoint			(type:'http')	
 * @param  {Output<String>} openSearchEndpoint		(type:'opensearch')	
 * 
 * @return {Object}			config
 * @return {String}				.name				friendly name
 * @return {String}				.type				Allowed values: 'AWS_LAMBDA', 'AMAZON_DYNAMODB', 'HTTP', 'AMAZON_ELASTICSEARCH'
 * @return {Object}				.value				Data source config
 */
const _getDataSourceConfig = ({ functionArn, tableName, useCallerCredentials, region, httpEndpoint, openSearchEndpoint }) => {
	if (functionArn)
		// doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/datasource/#datasourcelambdaconfig
		return {
			name: 'lambda',
			type: 'AWS_LAMBDA',
			value: {
				lambdaConfig: {
					functionArn
				}
			}
		}
	else if (tableName) 
		// doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/datasource/#datasourcedynamodbconfig
		return {
			name: 'dynamodb',
			type: 'AMAZON_DYNAMODB',
			value: {
				dynamodbConfig: {
					tableName,
					region,
					useCallerCredentials
				}
			}
		}
	else if (httpEndpoint)
		// doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/datasource/#datasourcehttpconfig
		return {
			name: 'http',
			type: 'HTTP',
			value: {
				httpConfig: {
					endpoint: httpEndpoint
				}
			}
		}
	else if (openSearchEndpoint)
		// doc: https://www.pulumi.com/docs/reference/pkg/aws/appsync/datasource/#datasourceelasticsearchconfig
		return {
			name: 'opensearch',
			type: 'AMAZON_ELASTICSEARCH',
			value: {
				elasticsearchConfig: {
					endpoint: openSearchEndpoint,
					region
				}
			}
		}
	else
		throw new Error('Data source type not found. Failed to create a data source based on the input arguments.')
}

/**
 * 
 * @param  {Object}				authConfig						Default { apiKey:true }
 * @param  {Boolean}				.apiKey						Default true if none of the other methods are enabled.
 * @param  {Boolean}				.iam
 * @param  {Object}					.cognito
 * @param  {Oupput<String>}				.userPoolId				Required.
 * @param  {Oupput<String>}				.awsRegion				Required.
 * @param  {Oupput<String>}				.appIdClientRegex
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
 * @return {String}						.defaultAction			Allowed values: 'DENY', 'ALLOW' (default)
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
const _getAuth = authConfig => {
	const { apiKey, iam, cognito, oidc } = authConfig || {}
	const { userPoolId, appIdClientRegex, awsRegion, defaultAction } = cognito || {}
	const { issuer, clientId, authTtl, iatTtl } = oidc || {}

	if (!apiKey && !iam && !cognito && !oidc)
		return { authenticationType:'API_KEY' }

	let authConfigs = []
	let userPoolAuthConfig
	if (apiKey)
		authConfigs.push({ authenticationType:'API_KEY' })
	if (iam)
		authConfigs.push({ authenticationType:'AWS_IAM' })
	if (userPoolId) {
		if (!awsRegion)
			throw new Error('Missing required \'authConfig.cognito.awsRegion\'. This property is required when the \'authConfig.cognito\' is configured.')
		
		userPoolAuthConfig = { 
			authenticationType:'AMAZON_COGNITO_USER_POOLS',
			userPoolConfig: {
				userPoolId, 
				appIdClientRegex, 
				awsRegion,
				defaultAction: defaultAction || 'ALLOW'
			}
		}
	}
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

	if (userPoolAuthConfig)
		authConfigs = [userPoolAuthConfig, ...authConfigs]

	const authConfiguration = !authConfigs || !authConfigs.length 
		? { authenticationType:'API_KEY' }
		: { 
			authenticationType:authConfigs[0].authenticationType, 
			openidConnectConfig:authConfigs[0].openidConnectConfig, 
			userPoolConfig:authConfigs[0].userPoolConfig,
			additionalAuthenticationProviders: authConfigs.length > 1 
				? authConfigs.slice(1).map(x => ({ authenticationType:x.authenticationType, userPoolConfig:x.userPoolConfig, openidConnectConfig:x.openidConnectConfig }))
				: undefined
		}

	return authConfiguration
}

/**
 * 
 * @param  {String} template.operation			(type:'lambda') Optional. Valid values: 'Invoke' (default), 'BatchInvoke'
 * @param  {Object} template.payload			(type:'lambda') Optional.
 * @return {String} template.responseTemplate	(type:'lambda') Optional.
 * 
 * @return {String} requestTemplate				
 * @return {String} responseTemplate	
 */
const _getRequestResponseTemplate = (template) => {
	// Only supported template is Lambda. More coming soon...
	return _getLambdaRequestResponseTemplate(template)
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
const _getLambdaRequestResponseTemplate = input => {
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
			identity: '$utils.toJson($context.identity)',
			info: '$utils.toJson($context.info)',
			request: '$utils.toJson($context.request)'
		}
	}
	
	const template = {
		requestTemplate: JSON.stringify(requestTemplate, null, '  ')
			.replace('"$utils.toJson($context.source)"','$utils.toJson($context.source)')
			.replace('"$utils.toJson($context.arguments)"','$utils.toJson($context.arguments)')
			.replace('"$utils.toJson($context.identity)"','$utils.toJson($context.identity)')
			.replace('"$utils.toJson($context.info)"','$utils.toJson($context.info)')
			.replace('"$utils.toJson($context.request)"','$utils.toJson($context.request)')
	}

	if (responseTemplate)
		template.responseTemplate = responseTemplate
	
	return template
}

const _leanify = resource => {
	/* eslint-disable */
	const { tags, urn, tagsAll, ...rest } = resource || {}	
	/* eslint-enable */
	return rest
}

/**
 * High-order function that gets the fields of a graphql type.
 * 
 * @param  {String} schema		GraphQL string schema
 * @return {Function}
 */
const _getSchemaTypeFields = schema => {
	if (!schema)
		return () => null

	const astDocument = parse(schema)
	if (!astDocument || !astDocument.definitions || !astDocument.definitions.length)
		return () => null
	
	/**
	 * Gets the fields of a type.
	 * 
	 * @param  {String}		type	e.g., 'Query', 'Mutation', 'Product', 'User'
	 * 
	 * @return {[String]}	fields	e.g., ['projects', 'folders']
	 */
	return type => {
		if (!type)
			return null

		const ast = astDocument.definitions.find(d => d && d.kind == 'ObjectTypeDefinition' && d.name && d.name.kind == 'Name' && d.name.value == type)
		if (!ast || !ast.fields)
			return null
		
		const fields = ast.fields.filter(f => f && f.kind == 'FieldDefinition' && f.name && f.name.kind == 'Name' && f.name.value).map(f => f.name.value)
		return fields
	}
}

module.exports = {
	Api,
	Resolver,
	DataSource,
	createDataSourceResolvers
}




