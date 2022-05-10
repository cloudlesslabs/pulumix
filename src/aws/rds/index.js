/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')

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
const createConnectPolicy = input => pulumi.output(input).apply(({ name, rdsArn, resourceId, username }) => {
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
})

module.exports = {
	...require('./aurora'),
	getUserDbArn,
	policy: {
		createConnectPolicy
	}
}




