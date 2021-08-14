/*
 * To create a secret with AWS secrets manager, you need to:
 * 		1. Create a new secret: https://www.pulumi.com/docs/reference/pkg/aws/secretsmanager/secret/
 * 		2. Create a new secret value (aka secret version): https://www.pulumi.com/docs/reference/pkg/aws/secretsmanager/secretversion/
 * 		3. (Optionally) Create a rotation lambda to rotate the secret value: https://www.pulumi.com/docs/reference/pkg/aws/secretsmanager/secretrotation/
 */

require('@pulumi/pulumi')
const aws = require('@pulumi/aws')

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
 * @param  {Output<String>} 		rotation.lambdaArn			
 * @param  {Number} 				rotation.rotationInterval	Unit days. Default 7 days. 
 * @param  {Object} 				tags			
 * 
 * @return {Output<Secret>} 		output.secret
 * @return {Output<secretVersion>} 	output.secretVersion
 * @return {Output<SecretRotation>} output.rotation			
 */
const createSecret = async ({ name, value, rotation, tags:_tags }) => {
	if (!name)
		throw new Error('Missing required \'name\' argument.')

	const tags = {
		...(_tags||{}),
		Name: name		
	}

	// Create the secret: https://www.pulumi.com/docs/reference/pkg/aws/secretsmanager/secret/
	const secretContainer = new aws.secretsmanager.Secret(name, { tags })

	// Create the secret: https://www.pulumi.com/docs/reference/pkg/aws/secretsmanager/secretversion/
	const secretVersion = new aws.secretsmanager.SecretVersion(name, {
		secretId: secretContainer.id,
		...serializeValue(value),
		tags
	})

	// Link a rotation lambda to this secret: https://www.pulumi.com/docs/reference/pkg/aws/secretsmanager/secretrotation/
	const secretRotation = !rotation || !rotation.lambdaArn ? null : new aws.secretsmanager.SecretRotation(name, {
		secretId: secretContainer.id,
		rotationLambdaArn: rotation.lambdaArn,
		rotationRules: {
			automaticallyAfterDays: rotation.rotationInterval || 7
		},
		tags
	})

	return {
		secret: secretContainer,
		secretVersion,
		rotation: secretRotation
	}
}

const serializeValue = value => {
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

module.exports = createSecret


