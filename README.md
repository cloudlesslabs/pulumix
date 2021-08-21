# PULUMI RECIPES

> __Pulumi guide__: To learn more about Pulumi, please refer to https://gist.github.com/nicolasdao/830fc1d1b6ce86e0d8bebbdedb2f2626.
> __IAM roles & policies__: Managing AWS resources almost always involves managing IAM roles and policies. For a quick recap on that topic, please refer to this document: https://gist.github.com/nicolasdao/830fc1d1b6ce86e0d8bebbdedb2f2626#iam-recap.

### AWS dependencies

```
npm i @pulumi/pulumi @pulumi/aws @pulumi/awsx
```

### GCP dependencies

```
npm i @pulumi/pulumi @pulumi/gcp
```

# Table of contents

> * [Pulumi](#pulumi)
>	- [Cross referencing stacks](#cross-referencing-stacks)
> * [Helper methods](#helper-methods)
>	- [Resolving `Output<T>`](#resolving-outputt)
> * [Docker](#docker)
>	- [Pushing a new Docker image to a registry](#pushing-a-new-docker-image-to-a-registry)
>		- [Google Cloud Container Registry basic example](#google-cloud-container-registry-basic-example)
>		- [Passing environment variables to the Docker image rather than the Docker container](#passing-environment-variables-to-the-docker-image-rather-than-the-docker-container)
> * [NPM `package.json` scripts](#npm-packagejson-scripts)
>	- [Core scripts](#core-scripts)
>	- [AWS scripts](#aws-scripts)
> * [Automation API](#automation-api)
>	- [Setting it up in Docker](#setting-it-up-in-docker)
> * [AWS](#aws)
>	- [Aurora](#aurora)
>		- [Basic usage](#aurora---basic-usage)
>		- [Grant access to EC2 instance](#grant-access-to-ec2-instance)
>		- [Add RDS proxy](#add-rds-proxy)
>			- [RDS proxy setup](#rds-proxy-setup)
>			- [Enabling RDS proxy](#enabling-rds-proxy)
>			- [Setting up a Lambda to be able to access the RDS proxy when IAM is turned on](#setting-up-a-lambda-to-be-able-to-access-the-rds-proxy-when-iam-is-turned-on)
>				- [Using AWS Signer to create a DB password](#using-aws-signer-to-create-a-db-password)
>				- [Configure a `rds-db:connect` action on the IAM role](#configure-a-rds-dbconnect-action-on-the-iam-role)
>		- [Using AWS Secrets Manager to manage Aurora's credentials](#using-aws-secrets-manager-to-manage-auroras-credentials)
>	- [EC2](#ec2)
>	- [EFS](#efs)
>		- [Mounting an EFS access point on a Lambda](#mounting-an-efs-access-point-on-a-lambda)
>	- [Lambda](#lambda)
>		- [A few words about AWS Lambda](#a-few-words-about-aws-lambda)
>		- [The simplest API Gateway with Lambda](#the-simplest-api-gateway-with-lambda)
>		- [Example - Basic Lambda with an API Gateway](#example---basic-lambda-with-an-api-gateway)
>		- [Example - Configuring CloudWatch](#example---configuring-cloudwatch)
>		- [Example - Lambda with container](#example---lambda-with-container)
>			- [code](#example---lambda-with-container-code)
>			- [Setting up environment variables and passing arguments](#setting-up-environment-variables-and-passing-arguments)	
>		- [Example - Lambda with EFS](#example---lambda-with-efs)
>	- [Secret](#secret)
>		- [Getting stored secrets](#getting-stored-secrets)
>	- [Security Group](#security-group)
>	- [Step-function](#step-function)
>	- [VPC](#vpc)
> * [GCP](#gcp)
>	- [Buckets](#buckets)
>	- [Enable services](#enable-services)
>		- [Standard GCP services](#standard-gcp-services)
>		- [Firebase service](#firebase-service)
>		- [Identity Platform service](#identity-platform-service)
>	- [Cloud Run](#cloud-run)
>		- [Basic Cloud Run example](#basic-cloud-run-example)
>		- [Setting up public HTTPS access](#setting-up-public-https-access)
>		- [Congiguring service-to-service communication](#congiguring-service-to-service-communication)
>	- [Identity Platform](#identity-platform)
>	- [Service Accounts](#service-accounts)
> * [Troubleshooting](#troubleshooting)
>	- [AWS](#aws-troubleshooting)
>		- [Terminal utilities are failing with timeout errors `ETIMEDOUT`](#terminal-utilities-are-failing-with-timeout-errors-etimedout)
>		- [AWS Lambda cannot access the public internet](#aws-lambda-cannot-access-the-public-internet)
>		- [`failed to create '/home/sbx_userxxxx/.pulumi'`](#failed-to-create-homesbx_userxxxxpulumi)
> * [Annexes](#annexes)
> * [References](#references)

# Pulumi
## Cross referencing stacks

```js
const yourStack = new pulumi.StackReference('your-stack-name')
```

The `yourStack` object is similar to this:

```js
{
	id: 'some-string',
	name: 'some-string',
	outputs: {
		'aurora-endpoint': 'some-string',
		'aurora-readonly-endpoint': 'some-string',
		'instance-1-endpoint': 'some-string',
		'private-bucket': 'some-string',
		'public-file-bucket': 'some-string',
		services: [
				'some-string',
				'some-string',
				'some-string',
				'some-string'
		]
	},
	urn: 'some-string'
}
```

Outputs cannot be accessed explicitly. Instead, you must use the __`getOutput`__ method:

```js
const endpoint = yourStack.getOutput('aurora-endpoint')
```

# Helper methods
## Resolving `Output<T>`

To know more about the issue this helper fixes, please refer to this document: https://gist.github.com/nicolasdao/830fc1d1b6ce86e0d8bebbdedb2f2626#the-outputt-type-the-pulumiinterpolate-and-apply-functions

```js
const pulumi = require('@pulumi/pulumi')

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

module.exports = {
	resolve
}
```

Use this helper as follow:

```js
const getAvailabilityZones = async () => {
	const [subnetsA, subnetsB] = await resolve([vpc.publicSubnets, vpc.privateSubnets])
	const subnets = [...subnetsA, ...subnetsB]
	const azs = []
	for (let i=0;i<subnets.length;i++) {
		const subnet = subnets[i].subnet
		const az = await resolve(subnet.availabilityZone)
		if (azs.indexOf(az) < 0)
			azs.push(az)
	}

	return azs
}
```

# Docker
## Pushing a new Docker image to a registry
### Google Cloud Container Registry basic example
Please refer to the [Google Cloud Run](#cloud-run) example. 

### Passing environment variables to the Docker image rather than the Docker container

The previous link shows how to pass environment variables to the container, which is the best practice when it comes to create flexible and reusable Docker images. It's also better from a security standpoint as you adding secrets in an image could lead to secrets leaking. However, there are scenarios where the image might have to be configured based on specific environment variables. The following code snippet demonstrates how to leverage the native `--build-arg` option in the `docker build` command to achieve that:

```js
const pulumi = require('@pulumi/pulumi')
const gcp = require('@pulumi/gcp')
const docker = require('@pulumi/docker')

const config = new pulumi.Config()

const gcpAccessToken = pulumi.output(gcp.organizations.getClientConfig({}).then(c => c.accessToken))

// Uploads new Docker image with your app to Google Cloud Container Registry (doc: https://www.pulumi.com/docs/reference/pkg/docker/image/)
const dockerImage = new docker.Image('your-image', {
	imageName: pulumi.interpolate`gcr.io/${gcp.config.project}/your-app:v1`,
	build: {
		context: './app',
		extraOptions: [
			'--build-arg',
			`DB_USER='${process.env.DB_USER}'`,
			'--build-arg',
			`DB_PASSWORD='${process.env.DB_PASSWORD}'`
		]
	},
	registry: {
		server: 'gcr.io',
		username: 'oauth2accesstoken',
		password: pulumi.interpolate`${gcpAccessToken}`
	}
})
```

This method means that the `Dockerfile` must also define those variables:
```yaml
FROM node:12-slim
ARG DB_USER
ARG DB_PASSWORD
# ...
```

# NPM `package.json` scripts
## Core scripts

```js
{
	"scripts": {
		"up": "func() { pulumi up -s $1 -y; }; func",
		"prev": "func() { pulumi preview -s $1; }; func",
		"out": "func() { pulumi stack output -s $1; }; func",
		"refresh": "func() { pulumi refresh -s lineup/$1 -y; }; func",
		"blast": "func() { pulumi destroy -s $1; }; func",
		"import": "func() { pulumi stack export -s $1 > stack.json; }; func",
		"export": "func() { pulumi stack import -s $1 --file stack.json; }; func"

	}
}
```

- `npm run up dev`: Deploys the dev stack.
- `npm run prev dev`: Previews the dev stack.
- `npm run out dev`: Prints the dev stack's outputs. 
- `npm run refresh dev`: Update the Pulumi stack using the real stack as reference. Used to remove drift. This has no consequences on your physical files.
- `npm run blast dev`: Destroys the dev stack.
- `npm run import dev`: Imports the Pulumi dev state into a local `./stack.json` file. Use this to inspect all resources or to fix a `pending_operations` issues.
- `npm run export dev`: Exports the local `./stack.json` file to the Pulumi dev state.

## AWS scripts

```js
{
	"scripts": {
		"id": "func() { aws ec2 describe-instances --filter \"Name=tag:Name,Values=your-project-name-$1\" --query \"Reservations[].Instances[?State.Name == 'running'].InstanceId[]\" --output text; }; func",
		"conn": "func() { aws ssm start-session --target $(npm run id $1 | tail -1); }; func",
		"ssh": "func(){ echo Forwarding traffic from local port $2 to $1 EC2 on port 22; aws ssm start-session --target $(npm run id $1 | tail -1) --document-name AWS-StartPortForwardingSession --parameters '{\"portNumber\":[\"22\"], \"localPortNumber\":[\"'$2'\"]}'; };func",
		"rds": "func(){ aws rds describe-db-clusters --query 'DBClusters[].{DBClusterIdentifier:DBClusterIdentifier,Endpoint:Endpoint,ReaderEndpoint:ReaderEndpoint} | [?DBClusterIdentifier == `your-project-name'$1'`]' | grep -Eo '\"Endpoint\":\\s\"(.*?)\\.com' | cut -c 14-; };func"
	}
}
```

- `npm run id dev`: Gets the EC2 instance ID.
- `npm run rds dev`: Gets the RDS endpoint.
- `npm run conn dev`: Connects tp the EC2 instance via SSM session manager.
- `npm run ssh dev 9999`: Starts a port-forwarding session via SSM. Traffic sent to 127.0.0.1:9999 is forwarded to the EC2 on port 22.

# Automation API
## Setting it up in Docker

The following example shows what a `Dockerfile` for an AWS Lambda would look like:

```
FROM amazon/aws-lambda-nodejs:12
ARG FUNCTION_DIR="/var/task"

# Pulumi setup
## 1. Configure the Pulumi environment variables
ENV PULUMI_SKIP_UPDATE_CHECK true
ENV PULUMI_HOME "/tmp"
## 2. Install Pulumi dependencies
RUN yum install -y \
	which \
	tar \
	gzip
## 3. Install Pulumi. All version at https://www.pulumi.com/docs/get-started/install/versions/
RUN curl -fsSL https://get.pulumi.com/ | bash -s -- --version 3.10.0 && \
	mv ~/.pulumi/bin/* /usr/bin

# Create function directory
RUN mkdir -p  ${FUNCTION_DIR}

# Install all dependencies
COPY package*.json ${FUNCTION_DIR}
RUN npm install --only=prod --prefix ${FUNCTION_DIR}

# Copy app files
COPY . ${FUNCTION_DIR}

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "index.handler" ]
```

Notice:
1. Environment variables:
	- `PULUMI_SKIP_UPDATE_CHECK` must be set to true to prevent the pesky warnings to update Pulumi to the latest version.
	- `PULUMI_HOME` must be set to a folder where the Lambda has write access (by default, it only has write access to the `/tmp` folder. Use EFS to access more options). The default PULUMI_HOME value is `~`. Unfortunately, Lambda don't have access to that folder. Not configuring the PULUMI_HOME variable would result in a `failed to create '/home/sbx_userxxxx/.pulumi'` error message when the lambda executes the `pulumi login file:///tmp/` command. 
2. `bash -s -- --version 3.10.0`: Use the explicit version to make sure Pulumi's update don't break your code.
3. `mv ~/.pulumi/bin/* /usr/bin` moves the the executable files to where the lambda can access them (i.e., `/usr/bin`). 

In you Lambda code, you can know use the Automation API, or call Pulumi via the `child_process` (which is actually what the automation API does):

```js
const cp = require('child_process')
const util = require('util')

const exec = util.promisify(cp.exec)

const main = async () => {
	let pulumiUser = await exec('pulumi whoami').catch(() => null)
	const needToLogin = !pulumiUser || pulumiUser.indexOf('/sbx_user') < 0 // Lambda uses sandboxed users called 'sbx_userxxxx'
	if (needToLogin) {
		await exec('pulumi login file:///tmp/')
		pulumiUser = await exec('pulumi whoami').catch(() => null)
	}
	
	if (!pulumiUser)
		throw new Error(`Fail to login locally to Pulumi.`)
	else
		console.log(`Pulumi user is: ${pulumiUser}`)
}

main()
```

# AWS
## Aurora

> __WARNING__: If both an Aurora cluster and an RDS proxy are provisioned at the same time, the initial `pulumi up` will probably fail
> with the following error: 
>	```
> 	registering RDS DB Proxy (xxxxxx/default) Target: InvalidDBInstanceState: DB Instance 
> 	xxxxxxxxxx is in an unsupported state - CONFIGURING_LOG_EXPORTS, needs to be in [AVAILABLE, MODIFYING, BACKING_UP]
>	```
> This is because the RDS target can only be created with DB instances that are running. Because the initial setup takes time,
> the DB instance won't be running by the time the RDS target creation process starts. There is no other option to wait and run
> `pulumi up` again later.

### Aurora - Basic usage

> WARNING: Once the `masterUsername` is set, it cannot be changed. Attempting to change it will create a delete and replace operation, which is obvioulsy not what you may want. 

```js
const auroraOutput = aurora({
	name: 'my-db', 
	engine: 'mysql',
	availabilityZones: ['ap-southeast-2a', 'ap-southeast-2b', 'ap-southeast-2c'], 
	backupRetentionPeriod: 30, // 30 days
	auth: {
		masterUsername: process.env.DB_USERNAME, 
		masterPassword: process.env.DB_PASSWORD, 
	}, 
	instanceNbr: 1, 
	instanceSize: 'db.t2.small', 
	vpcId: 'vpc-1234',
	subnetIds: ['subnet-1234', 'subnet-4567'],
	ingress:[
		{ protocol: 'tcp', fromPort: 3306, toPort: 3306, cidrBlocks: ['10.0.1.204/32'], description:`Bastion host access` }
	],
	protect:false, 
	publicAccess:false,
	tags: {
		Project:'my-project',
		Env: 'dev'
	}
})
```

> Notice that we're adding an `ingress` rule that gives access to an EC2 instance. In practice, create a dedicated security group to can access the RDS cluster, then add this SG to any system that needs access. 

### Grant access to EC2 instance

Use the `ec2` function described in the [EC2 with SSM](#ec2-with-ssm) section and the `aurora` function described in the [RDS Aurora](#rds-aurora) section. The important bit in the next sample is the aurora `ingress`, which allows the bastion to access Aurora:

```js
ingress:[
	{ protocol: 'tcp', fromPort: 3306, toPort: 3306, cidrBlocks: [pulumi.interpolate`${bastionOutput.privateIp}/32`], description:`Bastion host ${ec2Name} access` }
]
```

```js
// Bastion server
const ec2Name = `${PROJECT}-rds-bastion`
const { ami, instanceType } = config.requireObject('bastion')
const bastionOutput = ec2({
	name: ec2Name,
	ami, 
	instanceType, 
	availabilityZone: vpc.availabilityZones[0], 
	subnetId: vpc.publicSubnetIds[0],
	publicKey,
	toggleSSM: true,
	ssmVpcId:vpc.id,
	ssmVpcSecurityGroupId: vpc.defaultSecurityGroupId,
	tags
})

// Aurora
const { backupRetentionPeriod, instanceSize, instanceNbr } = config.requireObject('aurora')
const auroraOutput = aurora({
	name: PROJECT, 
	engine: 'mysql',
	availabilityZones: vpc.availabilityZones, 
	backupRetentionPeriod,
	auth: {
		masterUsername: process.env.DB_USERNAME, 
		masterPassword: process.env.DB_PASSWORD, 
	}, 
	instanceNbr, 
	instanceSize, 
	vpcId:vpc.id,
	subnetIds: vpc.isolatedSubnetIds,
	ingress:[
		{ protocol: 'tcp', fromPort: 3306, toPort: 3306, cidrBlocks: [pulumi.interpolate`${bastionOutput.privateIp}/32`], description:`Bastion host ${ec2Name} access` }
	],
	protect:false, 
	publicAccess:false,
	tags
})
```

### Add RDS proxy
#### RDS proxy setup

The basic setup consists of:
1. Addind an RDS proxy on an existing and already running cluster or instance.
2. Adding a list of resource that can access it via the `ingress` rules. You may want to create a dedicated security group that can access the RDS proxy. This way you can simply add this SG to any resource you wish to have access to the proxy rather than having to add those resource to the ingress list.
3. Optional, but recommended, turn on IAM authentication on the proxy. This will prevent any client to use explicit DB credentials and force them to be configured properly via their IAM role. To learn more about this, please refer to the [Setting up a Lambda to be able to access the RDS proxy when IAM is turned on](#setting-up-a-lambda-to-be-able-to-access-the-rds-proxy-when-iam-is-turned-on) section.
4. In your client, replace the RDS endpoint that you would have used in the hostname with the RDS proxy endpoint. Nothing else changes.

#### Enabling RDS proxy

> __WARNING__: If both an Aurora cluster and an RDS proxy are provisioned at the same time, the initial `pulumi up` will probably fail
> with the following error: 
>	```
> 	registering RDS DB Proxy (xxxxxx/default) Target: InvalidDBInstanceState: DB Instance 
> 	xxxxxxxxxx is in an unsupported state - CONFIGURING_LOG_EXPORTS, needs to be in [AVAILABLE, MODIFYING, BACKING_UP]
>	```
> This is because the RDS target can only be created with DB instances that are running. Because the initial setup takes time,
> the DB instance won't be running by the time the RDS target creation process starts. There is no other option to wait and run
> `pulumi up` again later.

Use the `proxy` property. When this feature is enabled, an additional security group is created for RDS proxy.

```js
const auroraOutput = aurora({
	name: 'my-db', 
	engine: 'mysql',
	availabilityZones: ['ap-southeast-2a', 'ap-southeast-2b', 'ap-southeast-2c'], 
	backupRetentionPeriod: 30, // 30 days
	auth: {
		masterUsername: process.env.DB_USERNAME, 
		masterPassword: process.env.DB_PASSWORD, 
	}, 
	instanceNbr: 1, 
	instanceSize: 'db.t2.small', 
	vpcId: 'vpc-1234',
	subnetIds: ['subnet-1234', 'subnet-4567'],
	ingress:[
		{ protocol: 'tcp', fromPort: 3306, toPort: 3306, cidrBlocks: ['10.0.1.204/32'], description:`Bastion host access` }
	],
	proxy: true
})
```

To configure it in greater details, use an object instead:

```js
{
	proxy: {
		enabled: true, // Default true.
		subnetIds: null, // Default is the RDS's subnetIds.
		logSQLqueries: false, // Default false
		idleClientTimeout: 1800, // Default 1800 seconds
		requireTls: true, // Default true.
		iam: false // Default false. If true, the RDS credentials are disabled and the only way to connect is via IAM.
	}
}
```

By default, all the `ingress` rules apply to identically both RDS and RDS proxy. This first example is equivalent to this:

```js
{
	ingress:[
		{ 
			protocol: 'tcp', 
			fromPort: 3306, 
			toPort: 3306, 
			cidrBlocks: ['10.0.1.204/32'], 
			description:`Bastion host access`,
			rds: true,
			proxy: true
		}
	],
}
```

To create ingress rules that are specific to RDS or RDS proxy, use the `rds` or `proxy` flag on each rule.

#### Setting up a Lambda to be able to access the RDS proxy when IAM is turned on

When the `iam` flag is not turned on, you must add the additional steps in your client configuration:
1. Generate a password on-the-fly based the client's IAM role. This is done in your code via AWS Signer in the AWS SDK.
2. Add an extra `rds-db:connect` policy to your resource's IAM role.

##### Using AWS Signer to create a DB password

```js
const AWS = require('aws-sdk')

const config = {
	region: 'ap-southeast-2', 
	hostname: 'my-project.proxy-12345.ap-southeast-2.rds.amazonaws.com',
	port: 3306,
	username: 'admin'
}
const signer = new AWS.RDS.Signer(config)

signer.getAuthToken({ username:config.username }, (err, password) => {
	if (err)
		console.log(`Something went wrong: ${err.stack}`)
	else
		console.log(`Great! the password is: ${password}`)
})
```

To integrate this signer with the `mysql2` package:

```js
const mysql = require('mysql2/promise')

const db = mysql.createPool({
	host: 'my-project.proxy-12345.ap-southeast-2.rds.amazonaws.com', // can also be an IP
	user: 'admin',
	ssl: { rejectUnauthorized: false},
	database: 'my-db-name',
	multipleStatements: true,
	waitForConnections: true,
	connectionLimit: 2, // connection pool size
	queueLimit: 0,
	timezone: '+00:00', // UTC
	authPlugins: {
		mysql_clear_password: () => () => {
			return signer.getAuthToken({ username:'admin' })
		}
	}
})
```

##### Configure a `rds-db:connect` action on the IAM role

```js
const lambda = require('./src/aws/lambda')
const { createRdsConnectPolicy } = require('./src/aws/utils')

const rdsAccessPolicy = createRdsConnectPolicy({ name:`my-project-access-rds`, rdsArn:proxy.arn })

const lambdaOutput = await lambda({
	//...
	policies:[rdsAccessPolicy],
	//...
})
```

`createRdsConnectPolicy` accepts the following input:
- `rdsArn`: It is required. Examples: `arn:aws:rds:ap-southeast-2:1234:db-proxy:prx-123`, `arn:aws:rds:ap-southeast-2:1234:cluster:blabla` or `arn:aws:rds:ap-southeast-2:1234:db:blibli`.
- `resourceId`: Optional. Default resource name (1)
- `username`: Optional. Default `*`. Other examples: 'mark', 'peter'

Only RDS proxy embeds its resource ID in its arn. This means that the `resourceId` should not be provided when the `rdsArn` is an RDS proxy. For all the other RDS resources (clusters and instances), the `resourceId` is required. For an Aurora cluster, this resource is called `clusterResourceId`, while for an instance, it is called `dbiResourceId`.

> For more details around creating this policy, please refer to this article [Creating and using an IAM policy for IAM database access](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.IAMPolicy.html)

### Using AWS Secrets Manager to manage Aurora's credentials

This section is not about the code sample(which is trivial and added below), but about the approach. It is __*NOT RECOMMENDED*__ to use Pulumi to provision a secret in AWS secrets manager and then use it directly into Aurora. The reasons for this are:
1. You need to maintain the initial secrets in the Pulumi code. Even if you use environment variables, this could be avoided.
2. Each time you run `pulumi up`, there is a risk to update the DB credentials, which could break clients relying on your DB.

Instead, you shoud:
1. Prior to provsioning the DB, create a new secret in your account and name it using your stack convention(1).
2. Pass that secret ARN to the Aurora script above. 

```js
const auroraOutput = aurora({
	...
	auth: {
		secretId: 'my-db-creds-dev' // This can be the secret's name, id or arn.
	}, 
	...
})
```

> (1) For example `my-db-creds-<STACKNAME>` (e.g., `my-db-creds-dev`).

## EC2

The next sample shows how to provision an EC2 bastion host secured via SSM in a private subnet. A private subnet does not need to have a NAT Gateway to work with SSM, but in this example, it is required in order to use the `EC2_SHELL` which needs internet access to install telnet (this is just for example, because in theory, you would use SSM to install telnet, which would remove the need for this userData script, and therefore would also remove the need for a NAT gateway).

Also, notice that we are passing the RSA public key to this instance. This will set up the RSA key for the `ec2-user` SSH user. The RSA private key is intended to be shared to any engineer that needs to establish a secured SSH tunnel between their local machine and this bastion host. Private RSA keys are usually not supposed to be shared lightly, but in this case, the security and accesses are managed by SSM, which relaxes the restrictions around sharing the RSA private key. For more details about SSH tunneling with SSM, please refer to this document: https://gist.github.com/nicolasdao/4808f0a1e5e50fdd29ede50d2e56024d#ssh-tunnel-to-private-rds-instances.

```js
const EC2_SHELL = `#!/bin/bash
set -ex
cd /tmp
sudo yum install -y telnet`

const EC2_RSA_PUBLIC_KEY = 'ssh-rsa AAAA...' // You'll give the private key to your dev so they use it to connect

const ec2Output = ec2({
	name: 'my-ec2-machine',
	ami: 'ami-02dc2e45afd1dc0db', // That's Amazon Linux 2 for 64-bits ARM which comes pre-installed with the SSM agent.
	instanceType: 't4g.nano', // EC2 ARM graviton 2 
	availabilityZone: 'ap-southeast-2a', // Tip: Use `npx get-regions` to find an AZ.
	subnetId: privateSubnetId,
	userData: EC2_SHELL,
	publicKey:EC2_RSA_PUBLIC_KEY,
	toggleSSM: true,
	ssmVpcId:vpc.id,
	ssmVpcSecurityGroupId: vpc.vpc.defaultSecurityGroupId,
	tags: {
		Project: 'my-cool-project',
		Env: 'dev'
	}
})
```

## EFS
### Mounting an EFS access point on a Lambda
```js
const pulumi = require('@pulumi/pulumi')
const securityGroup = require('./src/aws/securityGroup')
const vpc = require('./src/aws/vpc')
const lambda = require('./src/aws/lambda')
const efs = require('./src/aws/efs')
const { resolve } = require('path')

const ENV = pulumi.getStack()
const PROJ = pulumi.getProject()
const PROJECT = `${PROJ}-${ENV}`

const tags = {
	Project: PROJ,
	Env: ENV
}

const main = async () => {

	// VPC with a public subnet and an isolated subnet (i.e., private with no NAT)
	const vpcOutput = await vpc({
		name: PROJECT,
		subnets: [{ type: 'public' }, { type: 'isolated', name: 'efs' }],
		numberOfAvailabilityZones: 3,
		protect: true,
		tags
	})


	// Security group that can access EFS
	const { securityGroup:accessToEfsSecurityGroup } = await securityGroup({ 
		name: `${PROJECT}-access-efs`,
		description: `Access to the EFS filesystem ${PROJECT}.`, 
		egress: [{ 
			protocol: '-1', 
			fromPort: 0,
			toPort: 65535,
			cidrBlocks: ['0.0.0.0/0'], 
			ipv6CidrBlocks: ['::/0'], 
			description:'Allows to respond to all traffic' 
		}],
		vpcId: vpc.id, 
		tags
	})

	// EFS
	const efsOutput = await efs({ 
		name: PROJECT, 
		accessPointDir: '/projects',
		vpcId: vpc.id,
		subnetIds: vpc.isolatedSubnetIds, 
		ingress:[{ 
			// Allows traffic from resources with the 'accessToEfsSecurityGroup' SG.
			protocol: 'tcp', fromPort: 2049, toPort: 2049, securityGroups: [accessToEfsSecurityGroup.id], description: 'SG for NFS access to EFS' 
		}],
		protect: true,
		tags
	})

	// Lambda
	const lambdaOutput = await lambda({
		name: PROJECT,
		fn: {
			runtime: 'nodejs12.x', 
			dir: resolve('./app')
		},
		timeout: 30, 
		vpcConfig: {
			subnetIds: vpc.isolatedSubnetIds,
			securityGroupIds:[
				// Use the 'accessToEfsSecurityGroup' so that this lambda can access the EFS filesystem.
				accessToEfsSecurityGroup.id
			], 
			enableENIcreation: true
		},
		fileSystemConfig: {
			arn: efsOutput.accessPoint.arn,
			localMountPath: '/mnt/somefolder'
		},
		cloudWatch: true,
		logsRetentionInDays: 7,
		tags
	})

	return {
		vpc: vpcOutput,
		accessToEfsSecurityGroup,
		efs: efsOutput,
		lambda: lambdaOutput
	}
}

module.exports = main()
```

## Lambda
### A few words about AWS Lambda
#### Lambdas, VPC and subnets

On the surface, AWS Lambdas appear to be very easy to use, but there are a few gotchas that require to be aware of the following imlementation details:
1. AWS Lambdas _ARE ALWAYS_ in a private subnet. This cannot be changed. The only reason they can access the public internet is because by default, AWS configures them with a NAT gateway. 
2. When an AWS Lambda is configured to access your custom VPC:
	- It will most likely loose access to the public internet if your subnet in your VPC is not configured with internet access(1).
	- It will need the permission to provision an ENI so that they can access your VPC. This requires the `ec2:CreateNetworkInterface` action(2).
3. Because AWS Lambdas are always in a private subnet, it is futile to connect them to your VPC's public subnet. 

> (1) When connecting your Lambda to your VPC, the only subnets that makes sense to be connected to are the private subnets. Therefore to enable public internet access, NATs must be configured in public subnets, and each private subnet's route table must contain a rule that send traffic `0.0.0.0/0` to the NAT on the public subnet.
> (2) The easiest way to allow the `ec2:CreateNetworkInterface` action for an IAM role is to attach he AWS managed policy `AWSLambdaVPCAccessExecutionRole`.

#### Lambda environment variables

- `LAMBDA_TASK_ROOT`: The path to where the lambda code is.
- `LAMBDA_RUNTIME_DIR`: The path to where the lambda code is.

### The simplest API Gateway with Lambda

```js
const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const awsx = require('@pulumi/awsx')

const ENV = pulumi.getStack()
const PROJ = pulumi.getProject()
const PROJECT = `${PROJ}-${ENV}`

const api = new awsx.apigateway.API(PROJECT, {
	routes: [
		{
			method: 'GET', 
			path: '/{subFolder}/{subSubFolders+}', 
			eventHandler: async ev => {
				return {
					statusCode: 200,
					body: JSON.stringify({
						subFolder: ev.pathParameters.subFolder,
						subSubFolders: ev.pathParameters.subSubFolders						
					})
				}
			}
		}
	],
})

exports.url = api.url
```

> CloudWatch is automatically configured for each Lambda provisioned via each route.

### Example - Basic Lambda with an API Gateway

This next sample is more explicit than the previous example. You'll also notice that out-of-the-box, CloudWatch is not setup. The [Configuring CloudWatch for the Lambda](#configuring-cloudwatch-for-the-lambda) section details how to set it up. 

This next sample assumes that the root folder contains an `app/` folder which contains the actual NodeJS lambda code:

```
app/
	|__ src/
			|__ index.js
	|__ index.js
	|__ package.json
```

> The `package.json` is not always required. If your `index.js` is simple and does not contain external NodeJS dependencies, then the `index.js` will suffice.

Where `./index.js` is similar to:

```js
const { doSomething } = require('./src')

exports.handler = async ev => {
	const message = await doSomething()
	return {
		statusCode: 200,
		body: message
	}
}
```

```js
// https://www.pulumi.com/docs/reference/pkg/aws/lambda/function/

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const { resolve } = require('path')
const lambda = require('./src/lambda')

const ENV = pulumi.getStack()
const PROJ = pulumi.getProject()
const PROJECT = `${PROJ}-${ENV}`
const REGION = aws.config.region

const tags = {
	Project: PROJ,
	Env: ENV,
	Region: REGION
}

const lambdaOutput = lambda({
	name: PROJECT,
	fn: {
		runtime: 'nodejs12.x', 	
		dir: resolve('./app')
	},
	timeout:30, 
	memorySize:128,  
	tags
})

// API GATEWAY: https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/awsx/apigateway/
const api = new awsx.apigateway.API(PROJECT, {
	routes: [
		{
			method: 'GET', 
			path: '/{subFolder}/{subSubFolders+}', 
			eventHandler: lambdaOutput.lambda
		}
	]
})

exports.url = api.url
```

### Example - Configuring CloudWatch

> WARNING: The next sample demonstrates how to attach a policy explicitly. To set one up for CloudWatch, the recommended way is to use the `cloudWatch` and `logsRetentionInDays` properties as explained in the TIPS at the bottom of this section.

To add CloudWatch logs to the previous Lambda, we need to create a new policy that allows the creations of log groups, log streams and log event as associate that policy to the Lambda's role.


```js
// IAM: Allow lambda to create log groups, log streams and log events.
// Doc: https://www.pulumi.com/docs/reference/pkg/aws/iam/policy/
const cloudWatchPolicy = new aws.iam.Policy(PROJECT, {
	path: '/',
	description: 'IAM policy for logging from a lambda',
	policy: JSON.stringify({
		Version: '2012-10-17',
		Statement: [{
			Action: [
				'logs:CreateLogGroup',
				'logs:CreateLogStream',
				'logs:PutLogEvents'
			],
			Resource: 'arn:aws:logs:*:*:*',
			Effect: 'Allow'
		}]
	})
})

const lambdaOutput = lambda({
	name: PROJECT,
	fn: {
		runtime: 'nodejs12.x', 
		dir: resolve('./app')
	},
	timeout:30, 
	memorySize:128, 
	policies: [cloudWatchPolicy],
	tags
})
```

> TIPS: Leverage existing AWS Managed policies instead of creating your own each time (use `npx get-policies` to find them). This example could be re-written as follow:
> ```js
> const lambdaOutput = lambda({
> 	name: PROJECT,
> 	fn: {
>		runtime: 'nodejs12.x', 
> 		dir: resolve('./app')
>	}, 
> 	timeout:30, 
> 	memorySize:128, 
> 	policies: [{ arn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole' }],
> 	tags
> })
> ```
>
> Because enabling CloudWatch on a Lambda is so common, this policy can be automatically toggled as follow:
>```js
> const lambdaOutput = lambda({
> 	...
> 	cloudWatch: true,
>	logsRetentionInDays: 7 // This is optional. The default is 0 (i.e., never expires). 
> })
>```

### Example - Lambda with container
#### Example - Lambda with container code

1. Create a new container for you lambda as follow:
	1. Create a new `app` folder as follow:
	```
	mkdir app && \
	cd app && \
	touch index.js && \
	touch Dockerfile
	```
	2. Paste the following in the `Dockerfile`:
	```
	FROM amazon/aws-lambda-nodejs:12
	ARG FUNCTION_DIR="/var/task"

	# Create function directory
	RUN mkdir -p ${FUNCTION_DIR}

	# Copy handler function and package.json
	COPY index.js ${FUNCTION_DIR}

	# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
	CMD [ "index.handler" ]
	```
	> To see how to deal with `npm install`, please refer to https://gist.github.com/nicolasdao/f440e76b8fd748d84ad3b9ca7cf5fd12#the-instructions-order-in-your-dockerfile-matters-for-performance.
	>
	> More about this AWS image below (1).
	3. Paste the following in the `index.js`:
	```js
	// IMPORTANT: IT MUST BE AN ASYNC FUNCTION OR THE CALLBACK VERSION: (event, context, callback) => callback(null, { statusCode:200, body: 'Hello' })
	exports.handler = async event => {
		return {
			statusCode: 200,
			body: `Hello world!`
		}
	}
	```
	4. Test your lambda locally:
	```
	docker build -t my-app .
	docker run -p 127.0.0.1:4000:8080 my-app:latest
	curl -XPOST "http://localhost:4000/2015-03-31/functions/function/invocations" -d '{}'
	```
	> More details about these commands below (2).
2. Create your `index.js`:
```js
const pulumi = require('@pulumi/pulumi')
const { resolve } = require('path')
const lambda = require('./src/lambda')

const ENV = pulumi.getStack()
const PROJ = pulumi.getProject()
const PROJECT = `${PROJ}-${ENV}`

const lambdaOutput = lambda({
	name: PROJECT,
	fn: {
		dir: resolve('./app'),
		type: 'image' // If './app' contains a 'Dockerfile', this prop is not needed. 'lambda' is able to automatically infer the type is an 'image'.
	},
	imageUri: image.imageValue,
	timeout:30, 
	memorySize:128
})
```

> (1) The [amazon/aws-lambda-nodejs:12](https://hub.docker.com/r/amazon/aws-lambda-nodejs) docker image hosts a node web server listening on port 8080. The CMD expects a string or array following this naming convention: "<FILE NAME CONTAINING THE HANDLER>.<HANDLER NAME>".
> (2) Once the container is running, the only way to test it is to perform POST to this path: `2015-03-31/functions/function/invocations`. This container won't listen to anything else; no GET, no PUT, no DELETE. 

#### Setting up environment variables and passing arguments

As a quick refresher, the following `Dockerfile`:

```
FROM amazon/aws-lambda-nodejs:12
ARG FUNCTION_DIR="/var/task"

ENV HELLO Mike Davis

# Create function directory
RUN mkdir -p ${FUNCTION_DIR}

# Copy handler function and package.json
COPY index.js ${FUNCTION_DIR}

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "index.handler" ]
```

Sets up an `HELLO` environment variable that can be accessed by the Lambda code as follow:

```js
exports.handler = async event => {
	return {
		statusCode: 200,
		body: `Hello ${process.env.HELLO}!`
	}
}
```

This could have been set up via the `docker build` and with an `ARG` in the `Dockerfile`:

```
FROM amazon/aws-lambda-nodejs:12
ARG FUNCTION_DIR="/var/task"
ARG MSG
ENV HELLO $MSG
...
```

```
docker build --build-arg MSG=buddy -t my-app .
docker run -p 127.0.0.1:4000:8080 my-app:latest
```

To define one or many `--build-arg` via Pulumi, use the following API:

```js
// ECR images. Doc:
// 	- buildAndPushImage API: https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/awsx/ecr/#buildAndPushImage
// 	- 2nd argument is a DockerBuild object: https://www.pulumi.com/docs/reference/pkg/docker/image/#dockerbuild
const image = awsx.ecr.buildAndPushImage(PROJECT, {
	context: './app',
	args: {
		MSG: 'Mr Dao. How do you do?'
	}
})
```

### Example - Lambda with EFS

Please refer to the [Mounting an EFS access point on a Lambda](#mounting-an-efs-access-point-on-a-lambda) section.

> For a full example of a project that uses Lambda with Docker and Git installed to save files on EFS, please refer to this project: https://github.com/nicolasdao/example-aws-lambda-efs


## Secret

### Getting stored secrets

```js
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
```

## Security Group

> WARNING: __Don't forget__ to also define an egress rule to allow traffic out from your resource. This is a typicall mistake that causes systems to not be able to contact any other services. The most common egress rule is:
> `{  protocol: '-1',  fromPort:0, toPort:65535, cidrBlocks: ['0.0.0.0/0'],  ipv6CidrBlocks: ['::/0'],  description:'Allow all traffic' }`

```js
const securityGroup = require('./src/aws/securityGroup')

const { securityGroup:mySecurityGroup, securityGroupRules:myRules } = await securityGroup({
	name: `my-special-sg`, 
	description: `Controls something special.`, 
	vpcId: 'vpc-1234', 
	egress: [{  
		protocol: '-1',  
		fromPort:0, toPort:65535, cidrBlocks: ['0.0.0.0/0'],  
		ipv6CidrBlocks: ['::/0'],  
		description:'Allow all traffic' 
	}], 
	tags: {
		Project: 'demo'
	}
})
```

## Step-function

## VPC

> WARNING: Once the VPC's subnets have been created, updating them will produce a replace, which can have dire consequences to your entire infrastructure. Therefore think twice when setting them up. 

The following setup is quite safe:

```js
const vpcOutput = vpc({
	name: 'my-project-dev',
	subnets: [{ type: 'public' }, { type: 'private' }],
	numberOfAvailabilityZones: 3, // Provide the maximum number of AZs based on your region. The default is 2
	protect: false,
	tags: {
		Project: 'my-project',
		Env: 'dev'
	}
})
```

This setup will divide the VPC's CIDR block in equal portions based on the total number of subnets created. The above example shows 6 subnets (3 public and 3 private). Because the example above did not specify any CIDR block for the VPC, it is set to `10.0.0.0/16` which represents 65,536 IP addresses. This means each subnet can use up to \~`10922` IP addresses. 

The last thing to be aware of is that the private subnets will also provision 3 NATs in the public subnets. The temptation would be to use `isolated` subnets instead of private ones to save on money, but from my experience, this is pointless. You'll always end up internet access from your isolated subnets, so don't bother and setup private subnets from the beginning.

# GCP

> Full API doc at https://www.pulumi.com/docs/reference/pkg/gcp/

## Buckets

```js
const pulumi = require('@pulumi/pulumi')
const gcp = require('@pulumi/gcp')

if (!process.env.PROJECT)
	throw new Error('Missing required environment variable \'process.env.PROJECT\'')

const config = new pulumi.Config()

const { location } = config.requireObject('gcp_bucket')

const STACK_NAME = pulumi.getStack()
const RESOURCE_PREFIX = `${process.env.PROJECT}-${STACK_NAME}`
const FILE_BUCKET = `${RESOURCE_PREFIX}-storage-pb`
const PRIVATE_BUCKET = `${RESOURCE_PREFIX}-nosql-db`

// Create the public file storage
const publicFileBucket = new gcp.storage.Bucket(FILE_BUCKET, {
	name: FILE_BUCKET, // This seems redundant, but it is not. It forces Pulumi to not add a unique suffix on your bucket.
	bucketPolicyOnly: true, // Means the policy applies on the entire bucket rather than on a per object basis
	cors: [{
		maxAgeSeconds: 3600,
		methods: [ 'GET', 'OPTIONS', 'HEAD', 'POST', 'PUT', 'DELETE' ],
		origins: ['*'],
		responseHeaders: ['*'],
	}],
	location
})

// Create the private bucket
const privateBucket = new gcp.storage.Bucket(PRIVATE_BUCKET, {
	name: PRIVATE_BUCKET,
	location
})

module.exports = {
	publicFileBucket: {
		id: publicFileBucket.id,
		publicUrl: publicFileBucket.selfLink,
		url: publicFileBucket.url,
		storageClass: publicFileBucket.storageClass,
		location: publicFileBucket.location
	},
	privateBucket: {
		id: privateBucket.id,
		publicUrl: privateBucket.selfLink,
		url: privateBucket.url,
		storageClass: privateBucket.storageClass,
		location: privateBucket.location
	}
}
```

## Enable services
### Standard GCP services

```js
require('@pulumi/pulumi')
const gcp = require('@pulumi/gcp')

if (!process.env.PROJECT)
	throw new Error('Missing required environment variable \'process.env.PROJECT\'')

const SERVICES = [
	'cloudbuild.googleapis.com',
	'containerregistry.googleapis.com',
	'run.googleapis.com',
	'secretmanager.googleapis.com'
]

const services = []

for(const service of SERVICES) {
	const { id } = new gcp.projects.Service(service, {
		project: process.env.PROJECT,
		service
	})

	services.push(id)
}

module.exports = {
	services
}
```

### Firebase service

> WARNING: Enabling Firebase on a Google project cannot be undone. I would suggest to not delete the Pulumi code that enable that service even if you which to not use Firebase in your project. You might think you just want to clean the Pulumi project, but the truth is that this will create issues as the Firebase project cannot be disabled.

Firebase is kind of a weird service. In essence, it is part of the GCP suite, but from a brand perspective, it is a separate product. Though there are a few Firebase services(1) that can be enabled in a GCP project the way it was explained in the previous section, this is not the way to enable Firebase on a Google project. The correct Pulumi API is the following:

```js
const gcp = require('@pulumi/gcp')

const firebase = new gcp.firebase.Project('your-firebase-project-name', {
	project: 'your-gcp-project-id'
})

module.exports = {
	firebase: firebase.id
}
```

This above snippets as a few side-effects. It will provision the following:
- A few new firebase servcies are enabled. Some of those are listed in (1) below.
- A new service account called `Firebase Admin SDK` is added.

> (1) The GCP Firebase services are:
> - `firebase.googleapis.com`
> - `firebaseappdistribution.googleapis.com`
> - `firebaseapptesters.googleapis.com`
> - `firebasedynamiclinks.googleapis.com`
> - `firebaseextensions.googleapis.com`
> - `firebasehosting.googleapis.com`
> - `firebaseinappmessaging.googleapis.com`
> - `firebaseinstallations.googleapis.com`
> - `firebaseml.googleapis.com`
> - `firebasemods.googleapis.com`
> - `firebasepredictions.googleapis.com`
> - `firebaseremoteconfig.googleapis.com`
> - `firebaserules.googleapis.com`
> - `firebasestorage.googleapis.com`
> - `firestore.googleapis.com`

### Identity Platform service

Unfortunately, as of August 2020, it is not possible to automate the enabling of that service via Pulumi because Identity Platform is an app in the Google Cloud Marketplace rather than a first class Google Cloud service. 

To enable that service, manually log to the Google Cloud console [here](https://console.cloud.google.com/marketplace/details/google-cloud-platform/customer-identity).

## Cloud Run
### Basic Cloud Run example

The following steps shows how to provision a Cloud Run service with the following aspects:
- Conventions:
	- The Cloud Run service name is built as follow: `<PULUMI PROJECT NAME>-<STACK>`. `<PULUMI PROJECT NAME>` is the `name` property in the `Pulumi.yaml`. For example, if the stack is called `test`, the service's name could be: `yourproject-test`. 
	- The Docker image is tagged with the first 7 characters of the current git commit sha.
- Environment variables are passed to the container so the app can access them. Typically, those are secrets. More about this at the bottom of this section.
- Though it is not required, this sample creates a dedicated service account for the Cloud Run service. This is considered a best practice because it makes it easier to control IAM policies for service-to-service communination. 
- That service cannot be accessed publicly via HTTPS. This is the default behavior. If you need to expose that service to the public, jump to the [Setting up public HTTPS access](#setting-up-public-https-access) section. To learn how to safely enable service-to-service communication without exposing them to the public, please refer to the [Congiguring service-to-service communication](#congiguring-service-to-service-communication) section.

To use this sample, make sure to:
- Install the dependencies: 
	```
	npm i @pulumi/pulumi @pulumi/gcp @pulumi/docker
	```
- Configure the `Pulumi.<STACK NAME>.yaml` so it contain at a minimum the following settings:
	```yaml
	config:
	  your-project-name:memory: 512Mi
	  gcp:project: your-gcp-project-id
	  gcp:region: australia-southeast1
	```
- Set up the following environment variables (e.g., use `dotenv` or your build server):
	- `DB_USER`
	- `DB_PASSWORD`
- Add the git helper module to get the current short commit sha. That module is documented [here](https://gist.github.com/nicolasdao/ff217cf8429d2ad01fef1fb69c699044).
- Add your Cloud Run source-code under the `app` folder. It does not need any `cloudbuild.yaml` since the build is automated with Pulumi, but it still needs a `Dockerfile` as per usual. 

```js
const pulumi = require('@pulumi/pulumi')
const gcp = require('@pulumi/gcp')
const docker = require('@pulumi/docker')
const { git } = require('./utils')

// Validates that the environment variables are set up
const ENV_VARS = [
	'DB_USER',
	'DB_PASSWORD'
]

for (let varName of ENV_VARS)
	if (!process.env[varName])
		throw new Error(`Missing required environment variables 'process.env.${varName}'`)

const config = new pulumi.Config()

const STACK_NAME = pulumi.getStack()
const MEMORY = config.require('memory') || '512Mi'
const SHORT_SHA = git.shortSha()
const SERVICE_NAME = `${config.name}-${STACK_NAME}`
const IMAGE_NAME = `${SERVICE_NAME}-image`
const SERVICE_ACCOUNT_NAME = `${SERVICE_NAME}-cloudrun`

const SERVICE_ACCOUNT_NAME = `${config.name}-${STACK_NAME}-cloudrun`

if (!SHORT_SHA)
	throw new Error('This project is not a git repository')
if (!gcp.config.project)
	throw new Error(`Missing required 'gcp:project' in the '${STACK_NAME}' stack config`)
if (!gcp.config.region)
	throw new Error(`Missing required 'gcp:region' in the '${STACK_NAME}' stack config`)

// Enables the Cloud Run service (doc: https://www.pulumi.com/docs/reference/pkg/gcp/projects/service/)
const enableCloudRun = new gcp.projects.Service('run.googleapis.com', {
	service: 'run.googleapis.com'
})

const gcpAccessToken = pulumi.output(gcp.organizations.getClientConfig({}).then(c => c.accessToken))

// Uploads new Docker image with your app to Google Cloud Container Registry (doc: https://www.pulumi.com/docs/reference/pkg/docker/image/)
const dockerImage = new docker.Image(IMAGE_NAME, {
	imageName: pulumi.interpolate`gcr.io/${gcp.config.project}/${config.name}:${SHORT_SHA}`,
	build: {
		context: './app'
	},
	registry: {
		server: 'gcr.io',
		username: 'oauth2accesstoken',
		password: pulumi.interpolate`${gcpAccessToken}`
	}
})

// Creates a new service account for that Cloud Run service (doc: https://www.pulumi.com/docs/reference/pkg/gcp/serviceaccount/account/)
const serviceAccount = new gcp.serviceAccount.Account(SERVICE_ACCOUNT_NAME, {
	accountId: SERVICE_ACCOUNT_NAME, // This will automatically create the service account email as follow: <SERVICE_ACCOUNT_NAME>@<PROJECT ID>.iam.gserviceaccount.com
	displayName: SERVICE_ACCOUNT_NAME
})

// Deploys the new Docker image to Google Cloud Run (doc: https://www.pulumi.com/docs/reference/pkg/gcp/cloudrun/)
const cloudRunService = new gcp.cloudrun.Service(SERVICE_NAME, {
	name: SERVICE_NAME,
	location: gcp.config.region,
	template: {
		// doc: https://www.pulumi.com/docs/reference/pkg/gcp/cloudrun/service/#servicetemplatespec
		spec: {
			// doc: https://www.pulumi.com/docs/reference/pkg/gcp/cloudrun/service/#servicetemplatespeccontainer
			containers: [{
				envs: ENV_VARS.map(name => ({ name, value:process.env[name] })),
				image: dockerImage.imageName,
				// doc: https://www.pulumi.com/docs/reference/pkg/gcp/cloudrun/service/#servicetemplatespeccontainerresources
				resources: {
					limits: {
						memory: MEMORY // Available units are 'Gi', 'Mi' and 'Ki'
					},
				},
			}],
			serviceAccountName: serviceAccount.email, // This is optional. The default is the project's default service account
			containerConcurrency: 80, // 80 is the max. Above this limit, Cloud Run spawn another container.
		},
	},
}, { 
	dependsOn: [
		enableCloudRun 
	]
})

module.exports = {
	serviceAccount: {
		id: serviceAccount.id,
		name: serviceAccount.name,
		accountId: serviceAccount.accountId,
		email: serviceAccount.email,
		project: serviceAccount.project
	},
	cloudRunService: {
		id: cloudRunService.id,
		name: cloudRunService.name,
		project: cloudRunService.project,
		location: cloudRunService.location,
		url: cloudRunService.status.url,
		serviceAccount: cloudRunService.template.spec.serviceAccountName
	},
	dockerImage: dockerImage.imageName,
	enableCloudRun: enableCloudRun.id
}
```

What's interesting in this template:
- The environment variables are passed to the container via `envs: ENV_VARS.map(name => ({ name, value:process.env[name] }))`. If your use case requires to pass some of those variables to the Docker image, please refer to the [Passing environment variables to the Docker image rather than the Docker container](#passing-environment-variables-to-the-docker-image-rather-than-the-docker-container) section.
- To push the Docker image to a registry other than DockerHub (in our example gcr.io), we must add a `registry` property in the `docker.Image` instantiation. The Pulumi documentation on how to set this up for Google Cloud Container Registry was not really clear:
	- `server`: Must be hardcoded to `gcr.io`.
	- `username`: Must be hardcoded to `oauth2accesstoken`.
	- `password`: This is the short-lived OAuth2 access token retrieved based on your Google credentials. That token can retrieved with the `gcp.organizations.getClientConfig({}).then(c => c.accessToken)` API. However, because this is a Promise that resolves to a string, it must first be converted to an Output with `pulumi.output`. The string can finally be passed to the `docker.Image` instance with the `pulumi.interpolation` function.
- A new service account is created just for that Cloud Run:
	```js
	const serviceAccount = new gcp.serviceAccount.Account(...)
	...
	const cloudRunService = new gcp.cloudrun.Service(SERVICE_NAME, {
		template: {
			spec: {
				...
				serviceAccountName: serviceAccount.email,
				...
			}
		}
	})
	```
	As mentioned earlier, this step is optional, but it is considered a best practice ot manage IAM policies betwene services. If the line `serviceAccountName: serviceAccount.email` is omitted, the Cloud Run service is associated to the project default service account.
	
### Setting up public HTTPS access

By default, Cloud Run services are protected. This means that they cannot be access via HTTPS outside of your Google Clloud project's VPC. To enable HTTPS access to the public, add the following snippet at the bottom of the previous code snippet:

```js
// Allows this service to be accessed via public HTTPS
const PUBLIC_MEMBER = `${SERVICE_NAME}-public-member`
const publicAccessMember = new gcp.cloudrun.IamMember(PUBLIC_MEMBER, {
	service: cloudRunService.name,
	location: cloudRunService.location,
	role: 'roles/run.invoker',
	member: 'allUsers'
})
```

### Congiguring service-to-service communication

This section demonstrates how to create a Cloud Run service that can invoke another protected Cloud Run service. 

It is considered a best practice to not expose your Cloud Run services publicly unless this is a business requirement (e.g., exposing a web API for a mobile or web app). This means that for service-to-service communication, roles must be explicitly configured to allow specific agents to interact with each other. The approach is quite straightforward:
1. Get the Pulumi stack of the protected Cloud Run service. We need three pieces of information from that stack:
	- `name`
	- `project`
	- `location`
	This means that those pieces of information must have been added to the stack's outputs. 
	```js
	const otherProtectedStack = new pulumi.StackReference('your-other-protected-stack')
	```
2. Add a new _IAM binding_ on that protected Cloud Run service which associates the `roles/run.invoker` role to the current Cloud Run's service account.
	```js
	const binding = new gcp.cloudrun.IamBinding('your-new-binding-name', {
		service: otherProtectedStack.outputs.cloudRunService.name,
		location: otherProtectedStack.outputs.cloudRunService.location,
		project: otherProtectedStack.outputs.cloudRunService.project,
		role: 'roles/run.invoker',
		members: [
			pulumi.interpolate`serviceAccount:${serviceAccount.email}`
		]
	})
	```
	> IMPORTANT: Notice the convention used to define the `members`:
	>	1. We need to use `pulumi.interpolate` because `serviceAccount.email` is an Output. 
	>	2. We need to prefix the service account email with `serviceAccount` (careful, this is case-sensitive!), otherwise, a `Error 400: The member ... is of an unknown type` error is thrown. 

## Identity Platform
### Manually enable the Identity Platform

1. [Manually enable Identity Platform service](#identity-platform-service)
2. If you need to use the multi-tenants feature, manually enable it (as of August 2020, this cannot be automated yet):
	- Log in to your [project's Identity Platform page](https://console.cloud.google.com/marketplace/details/google-cloud-platform/customer-identity).
	- Click on the `Tenants` in the menu.
	- Click on `Settings`, select the `Security` tab and then click on the `Allow tenants` button.

### Create a new tenant

> doc: https://www.pulumi.com/docs/reference/pkg/gcp/identityplatform/tenant/

```js
const tenant = new gcp.identityplatform.Tenant('your-tenant-name', {
	allowPasswordSignup: true,
	displayName: 'your-tenant-name'
})

module.exports = {
	tenant: {
		id: tenant.id,
		tenantId: tenant.name // Value required in the client: firebase.auth().tenantId = tenantId
	}
}
```

## Service accounts

There are no Pulumi APIs to list all the project's service accounts, but it is easy to call the official Google Cloud REST API to get that information. Convert that Promise into an `Output` with `pulumi.output` so you can use it with other resources.

```js
const pulumi = require('@pulumi/pulumi')
const gcp = require('@pulumi/gcp')
const fetch = require('node-fetch')

/**
 * Selects service accounts in the current project. 
 * 
 * @param  {String} query.where.email
 * @param  {String} query.where.emailContains
 * 
 * @return {String} serviceAccounts[].description					
 * @return {String} serviceAccounts[].displayName					
 * @return {String} serviceAccounts[].email					
 * @return {String} serviceAccounts[].etag					
 * @return {String} serviceAccounts[].name					
 * @return {String} serviceAccounts[].oauth2ClientId					
 * @return {String} serviceAccounts[].projectId					
 * @return {String} serviceAccounts[].uniqueId	
 */
const select = async query => {
	const where = (query || {}).where || {}
	const { accessToken } = await gcp.organizations.getClientConfig({})

	const uri = `https://iam.googleapis.com/v1/projects/${gcp.config.project}/serviceAccounts`
	
	const data = await fetch(uri, {
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${accessToken}`
		}
	}).then(res => res.json())

	if (!data || !data.accounts || !data.accounts.length)
		return []

	const filters = []

	if (where.email)
		filters.push(account => account.email == where.email)		
	if (where.emailContains)
		filters.push(account => account.email.indexOf(where.emailContains) >= 0)	

	return data.accounts.filter(account => filters.every(f => f(account)))
}

const find = query => select(query).then(data => data[0])

module.exports = {
	select,
	find
}
```

# Troubleshooting
## AWS troubleshooting
### Terminal utilities are failing with timeout errors `ETIMEDOUT`

This is most likely due to one of the following:
- Missing security group inbound or outbound rule.
- The private subnet is not able to access the public internet because:
	- It has no route table configured with a NAT gateway.
	- Or there is no VPC endpoint configured to access the resource.
- The VPC's ACL prevents connection to happen.

### AWS Lambda cannot access the public internet

Please refer to the [A few words about AWS Lambda](#a-few-words-about-aws-lambda) section.

### `failed to create '/home/sbx_userxxxx/.pulumi'`

Please refer to the [Setting it up in Docker](#setting-it-up-in-docker) section.

# Annexes

# References

- [Creating and using an IAM policy for IAM database access](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.IAMPolicy.html)