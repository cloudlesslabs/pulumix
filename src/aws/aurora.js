// Full Pulumi AWS RDS API doc at https://www.pulumi.com/docs/reference/pkg/aws/rds/

require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const securityGroup = require('./securityGroup')
const { resolve } = require('./utils')

/**
 * Create an AWS Aurora cluster. Doc: https://www.pulumi.com/docs/reference/pkg/aws/rds/cluster/
 * Resources:
 * 	1. Security Group based on the 'ingressRules' content, the 'publicAccess' and 'proxy' flag.
 * 	2. Subnet Group based on the 'subnetIds'.
 * 	3. DB Cluster & at least one DB Cluster instance (Number of instances depends on 'instanceNbr').
 * 	4. (Optional) IAM role for RDS proxy.
 * 	5. (Optional) IAM policy for RDS proxy.
 * 	6. (Optional) RDS proxy.
 * 	7. (Optional) RDS proxy target group.
 * 	8. (Optional) RDS proxy target.
 * 	
 * 
 * @param  {String}   		             name								DB name must begin with a letter and contain only alphanumeric characters						
 * @param  {String}   		             engine								Valid values: 'postgresql' or 'mysql'
 * @param  {String}   		             engineVersion						Optional. Default depends on the 'engine'
 * @param  {[String]} 		             availabilityZones					e.g., ['ap-southeast-2a', 'ap-southeast-2b', 'ap-southeast-2c']
 * @param  {String}   		             backupRetentionPeriod				Unit days. Default is 1 day.
 * @param  {String}   		             auth.masterUsername				Alphanumeric character and underscore.
 * @param  {String}   		             auth.masterPassword				Max length is 41 characters.
 * @param  {Output<String>}              auth.secretArn						ARN of the secret in AWS secrets manager that contains the masterUsername and masterPassword
 * @param  {Number}   		             instanceNbr						Default 1.
 * @param  {String}   		             instanceSize						Default 'db.t2.small'.
 * @param  {String}  		             vpcId								Default null (i.e., default VPC).
 * @param  {[String]}  		             subnetIds							Default null. If exists, it is used to create a subnet group for the cluster.
 * @param  {String}  		             ingressRules[].protocol			e.g., 'tcp'
 * @param  {Number}  		             ingressRules[].fromPort			e.g., 3306
 * @param  {Number}  		             ingressRules[].toPort				e.g., 3306
 * @param  {[String]}  		             ingressRules[].cidrBlocks			e.g., ['0.0.0.0/0']
 * @param  {[String]}  		             ingressRules[].ipv6CidrBlocks		e.g., ['::/0']
 * @param  {[String]}  		             ingressRules[].securityGroups		e.g., ['sg-123455', 'sg-7654211']
 * @param  {Boolean}  		             protect							Default false.
 * @param  {Boolean}  		             publicAccess						Default false.
 * @param  {Boolean}  		             cloudWatch							Default false.
 * @param  {Object|Boolean}  	         proxy								Default false. If true, the proxy uses the default settings.
 * @param  {Boolean}  		             proxy.enabled						Default true. 
 * @param  {Boolean}  		             proxy.subnetIds					Default 'subnetIds'.
 * @param  {Boolean}  		             proxy.logSQLqueries				Default false. Only turn this to true temporarily to debug as logging SQL queries could create security holes.
 * @param  {Number}  		             proxy.idleClientTimeout			Unit seconds. Default 1800 (30 min.)
 * @param  {Boolean}  		             proxy.requireTls					Default true.
 * @param  {Object}  		             tags
 * 
 * @return {Output<String>}              output.endpoint			
 * @return {Output<String>}              output.readerEndpoint		
 * @return {Output<String>}              output.proxyEnpoint	
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
	subnetIds,
	ingressRules,
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
	if (engine != 'mysql' && engine != 'postgresql')
		throw new Error(`Wrong argument exception. 'engine' valid values are 'mysql' and 'postgresql'. Found '${engine}' instead.`)
	if (!availabilityZones || !availabilityZones.length)
		throw new Error('Missing required \'availabilityZones\' argument.')
	if (!auth)
		throw new Error('Missing required \'auth\' argument.')
	if (!auth.secretArn && !auth.masterUsername)
		throw new Error('Missing required \'auth.masterUsername\' argument. Argument required when \'auth.secretArn\' is not specified.')
	if (!auth.secretArn && !auth.masterPassword)
		throw new Error('Missing required \'auth.masterPassword\' argument. Argument required when \'auth.secretArn\' is not specified.')
	if (proxy && !auth.secretArn)
		throw new Error('Missing required \'auth.secretArn\' argument. Argument required when the RDS proxy is on.')

	let { masterUsername, masterPassword } = auth
	const secretArn = auth.secretArn ? await resolve(auth.secretArn) : null

	// Extract username and password from AWS secret manager
	if (secretArn) {
		const secretVersion = await aws.secretsmanager.getSecretVersion({
			secretId: secretArn
		})
		const { secretString } = secretVersion || {}
		if (!secretString)
			throw new Error(`Secret value not found in secret '${secretArn}'.`)
		
		let secretObj = {}
		try {
			secretObj = JSON.parse(secretString)
		} catch(err) {
			throw new Error(`Faile to parse to JSON the secret string stored in secret '${secretArn}'. Corrupted secret string: ${secretString}`)
		}

		if (!secretObj.username)
			throw new Error(`Missing required property 'username' in secret '${secretArn}'.`)
		if (!secretObj.password)
			throw new Error(`Missing required property 'password' in secret '${secretArn}'.`)

		masterUsername = secretObj.username
		masterPassword = secretObj.password
	}

	const dbEngine = `aurora-${engine}`
	const isMySql = engine == 'mysql'
	const dbPort = isMySql ? 3306 : 5432
	const logs = isMySql ? ['error', 'general', 'slowquery'] : ['postgresql'] 
	engineVersion = engineVersion || (isMySql ? '5.7.mysql_aurora.2.10.0' : '12.6')
	ingressRules = ingressRules || []

	tags = tags || {}

	// Sanitize the DB and cluster names.
	const dbName = name.toLowerCase().replace(/-/g,'_').replace(/[^a-z0-9_]/g,'') // removing invalid characters
	const clusterName = `${name}-cluster`.toLowerCase().replace(/[^a-z0-9-]/g,'') // removing invalid characters

	if (publicAccess) // Allows the public internet to access the RDS cluster
		ingressRules.push({ protocol: 'tcp', fromPort: dbPort, toPort: dbPort, cidrBlocks: ['0.0.0.0/0'], description: 'Public access' })
	if (proxy) // Allows the proxy to access the RDS cluster and vice-versa
		ingressRules.push({ protocol: 'tcp', fromPort: dbPort, toPort: dbPort, self:true, description: 'Allow RDS proxy access to Aurora' })
	
	// Security group doc: https://www.pulumi.com/docs/reference/pkg/aws/ec2/securitygroup/
	const securityGroupOutput = await securityGroup({ 
		name: `${clusterName}-sg`, 
		description: `Controls the ${clusterName} Aurora/MySQL access`, 
		vpcId, 
		ingress: ingressRules, 
		egress: [{ 
			protocol: 'tcp', 
			fromPort: dbPort, 
			toPort: dbPort, 
			cidrBlocks: ['0.0.0.0/0'], 
			ipv6CidrBlocks: ['::/0'], 
			description:'Allows RDS systems to respond.' 
		}], 
		tags
	})
	const sgId = securityGroupOutput.securityGroup.id

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
		vpcSecurityGroupIds: [sgId], // Must be set to allow traffic based on the security group
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
	const proxyOutput = !proxy || proxy.enabled === false ? null : await (async () => {
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
		// IAM: Allow lambda to create log groups, log streams and log events.
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
			roleArn: proxyRole.arn,
			engineFamily: isMySql ? 'MYSQL' : 'POSTGRESQL',
			vpcSubnetIds: proxySubnetIds,
			auths: [{
				authScheme: 'SECRETS',
				description: `Authentication method used to connect the RDS proxy ${name} to the Aurora cluster ${clusterName}`,
				iamAuth: 'DISABLED',
				secretArn
			}],
			debugLogging: proxy.logSQLqueries,
			idleClientTimeout: proxy.idleClientTimeout || 1800,
			requireTls: proxy.requireTls === false ? false : true,
			vpcSecurityGroupIds: [sgId], // Must be set to allow traffic based on the security group
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
			proxy: rdsProxy,
			targetGroup: proxyTargetGroup,
			target: proxyTarget
		}
	})()

	return {
		endpoint: dbCluster.endpoint, // used for read-write connection string
		readerEndpoint: dbCluster.readerEndpoint, // used for read-only connection string
		proxyEnpoint: proxyOutput ? proxyOutput.proxy.endpoint : null,
		instanceEndpoints: clusterInstanceEndpoints,
		dbCluster,
		subnetGroup,
		...securityGroupOutput,
		proxy: proxyOutput
	}
}


module.exports = createAurora

