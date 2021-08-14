# PULUMI RECIPES

> Managing AWS resources almost always involves managing IAM roles and policies. For a quick recap on that topic, please refer to this document: https://gist.github.com/nicolasdao/830fc1d1b6ce86e0d8bebbdedb2f2626.

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
> * [AWS](#aws)
>	- [Aurora](#aurora)
>		- [Basic usage](#aurora---basic-usage)
>		- [Grant access to EC2 instance](#grant-access-to-ec2-instance)
>		- [Using AWS Secrets Manager to manage Aurora's credentials](#using-aws-secrets-manager-to-manage-auroras-credentials)
>	- [EC2](#ec2)
>	- [EFS](#efs)
>	- [Lambda](#lambda)
>		- [The simplest API Gateway with Lambda](#the-simplest-api-gateway-with-lambda)
>		- [Example - Basic Lambda with an API Gateway](#example---basic-lambda-with-an-api-gateway)
>		- [Example - Configuring CloudWatch](#example---configuring-cloudwatch)
>		- [Example - Lambda with container](#example---lambda-with-container)
>			- [code](#example---lambda-with-container-code)
>			- [Setting up environment variables and passing arguments](#setting-up-environment-variables-and-passing-arguments)	
>		- [Example - Lambda with EFS](#example---lambda-with-efs)
>	- [Secret](#secret)
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

# AWS
## Aurora
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
	ingressRules:[
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

### Grant access to EC2 instance

Use the `ec2` function described in the [EC2 with SSM](#ec2-with-ssm) section and the `aurora` function described in the [RDS Aurora](#rds-aurora) section. The important bit in the next sample is the aurora `ingressRules`, which allows the bastion to access Aurora:

```js
ingressRules:[
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
	ingressRules:[
		{ protocol: 'tcp', fromPort: 3306, toPort: 3306, cidrBlocks: [pulumi.interpolate`${bastionOutput.privateIp}/32`], description:`Bastion host ${ec2Name} access` }
	],
	protect:false, 
	publicAccess:false,
	tags
})
```

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

## Lambda
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
	runtime: 'nodejs12.x', 
	functionFolder: resolve('./app'), 
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
	runtime: 'nodejs12.x', 
	functionFolder: resolve('./app'), 
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
> 	runtime: 'nodejs12.x', 
> 	functionFolder: resolve('./app'), 
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
const awsx = require('@pulumi/awsx')
const lambda = require('./src/lambda')

const ENV = pulumi.getStack()
const PROJ = pulumi.getProject()
const PROJECT = `${PROJ}-${ENV}`

// ECR images. Doc:
// 	- buildAndPushImage API: https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/awsx/ecr/#buildAndPushImage
// 	- 2nd argument is a DockerBuild object: https://www.pulumi.com/docs/reference/pkg/docker/image/#dockerbuild
const image = awsx.ecr.buildAndPushImage(PROJECT, {
	context: './app'
})

const lambdaOutput = lambda({
	name: PROJECT,
	imageUri: image.imageUri,
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

> For a full example of a project that uses Lambda with Docker and Git installed to save files on EFS, please refer to this project: https://github.com/nicolasdao/example-aws-lambda-efs

```js
// Original code: https://github.com/pulumi/examples/blob/master/aws-ts-lambda-efs/index.ts
// Original blog: https://www.pulumi.com/blog/aws-lambda-efs/

// To test this project:
// 
// 	curl -X POST -d 'Hello world' $(pulumi stack output url)files/file.txt
// 	curl -X GET $(pulumi stack output url)files/file.txt

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const awsx = require('@pulumi/awsx')
const cp = require('child_process')
const fs = require('fs')

const ENV = pulumi.getStack()
const PROJ = pulumi.getProject()
const PROJECT = `${PROJ}-${ENV}`
const MNT_FOLDER = '/mnt/storage'

const main = async () => {

	// VPC: https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/awsx/ec2/
	const vpc = new awsx.ec2.Vpc(PROJECT, { 
		subnets: [
			{ type: 'private' }, // Carefull, this will also create NATs 
			{ type: 'public' }
		],
		numberOfAvailabilityZones: 3, // The default is 2
		tags: {
			Name: PROJECT // Add this tag as for side-effect to give a friendly name to your VPC
		}
	})
	const subnetIds = await vpc.publicSubnetIds

	// EFS
	const filesystem = new aws.efs.FileSystem(PROJECT, {
		tags: {
			Name: PROJECT // That's also going to be used to add afriendly name to the resource.
		}
	})
	const targets = []
	for (let i = 0; i < subnetIds.length; i++) {
		targets.push(new aws.efs.MountTarget(`fs-mount-${i}`, {
			fileSystemId: filesystem.id,
			subnetId: subnetIds[i],
			securityGroups: [vpc.vpc.defaultSecurityGroupId],
		}))
	}
	const ap = new aws.efs.AccessPoint(PROJECT, {
		fileSystemId: filesystem.id,
		posixUser: { uid: 1000, gid: 1000 },
		rootDirectory: { 
			path: '/www', // The access points only work on sub-folder. Do not use '/'.
			creationInfo: { 
				ownerGid: 1000, 
				ownerUid: 1000, 
				permissions: '755' // 7 means the read+write+exec rights. 1st nbr is User, 2nd is Group and 3rd is Other.
			} 
		},
		tags: {
			Name: PROJECT // That's also going to be used to add afriendly name to the resource.
		}
	}, { dependsOn: targets })

	// Lambda
	function createLambda(name, fn) {
		return new aws.lambda.CallbackFunction(name, {
			policies: [aws.iam.ManagedPolicy.AWSLambdaVPCAccessExecutionRole, aws.iam.ManagedPolicy.LambdaFullAccess],
			vpcConfig: {
				subnetIds: vpc.privateSubnetIds,
				securityGroupIds: [vpc.vpc.defaultSecurityGroupId],
			},
			fileSystemConfig: { arn: ap.arn, localMountPath: MNT_FOLDER },
			callback: fn
		})
	}

	// API Gateway with 3 routes and 3 lambdas
	const api = new awsx.apigateway.API(PROJECT, {
		routes: [
			{
				method: 'GET', 
				path: '/files/{filename+}', 
				eventHandler: createLambda(`${PROJECT}-getHandler`, async ev => {
					try {
						const f = MNT_FOLDER + '/' +  ev.pathParameters.filename
						const data = fs.readFileSync(f)
						return {
							statusCode: 200,
							body: data.toString()
						}
					} catch(err) {
						return { 
							statusCode: 500, 
							body: err.message
						}
					}
				})
			},
			{
				method: 'POST', 
				path: '/files/{filename+}', 
				eventHandler: createLambda(`${PROJECT}-uploadHandler`, async ev => {
					try {
						const f = MNT_FOLDER + '/' + ev.pathParameters.filename
						const data = new Buffer(ev.body, 'base64')
						fs.writeFileSync(f, data)
						return {
							statusCode: 200,
							body: '',
						}
					} catch(err) {
						return { 
							statusCode: 500, 
							body: err.message 
						}
					}
				})
			},
			{
				method: 'POST', 
				path: '/', 
				eventHandler: 
				createLambda(`${PROJECT}-execHandler`, async ev => {
					const cmd = new Buffer(ev.body, 'base64').toString()
					const buf = cp.execSync(cmd)
					return {
						statusCode: 200,
						body: buf.toString()
					}
				})
			}
		],
	})

	// Exports
	return {
		url: api.url
	}
}

const output = main()

exports.url = output.then(o => o.url)
```

## Secret

## Security Group

## Step-function

## VPC

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
