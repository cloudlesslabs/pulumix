/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

/*
 APIs:
 	- getDBcreds
 */

import aws from '@pulumi/aws'

/**
 * Gets the DB creds stored in AWS Secrets Manager
 * 
 * @param  {String}		secretId				ARN of the secret in AWS secrets manager that contains the masterUsername and masterPassword
 * 
 * @return {Version}	output.version
 * @return {String}		output.creds.username
 * @return {String}		output.creds.password
 */
export const getDBcreds = async secretId => {
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
	
	let creds = {}
	try {
		creds = JSON.parse(secretString)
	} catch(err) {
		throw new Error(`Faile to parse to JSON the secret string stored in secret ID '${secretId}'. Corrupted secret string: ${secretString}`)
	}

	if (!creds.username)
		throw new Error(`Missing required property 'username' in secret ID '${secretId}'.`)
	if (!creds.password)
		throw new Error(`Missing required property 'password' in secret ID '${secretId}'.`)

	return {
		version: secretVersion,
		creds
	}
}

