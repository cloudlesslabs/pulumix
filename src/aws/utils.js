// Version: 0.0.4

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')

/**
 * Converts an Output<T> to a Promise<T>
 * 
 * @param  {Output<T>||[Output<T>]} 	resource
 * @return {Promise<T>||Promise<[T]>}
 */
const resolve = resource => new Promise((next, fail) => {
	if (!resource)
		next(resource)
	try {
		if (Array.isArray(resource)) {
			if (resource.every(r => r.apply))
				pulumi.all(resource).apply(data => next(data))	
			else
				Promise.all(resource.map(r => resolve(r))).then(data => next(data)).catch(fail)
		} else if (resource.apply)
			resource.apply(data => next(data))
		else
			next(resource)
	} catch(err) {
		fail(err)
	}
})

/**
 * Gets the DB creds stored in AWS Secrets Manager
 * 
 * @param  {String}		secretId				ARN of the secret in AWS secrets manager that contains the masterUsername and masterPassword
 * 
 * @return {Version}	output.version
 * @return {String}		output.creds.username
 * @return {String}		output.creds.password
 */
const getDBcreds = async secretId => {
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

/**
 * Creates a new database user account arn based on an RDS's arn (RDS instance, RDS proxy or RDS Cluster).
 * Doc: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.IAMPolicy.html
 * 
 * @param  {String} rdsArn			e.g., 'arn:aws:rds:ap-southeast-2:1234:db-proxy:prx-123', 'arn:aws:rds:ap-southeast-2:1234:cluster:blabla', 'arn:aws:rds:ap-southeast-2:1234:db:blibli' 
 * @param  {String} resourceId		(Optional) Default resource name (1)
 * @param  {String} username		(Optional) Default '*'. Other examples: 'mark', 'peter'
 * 	
 * @return {String}	userDbArn		e.g., 'arn:aws:rds-db:ap-southeast-2:1234:dbuser:prx-123/*', 'arn:aws:rds-db:ap-southeast-2:1234:dbuser:cluster-1234/*' 
 *
 * (1) Only RDS proxy embeds its resource ID in its arn. This means that the 'resourceId' should not be provided when the 
 * 'rdsArn' is an RDS proxy. For all the other RDS resources (clusters and instances), the 'resourceId' is required. For 
 * an Aurora cluster, this resource is called 'clusterResourceId', while for an instance, it is 'dbiResourceId'.
 */
const getUserDbArn = ({ rdsArn, resourceId, username }) => {
	const [,,,region,account,,resourceName] = rdsArn.split(':')
	return `arn:aws:rds-db:${region}:${account}:dbuser:${resourceId||resourceName}/${username||'*'}`
}

/**
 * Creates a policy that allows the role to execute SQL queries on an RDS instance.
 * 
 * @param  {String}			name						
 * @param  {String}			rdsArn			e.g., 'arn:aws:rds:ap-southeast-2:1234:db-proxy:prx-123', 'arn:aws:rds:ap-southeast-2:1234:cluster:blabla', 'arn:aws:rds:ap-southeast-2:1234:db:blibli' 
 * @param  {String}			resourceId		(Optional) Default resource name (1)
 * @param  {String}			username		(Optional) Default '*'. Other examples: 'mark', 'peter'
 * 
 * @return {Output<Policy>}	policy	
 */
const createRdsConnectPolicy = ({ name, rdsArn, resourceId, username }) => {
	const userArn = getUserDbArn({ rdsArn, resourceId, username })
	// IAM policy doc: https://www.pulumi.com/docs/reference/pkg/aws/iam/policy/
	const executeRdsQueriesPolicy = new aws.iam.Policy(name, {
		name,
		path: '/',
		description: 'IAM policy to execute SQL query on RDS',
		policy: JSON.stringify({
			Version: '2012-10-17',
			Statement: [{
				Action: [
					'rds-db:connect'
				],
				Resource: userArn,
				Effect: 'Allow'
			}]
		})
	})

	return executeRdsQueriesPolicy
}

module.exports = {
	resolve,
	getDBcreds,
	getUserDbArn,
	createRdsConnectPolicy
}