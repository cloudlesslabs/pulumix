/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

// Version: 0.0.8
// Full Pulumi AWS RDS API doc at https://www.pulumi.com/docs/reference/pkg/aws/rds/

require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const securityGroup = require('./securityGroup')
const { getDBcreds } = require('./utils')
const { resolve } = require('../utils')

/**
 * Create an AWS Aurora cluster. Doc: https://www.pulumi.com/docs/reference/pkg/aws/rds/cluster/
 * Resources:
 * 	1. RDS Security Group based on the 'ingress' content and the 'publicAccess' flag
 * 	2. RDS proxy Security Group based on the 'ingress' content and the 'publicAccess' flag
 * 	3. Subnet Group based on the 'subnetIds'.
 * 	4. DB Cluster & at least one DB Cluster instance (Number of instances depends on 'instanceNbr').
 * 	5. (Optional) IAM role for RDS proxy.
 * 	6. (Optional) IAM policy for RDS proxy.
 * 	7. (Optional) RDS proxy.
 * 	8. (Optional) RDS proxy target group.
 * 	9. (Optional) RDS proxy target.
 *
 * WARNING: If both an Aurora cluster and an RDS proxy are provisioned at the same time, the initial `pulumi up` will probably fail
 * with the following error: 
 * 		"registering RDS DB Proxy (xxxxxx/default) Target: InvalidDBInstanceState: DB Instance 
 * 		xxxxxxxxxx is in an unsupported state - CONFIGURING_LOG_EXPORTS, needs to be in [AVAILABLE, MODIFYING, BACKING_UP]"
 *
 * This is because the RDS target can only be created with DB instances that are running. Because the initial setup takes time,
 * the DB instance won't be running by the time the RDS target creation process starts. There is no other option to wait and run
 * `pulumi up` again later.
 * 
 * @param  {String}   		             name							DB name must begin with a letter and contain only alphanumeric characters						
 * @param  {String}   		             engine							Valid values: 'postgresql' or 'mysql'
 * @param  {String}   		             engineVersion					Optional. Default depends on the 'engine'
 * @param  {[String]} 		             availabilityZones				e.g., ['ap-southeast-2a', 'ap-southeast-2b', 'ap-southeast-2c']
 * @param  {String}   		             backupRetentionPeriod			Unit days. Default is 1 day.
 * @param  {String}   		             auth.masterUsername			Alphanumeric character and underscore.
 * @param  {String}   		             auth.masterPassword			Max length is 41 characters.
 * @param  {Output<String>}              auth.secretId					ARN of the secret in AWS secrets manager that contains the masterUsername and masterPassword
 * @param  {Number}   		             instanceNbr					Default 1.
 * @param  {String}   		             instanceSize					Default 'db.t2.small'.
 * @param  {String}  		             vpcId							Default null (i.e., default VPC).
 * @param  {[String]}  		             subnetIds						Default null. If exists, it is used to create a subnet group for the cluster.
 * @param  {String}  		             ingress[].protocol				e.g., 'tcp'
 * @param  {Number}  		             ingress[].fromPort				e.g., 3306
 * @param  {Number}  		             ingress[].toPort				e.g., 3306
 * @param  {[String]}  		             ingress[].cidrBlocks			e.g., ['0.0.0.0/0']
 * @param  {[String]}  		             ingress[].ipv6CidrBlocks		e.g., ['::/0']
 * @param  {[String]}  		             ingress[].securityGroups		e.g., ['sg-123455', 'sg-7654211']
 * @param  {[String]}  		             ingress[].rds					Default true. Determines whether this rule affects the RDS security group
 * @param  {[String]}  		             ingress[].proxy				Default true. Determines whether this rule affects the RDS security group
 * @param  {Boolean}  		             protect						Default false.
 * @param  {Boolean}  		             publicAccess					Default false.
 * @param  {Boolean}  		             cloudWatch						Default false.
 * @param  {Object|Boolean}  	         proxy							Default false. If true, the proxy uses the default settings.
 * @param  {Boolean}  		             proxy.enabled					Default true. 
 * @param  {Boolean}  		             proxy.subnetIds				Default 'subnetIds'.
 * @param  {Boolean}  		             proxy.logSQLqueries			Default false. Only turn this to true temporarily to debug as logging SQL queries could create security holes.
 * @param  {Number}  		             proxy.idleClientTimeout		Unit seconds. Default 1800 (30 min.)
 * @param  {Boolean}  		             proxy.requireTls				Default true.
 * @param  {Boolean}  		             proxy.iam						Default false. If true, the only way to connect to the proxy is via IAM (Creds are disabled)
 * @param  {Object}  		             tags
 * 
 * @return {Output<String>}              output.endpoint			
 * @return {Output<String>}              output.readerEndpoint		
 * @return {Output<String>}              output.proxyEnpoint		
 * @return {Number}              		 output.port	
 * @return {[Output<String>]}            output.instanceEndpoints		
 * @return {Output<Cluster>}             output.dbCluster	
 * @return {Output<SubnetGroup>}         output.subnetGroup
 * @return {Output<SecurityGroup>} 		 output.securityGroup
 * @return {[Output<SecurityGroupRule>]} output.securityGroupRules
 * @return {Output<Proxy>}     	         output.proxy.proxy
 * @return {Output<TargetGroup>}         output.proxy.targetGroup
 * @return {Output<Target>}              output.proxy.target	
 */
const createAurora = async ({ 
	name, 
	engine,
	engineVersion,
	availabilityZones, 
	backupRetentionPeriod, 
	auth,
	instanceNbr=1, 
	instanceSize='db.t2.small', 
	vpcId,
	subnetIds:_subnetIds,
	ingress,
	protect=false, 
	publicAccess=false,
	cloudWatch,
	proxy,
	tags
}) => {

	if (!name)
		throw new Error('Missing required \'name\' argument.')
	if (!engine)
		throw new Error('Missing required \'engine\' argument.')
	
	engine = engine.toLowerCase().trim()
	const proxyEnabled = proxy && proxy.enabled !== false
	
	if (engine != 'mysql' && engine != 'postgresql')
		throw new Error(`Wrong argument exception. 'engine' valid values are 'mysql' and 'postgresql'. Found '${engine}' instead.`)
	if (!availabilityZones || !availabilityZones.length)
		throw new Error('Missing required \'availabilityZones\' argument.')
	if (!auth)
		throw new Error('Missing required \'auth\' argument.')
	if (!auth.secretId && !auth.masterUsername)
		throw new Error('Missing required \'auth.masterUsername\' argument. Argument required when \'auth.secretId\' is not specified.')
	if (!auth.secretId && !auth.masterPassword)
		throw new Error('Missing required \'auth.masterPassword\' argument. Argument required when \'auth.secretId\' is not specified.')
	if (proxyEnabled) {
		if (!auth.secretId)
			throw new Error('Missing required \'auth.secretId\' argument. Argument required when the RDS proxy is on.')
		if (proxy.iam && proxy.requireTls === false)
			throw new Error('Invalid configuration. When IAM authentication is enabled on RDS proxy, the \'requireTls\' cannot be false.')
	}

	const subnetIds = !_subnetIds ? null : await resolve(_subnetIds)

	let { masterUsername, masterPassword } = auth
	const secretId = auth.secretId ? await resolve(auth.secretId) : null

	// Extract username and password from AWS secret manager and get the secret's ARN for the RDS proxy
	let secretArn
	if (secretId) {
		const { version, creds } = await getDBcreds(secretId)
		
		secretArn = version.arn
		masterUsername = creds.username
		masterPassword = creds.password
	}

	const dbEngine = `aurora-${engine}`
	const isMySql = engine == 'mysql'
	const dbPort = isMySql ? 3306 : 5432
	const logs = isMySql ? ['error', 'general', 'slowquery'] : ['postgresql'] 
	engineVersion = engineVersion || (isMySql ? '5.7.mysql_aurora.2.10.0' : '12.6')
	ingress = ingress || []
	tags = tags || {}

	// Sanitize the DB and cluster names.
	const dbName = name.toLowerCase().replace(/-/g,'_').replace(/[^a-z0-9_]/g,'') // removing invalid characters
	const clusterName = name.toLowerCase().replace(/[^a-z0-9-]/g,'') // removing invalid characters

	// Creates the RDS SG and optional the RDS Proxy SG
	const [rdsSecurityGroup, proxySecurityGroup] = await createSecurityGroups(clusterName, dbPort, vpcId, ingress, { publicAccess, proxyEnabled, tags })

	// Creates a subnet group (optional). Doc: https://www.pulumi.com/docs/reference/pkg/aws/rds/subnetgroup/
	const subnetGroupName = `${clusterName}-subnet-group`
	const subnetGroup = !subnetIds || !subnetIds.length ? undefined : new aws.rds.SubnetGroup(subnetGroupName, {
		subnetIds,
		tags: {
			...tags,
			Name: subnetGroupName
		}
	})

	// Creates the Aurora Cluster (doc: https://www.pulumi.com/docs/reference/pkg/aws/rds/cluster/)
	// MySQL engine versions: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraMySQL.Updates.Versions.html
	// PostgreSQL engine versions: aws rds describe-db-engine-versions --engine aurora-postgresql --query '*[].[EngineVersion]' --output text --region your-AWS-Region
	const dbCluster = new aws.rds.Cluster(clusterName, {
		availabilityZones,
		backupRetentionPeriod,
		clusterIdentifier: clusterName,
		databaseName: dbName, // DatabaseName must begin with a letter and contain only alphanumeric characters
		engine: dbEngine,
		engineVersion, // For PostgreSQL, the engineVersion is easier. It's simply the real version (e.g., 12.6)
		masterUsername,
		masterPassword,
		skipFinalSnapshot: true,
		enabledCloudwatchLogsExports: cloudWatch ? logs : undefined,
		preferredBackupWindow: '15:00-17:00', // time is UTC
		applyImmediately: true,
		vpcSecurityGroupIds: [rdsSecurityGroup.securityGroup.id], // Must be set to allow traffic based on the security group
		dbSubnetGroupName: subnetGroup ? subnetGroup.name : undefined,
		tags: {
			...tags,
			Name: clusterName
		}
	}, {
		protect
	})

	// Add instances to that cluster (doc: https://www.pulumi.com/docs/reference/pkg/aws/rds/clusterinstance/)
	const clusterInstances = []
	const clusterInstanceEndpoints = {}
	instanceNbr = !instanceNbr || instanceNbr < 0 ? 1 : instanceNbr
	for (let i = 0; i < instanceNbr; i++) {
		const idx = i+1
		const instanceName = `${clusterName}-instance-${idx}`
		const clusterInstance = new aws.rds.ClusterInstance(instanceName, {
			clusterIdentifier: dbCluster.id,
			engine: dbCluster.engine,
			engineVersion: dbCluster.engineVersion,
			identifier: instanceName,
			instanceClass: instanceSize,
			publiclyAccessible: publicAccess, // Allow the instance to be accessible outside of its associated VPC
			dbSubnetGroupName: subnetGroup ? subnetGroup.name : undefined,
			applyImmediately: true,
			tags: {
				...tags,
				Name: instanceName
			}
		}, {
			protect,
			parent: dbCluster
		})

		clusterInstanceEndpoints[`instance-${idx}-endpoint`] = clusterInstance.endpoint
		clusterInstances.push(clusterInstance)
	}

	// RDS Proxy:
	// 	- Proxy doc: https://www.pulumi.com/docs/reference/pkg/aws/rds/proxy/
	// 	- Proxy target group doc: https://www.pulumi.com/docs/reference/pkg/aws/rds/proxydefaulttargetgroup/
	// 	- Proxy target doc: https://www.pulumi.com/docs/reference/pkg/aws/rds/proxytarget/
	// 	- Proxy endpoint doc: https://www.pulumi.com/docs/reference/pkg/aws/rds/proxyendpoint/
	const proxyOutput = !proxyEnabled ? null : await (async () => {
		// IAM role. Doc: https://www.pulumi.com/docs/reference/pkg/aws/iam/role/
		const proxyRoleName = `${name}-rds-proxy`
		const proxyRole = new aws.iam.Role(proxyRoleName, {
			path: '/',
			assumeRolePolicy: JSON.stringify({
				Version: '2012-10-17',
				Statement: [{
					Action: 'sts:AssumeRole',
					Principal: {
						Service: 'rds.amazonaws.com'
					},
					Effect: 'Allow',
					Sid: ''
				}]
			}),
			tags: {
				...tags,
				Name: proxyRoleName
			}
		})
		// IAM policy doc: https://www.pulumi.com/docs/reference/pkg/aws/iam/policy/
		const secretsManagerPolicy = new aws.iam.Policy(proxyRoleName, {
			path: '/',
			description: 'IAM policy to allow the RDS proxy to get secrets from AWS Secret Manager',
			policy: JSON.stringify({
				Version: '2012-10-17',
				Statement: [{
					Action: [
						'secretsmanager:GetSecretValue'
					],
					Resource: secretArn,
					Effect: 'Allow'
				}]
			}),
			tags: {
				...tags,
				Name: proxyRoleName
			}
		})

		// Attach policy
		new aws.iam.RolePolicyAttachment(proxyRoleName, {
			role: proxyRole.name,
			policyArn: secretsManagerPolicy.arn
		})
		
		const proxySubnetIds = proxy.subnetIds || subnetIds || []
		if (!proxySubnetIds.length)
			throw new Error('Missing required \'proxy.subnetIds\'.')

		// RDS Proxy doc: https://www.pulumi.com/docs/reference/pkg/aws/rds/proxy/
		const rdsProxy = new aws.rds.Proxy(name, {
			name,
			roleArn: proxyRole.arn,
			engineFamily: isMySql ? 'MYSQL' : 'POSTGRESQL',
			vpcSubnetIds: proxySubnetIds,
			auths: [{
				authScheme: 'SECRETS',
				description: `Authentication method used to connect the RDS proxy ${name} to the Aurora cluster ${clusterName}`,
				iamAuth: proxy.iam ? 'REQUIRED' : 'DISABLED',
				secretArn
			}],
			debugLogging: proxy.logSQLqueries,
			idleClientTimeout: proxy.idleClientTimeout || 1800,
			requireTls: proxy.requireTls === false ? false : true,
			vpcSecurityGroupIds: [proxySecurityGroup.securityGroup.id], // Must be set to allow traffic based on the security group
			tags: {
				...tags,
				Name: name
			}
		})

		// RDS Proxy target group doc: https://www.pulumi.com/docs/reference/pkg/aws/rds/proxydefaulttargetgroup/
		const proxyTargetGroup = new aws.rds.ProxyDefaultTargetGroup(name, {
			dbProxyName: rdsProxy.name,
			connectionPoolConfig: {
				connectionBorrowTimeout: 120,
				maxConnectionsPercent: 100,
				maxIdleConnectionsPercent: 50
			},
			tags: {
				...tags,
				Name: name
			}
		})

		// RDS Proxy target doc: https://www.pulumi.com/docs/reference/pkg/aws/rds/proxytarget/
		const proxyTarget = new aws.rds.ProxyTarget(name, {
			dbClusterIdentifier: dbCluster.id,
			dbProxyName: rdsProxy.name,
			targetGroupName: proxyTargetGroup.name,
			tags: {
				...tags,
				Name: name
			}
		})

		return {
			proxy: leanifyProxy(rdsProxy),
			targetGroup: proxyTargetGroup,
			target: proxyTarget
		}
	})()

	return {
		endpoint: dbCluster.endpoint, // used for read-write connection string
		readerEndpoint: dbCluster.readerEndpoint, // used for read-only connection string
		proxyEnpoint: proxyOutput ? proxyOutput.proxy.endpoint : null,
		port: dbPort,
		instanceEndpoints: clusterInstanceEndpoints,
		dbCluster: leanifyDbCluster(dbCluster),
		subnetGroup,
		securityGroups: {
			rds: rdsSecurityGroup,
			proxy: proxySecurityGroup
		},
		proxy: proxyOutput
	}
}

const leanifyDbCluster = dbCluster => {
	/* eslint-disable */
	const { applyImmediately, masterPassword, tags, urn, tagsAll, ...rest } = dbCluster || {}	
	/* eslint-enable */
	return rest
}

const leanifyProxy = proxy => {
	/* eslint-disable */
	const { tags, urn, tagsAll, ...rest } = proxy || {}	
	/* eslint-enable */
	return rest
}

/**
 * Creates an RDS security group and optionally an RDS Proxy security group (if 'options.proxy' is true).
 * 
 * @param  {String}							clusterName
 * @param  {Number}							dbPort									e.g., 3306 for MySQL.
 * @param  {String}							vpcId
 * @param  {[Object]						ingress			
 * @param  {Boolean}						options.publicAccess					
 * @param  {Boolean}						options.proxyEnabled	
 * @param  {Object}							options.tags		
 * 
 * @return {Output<SecurityGroup>}			securityGroups[0].securityGroup			RDS security group		
 * @return {[Output<SecurityGroupRule>]}	securityGroups[0].securityGroupRules	RDS security group rules	
 * @return {Output<SecurityGroup>}			securityGroups[1].securityGroup			RDS proxy security group
 * @return {[Output<SecurityGroupRule>]}	securityGroups[1].securityGroupRules	RDS proxy security group rules		
 */
const createSecurityGroups = async (clusterName, dbPort, vpcId, ingress, options) => {
	const rdsIngress = (ingress||[]).filter(i => i.rds !== false )
	const proxyIngress = (ingress||[]).filter(i => i.proxy !== false )
	const { publicAccess, proxyEnabled, tags } = options
	const fromPort = dbPort
	const toPort = dbPort

	// Allow the to respond to any allowed request
	const egress = [{ 
		protocol: 'tcp', 
		fromPort,
		toPort,
		cidrBlocks: ['0.0.0.0/0'], 
		ipv6CidrBlocks: ['::/0'], 
		description:'Allows RDS systems to respond.' 
	}]

	// Allows the public internet to access the RDS cluster
	if (publicAccess) { 
		const allowPublic = { protocol: 'tcp', fromPort, toPort, cidrBlocks: ['0.0.0.0/0'], description: 'Allow public access' }
		rdsIngress.push(allowPublic)
		proxyIngress.push(allowPublic)
	}

	// Security group doc: https://www.pulumi.com/docs/reference/pkg/aws/ec2/securitygroup/
	const proxySecurityGroup = !proxyEnabled ? null : await securityGroup({
		name: `${clusterName}-rdsproxy-sg`, 
		description: `Controls the RDS proxy access for the Aurora cluster ${clusterName}.`, 
		vpcId, 
		ingress: proxyIngress, 
		egress, 
		tags
	})

	if (proxyEnabled) // Allows the proxy to access the RDS cluster and vice-versa
		rdsIngress.push({ protocol: 'tcp', fromPort, toPort, securityGroups:[proxySecurityGroup.securityGroup.id], description: 'Allow RDS proxy access to Aurora cluster' })
	
	// Security group doc: https://www.pulumi.com/docs/reference/pkg/aws/ec2/securitygroup/
	const rdsSecurityGroup = await securityGroup({ 
		name: `${clusterName}-rds-sg`,
		description: `Controls the Aurora cluster ${clusterName} access.`, 
		vpcId, 
		ingress: rdsIngress, 
		egress, 
		tags
	})

	return [
		rdsSecurityGroup,
		proxySecurityGroup
	]
}

module.exports = createAurora









