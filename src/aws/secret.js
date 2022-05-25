/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

// Version: 0.0.2

/*
 * To create a secret with AWS secrets manager, you need to:
 * 		1. Create a new secret: https://www.pulumi.com/docs/reference/pkg/aws/secretsmanager/secret/
 * 		2. Create a new secret value (aka secret version): https://www.pulumi.com/docs/reference/pkg/aws/secretsmanager/secretversion/
 * 		3. (Optionally) Create a rotation lambda to rotate the secret value: https://www.pulumi.com/docs/reference/pkg/aws/secretsmanager/secretrotation/
 */

require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const { keepResourcesOnly } = require('../utils')

class Secret extends aws.secretsmanager.Secret {
	/**
	 * Create a upload a secret to AWS secrets manager. 
	 * Resources:
	 * 	1. Secret
	 * 	2. Secret version (i.e., the actual secret content)
	 * 	3. (Optional) Secret rotation if the 'rotation.lambdaArn' is provided.
	 * 
	 * @param  {String} 				name			
	 * @param  {Object} 				value						e.g., { username:'admin', password:'12345' }
	 * @param  {Object} 				rotation					Optional. If specified, the 'rotation.lambdaArn' is required.
	 * @param  {Output<String>} 			.lambdaArn			
	 * @param  {Number} 					.rotationInterval		Unit days. Default 7 days. 
	 * @param  {Object} 				tags			
	 * @param  {Output<Resource>}		parent
	 * @param  {Output<[Resource]>}		dependsOn
	 * @param  {Boolean}				protect									Default false.
	 * 
	 * @return {Output<Secret>} 			secret
	 * @return {Output<String>} 				.id
	 * @return {Output<String>} 				.name
	 * @return {Output<String>} 				.arn
	 * @return {Output<Object>} 				...
	 * @return {Output<secretVersion>} 			.secretVersion
	 * @return {Output<SecretRotation>} 		.rotation			
	 */
	constructor({ name, value, rotation, tags:_tags, protect, dependsOn, parent }) {
		if (!name)
			throw new Error('Missing required \'name\' argument.')

		const tags = {
			...(_tags||{}),
			Name: name		
		}

		// Create the secret: https://www.pulumi.com/docs/reference/pkg/aws/secretsmanager/secret/
		super(name, { tags })

		// Create the secret: https://www.pulumi.com/docs/reference/pkg/aws/secretsmanager/secretversion/
		const secretVersion = new aws.secretsmanager.SecretVersion(name, {
			secretId: this.id,
			..._serializeValue(value),
			tags
		}, { 
			protect, 
			dependsOn: keepResourcesOnly(dependsOn), 
			parent 
		})

		// Link a rotation lambda to this secret: https://www.pulumi.com/docs/reference/pkg/aws/secretsmanager/secretrotation/
		const secretRotation = !rotation || !rotation.lambdaArn ? null : new aws.secretsmanager.SecretRotation(name, {
			secretId: this.id,
			rotationLambdaArn: rotation.lambdaArn,
			rotationRules: {
				automaticallyAfterDays: rotation.rotationInterval || 7
			},
			tags
		}, { protect, dependsOn:[this] })

		this.secretVersion = secretVersion
		this.rotation = secretRotation
	}
	static get(...args) { return getSecret(...args) }
}

const _serializeValue = value => {
	if (value === null || value === undefined)
		return ''

	if (value instanceof Buffer)
		return { secretBinary:value }

	const t = typeof(value)
	if (t == 'object')
		return { secretString: value instanceof Date ? value.toISOString() : JSON.stringify(value) }
	else if (t == 'string')
		return { secretString: value }
	else 
		return { secretString: `${value}` }
}

/**
 * Gets the DB creds stored in AWS Secrets Manager
 * 
 * @param  {String}		secretId				ARN, name or ID of the secret in AWS secrets manager
 * 
 * @return {Version}	output.version
 * @return {Object}		output.data
 */
const getSecret = async secretId => {
	if (!secretId)
		return null

	const secretVersion = await aws.secretsmanager.getSecretVersion({ secretId }).catch(err => {
		throw new Error(`Fail to retrieve secret ID '${secretId}'. Details: ${err.message}`)
	})
	if (!secretVersion)
		throw new Error(`Secret ID ${secretId} not found.`)

	const secretString = secretVersion.secretString
	if (!secretString)
		throw new Error(`Secret value not found in secret ID '${secretId}'.`)
	
	let data = {}
	try {
		data = JSON.parse(secretString)
	} catch(err) {
		throw new Error(`Faile to parse to JSON the secret string stored in secret ID '${secretId}'. Corrupted secret string: ${secretString}`)
	}

	return {
		version: secretVersion,
		data
	}
}

module.exports = {
	Secret
}


