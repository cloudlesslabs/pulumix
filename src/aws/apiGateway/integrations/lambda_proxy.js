/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')

/**
 * Creates the Lambda Proxy integration arguments.
 * 
 * @param	{Object}						baseDef
 * @param	{String}							.name,
 * @param	{Output<String>}					.restApi			REST api ID
 * @param	{Output<String>}					.resourceId
 * @param	{String}							.httpMethod
 * @param	{Object}							.tags
 * @param	{String}						resourcePrefix
 * @param	{String}						resourcePath
 * @param	{String}						passthroughBehavior		Valid values: 'WHEN_NO_MATCH' (default), 'WHEN_NO_TEMPLATES', 'NEVER'
 * @param	{[String]}						contentTypes			Supported content types. Default ['application/json']
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
const create = ({ baseDef, lambda, restApi, protect, resourcePath }) => {
	if (!lambda || !lambda.invokeArn)
		throw new Error('Missing required argument \'lambda.invokeArn\'. This argument is required when the integration type is \'lambda_proxy\'.')
	if (!lambda || !lambda.name)
		throw new Error('Missing required argument \'lambda.name\'. This argument is required when the integration type is \'lambda_proxy\'.')

	// Configure the integration
	const def = {
		...baseDef,
		type: 'AWS_PROXY',
		integrationHttpMethod: 'POST',
		uri: lambda.invokeArn
	}

	const permissionName = `lambda-invoke-perm-for-${baseDef.name}`
	const invokePermission = new aws.lambda.Permission(permissionName, {
		name: permissionName,
		action: 'lambda:InvokeFunction',
		function: lambda.name,
		principal: 'apigateway.amazonaws.com',
		sourceArn: pulumi.interpolate `${restApi.executionArn}/*/${baseDef.httpMethod}${resourcePath||'/'}`
	})

	return {
		integration: new aws.apigateway.Integration(def.name, def, {
			protect,
			dependsOn: [invokePermission]
		}),
		integrationResponses:[],
		methodResponses:[]
	}
}

module.exports = {
	create
}
