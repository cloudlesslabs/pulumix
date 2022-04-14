/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

// Version: 0.0.5

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')

/**
 * Gets the DB creds stored in AWS Secrets Manager
 * 
 * @param  {String}		secretId				ARN of the secret in AWS secrets manager that contains the masterUsername and masterPassword
 * 
 * @return {Version}	output.version
 * @return {String}		output.creds.username
 * @return {String}		output.creds.password
 */
const DatabaseCredentials = function (secretId) {
	const _secretId = secretId && secretId.apply && typeof(secretId.apply) == 'function'
		? secretId
		: pulumi.output(secretId)

	const o = _secretId.apply(id => {
		if (!id)
			return null
		else
			return pulumi.output(aws.secretsmanager.getSecretVersion({ secretId:id }).catch(err => {
				throw new Error(`Fail to retrieve secret ID '${id}'. Details: ${err.message}`)
			})).apply(secretVersion => {
				if (!secretVersion)
					throw new Error(`Secret ID ${id} not found.`)

				const secretString = secretVersion.secretString
				if (!secretString)
					throw new Error(`Secret value not found in secret ID '${id}'.`)
				
				let creds = {}
				try {
					creds = JSON.parse(secretString)
				} catch(err) {
					throw new Error(`Faile to parse to JSON the secret string stored in secret ID '${id}'. Corrupted secret string: ${secretString}`)
				}

				if (!creds.username)
					throw new Error(`Missing required property 'username' in secret ID '${id}'.`)
				if (!creds.password)
					throw new Error(`Missing required property 'password' in secret ID '${id}'.`)

				return {
					username: creds.username,
					password: creds.password,
					version: secretVersion
				}
			})
	})

	this.username = o.username
	this.password = o.password
	this.version = o.version

	return this
}

module.exports = {
	DatabaseCredentials
}