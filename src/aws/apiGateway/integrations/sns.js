/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')

const REGION = aws.config.region
const RESPONSE_CODES = [null,200,400,401,404] // null is the default response, which is 500

/**
 * Creates the SNS integration arguments.
 * 
 * @param	{Object}						baseDef
 * @param	{String}							.name,
 * @param	{Output<String>}					.restApi		REST api ID
 * @param	{Output<String>}					.resourceId
 * @param	{String}							.httpMethod
 * @param	{Object}							.tags
 * @param	{String}						resourcePrefix
 * @param	{String}						resourcePath
 * @param	{Output<Topic>}					topic
 * @param	{String}						region
 * @param	{Output<Role>}					apiGatewayRole
 * @param	{[type]} 						restApi
 * @param	{String}							.name				e.g., 'my-rest-api'
 * @param	{Output<String>}					.id
 * @param	{Output<String>}					.executionArn
 * 
 * @return	{Object}						output
 * @return	{Output<Integration>}				.integration
 * @return	{[Output<IntegrationResponse>]}		.integrationResponses
 * @return	{[Output<MethodResponse>]}			.methodResponses
 */
const create = ({ baseDef, restApi, topic, region, resourcePrefix, apiGatewayRole, protect }) => {
	if (!topic || !topic.arn)
		throw new Error('Missing required argument \'topic.arn\'. This argument is required when the integration type is \'sns\'.')

	// Configure the integration
	const def = {
		...baseDef,
		type: 'AWS',
		integrationHttpMethod: 'POST',
		credentials: apiGatewayRole.arn,
		uri: `arn:aws:apigateway:${region||REGION}:sns:path//`,
		requestParameters: {
			'integration.request.header.Content-Type': '\'application/x-www-form-urlencoded\''
		},
		requestTemplates: {
			'application/json': pulumi.interpolate `Action=Publish&TopicArn=$util.urlEncode('${topic.arn}')&Message=$util.urlEncode($input.body)`
		}
	}

	// Creates API Gateway policy to publish to SNS topic
	const apiGatewayPolicy = pulumi.output(topic.arn).apply(topicArn => {
		const snsPubPolicyName = `sns-pub-for-${baseDef.name}`
		const snsPubPolicy = new aws.iam.Policy(snsPubPolicyName, {
			name: snsPubPolicyName,
			description: `Allows REST Api Gateway method ${baseDef.name} to publish to SNS ${topicArn}`,
			path: '/',
			policy: JSON.stringify({
				Version: '2012-10-17',
				Statement: [{
					Action: [
						'sns:Publish'
					],
					Resource: topicArn,
					Effect: 'Allow'
				}]
			}),
			tags: {
				...(baseDef.tags||{}),
				Name: snsPubPolicyName
			}
		}, {
			protect,
			dependsOn: topic instanceof pulumi.Resource || topic instanceof pulumi.CustomResource
				? [topic] : undefined
		})

		return {
			policy: snsPubPolicy,
			roleAttachement: new aws.iam.RolePolicyAttachment(snsPubPolicyName, {
				role: apiGatewayRole.name,
				policyArn: snsPubPolicy.arn,
				tags: {
					...(baseDef.tags||{}),
					Name: snsPubPolicyName
				}
			}, {
				protect
			})
		}
	})

	// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/apigateway/integration/
	const integration = new aws.apigateway.Integration(def.name, def, {
		protect,
		dependsOn: [apiGatewayPolicy.roleAttachement]
	})

	const _createIntegrationResponses = _createResourceResponses({ restApi, resourcePrefix, resourceId:baseDef.resourceId, httpMethod:baseDef.httpMethod, integration, tags:baseDef.tags, protect })
	
	const [integrationResponses, methodResponses] = RESPONSE_CODES.reduce((acc, code) => {
		const resp = _createIntegrationResponses(code)
		acc[0].push(resp.integration)
		acc[1].push(resp.method)
		return acc
	}, [[],[]])

	return {
		integration,
		integrationResponses,
		methodResponses
	}
}

/**
 * 
 * @param	{Object}				restApi
 * @param	{String}					.name		e.g., 'my-rest-api'
 * @param	{Output<String>}			.id		
 * @param	{String}				resourcePrefix	
 * @param	{Output<String>}		resourceId		
 * @param	{Output<Integration>}	integration		The request integration 
 * @param	{String}				httpMethod	e.g., 'GET', 'POST'
 * @param	{Object}				tags			
 * @param	{Boolean}				protect	
 * 		
 * @return	{Function}
 */
const _createResourceResponses = ({ restApi, resourcePrefix, resourceId, httpMethod, integration, tags, protect }) => {
	if (!restApi)
		throw new Error('Missing required argument \'restApi\'')
	if (!restApi.id)
		throw new Error('Missing required argument \'restApi.id\'')
	if (!restApi.name)
		throw new Error('Missing required argument \'restApi.name\'')
	if (!resourceId)
		throw new Error('Missing required argument \'resourceId\'')
	if (!httpMethod)
		throw new Error('Missing required argument \'httpMethod\'')
	if (!integration)
		throw new Error('Missing required argument \'integration\'')
	if (!(integration instanceof pulumi.Resource || integration instanceof pulumi.CustomResource))
		throw new Error(`Wrong argument exception. 'integration' is expected to be of type 'pulumi.Resource' or 'pulumi.CustomResource'. Found '${typeof(integration)}' instead.`)

	const _createMethodName = code => `${resourcePrefix||''}resp-${code||'default'}-${restApi.name}`

	/**
	 *
	 * @param  {Number}							code		e.g., 401
	 * 
	 * @return {Object} 						output
	 * @return {Output<MethodResponse>} 			.method
	 * @return {Output<IntegrationResponse>} 		.integration	
	 */
	return code => {
		// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/apigateway/methodresponse/
		const methodName = _createMethodName(code)
		const method = new aws.apigateway.MethodResponse(methodName, {
			name: methodName,
			restApi: restApi.id,
			resourceId,
			httpMethod,
			statusCode: `${code||500}`,
			tags: {
				...(tags||{}),
				Name: methodName
			}
		}, {
			protect,
			dependsOn:[integration] // Need to wait until the integration is provisioned before creating the integration response
		})
		// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/apigateway/integrationresponse/
		const integrationResp = new aws.apigateway.IntegrationResponse(methodName, {
			name: methodName,
			restApi: restApi.id,
			resourceId,
			httpMethod,
			statusCode: method.statusCode,
			selectionPattern: code ? `${code}` : undefined,
			tags: {
				...(tags||{}),
				Name: methodName
			}
		}, {
			protect,
			dependsOn:[integration] // Need to wait until the integration is provisioned before creating the integration response
		})

		return {
			method,
			integration: integrationResp
		}
	}
}

module.exports = {
	create
}
