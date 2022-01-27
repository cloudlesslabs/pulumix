# PULUMIX - PULUMI RECIPES

> __Pulumi guide__: To learn more about Pulumi, please refer to https://gist.github.com/nicolasdao/6cdd85d94b8ee992297d351c248f4092.
> __IAM roles & policies__: Managing AWS resources almost always involves managing IAM roles and policies. For a quick recap on that topic, please refer to this document: https://gist.github.com/nicolasdao/6cdd85d94b8ee992297d351c248f4092#iam-recap.

```
(test -f .npmrc || echo @cloudlesslabs:registry=https://npm.pkg.github.com/cloudlesslabs >> .npmrc) && \ 
npm i @cloudlesslabs/pulumix
```

# Table of contents

> * [Pulumi](#pulumi)
>	- [Cross referencing stacks](#cross-referencing-stacks)
>	- [Project config](#project-config)
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
>		- [Dockerfile for Automation API in a Lambda](#dockerfile-for-automation-api-in-a-lambda)
>	- [Setting the adequate IAM policies](#setting-the-adequate-iam-policies)
>	- [Using the Automation API in your code](#using-the-automation-api-in-your-code)
> * [AWS](#aws)
>	- [AppSync](#appsync)
>		- [Default AppSync settings](#default-appsync-settings)
>		- [Auth with Cognito, OIDC and IAM](#auth-with-cognito-oidc-and-iam)
>			- [IAM config](#iam-config)
>			- [Cognito Auth](#cognito-auth)
>				- [config](#cognito-config)
>				- [`$context.identity` object](#cognito-contextidentity-object)
>			- [OIDC config](#oidc-config)
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
>	- [ECR](#ecr)
>	- [EC2](#ec2)
>	- [EFS](#efs)
>		- [Mounting an EFS access point on a Lambda](#mounting-an-efs-access-point-on-a-lambda)
>	- [Lambda](#lambda)
>		- [A few words about AWS Lambda](#a-few-words-about-aws-lambda)
>			- [AWS Lambda key design principles](#aws-lambda-key-design-principles)
>			- [ARM architecture recommended](#arm-architecture-recommended)
>		- [API Gateway with explicit Lambda handlers](#api-gateway-with-explicit-lambda-handlers)
>		- [Basic Lambda with an API Gateway](#basic-lambda-with-an-api-gateway)
>		- [Configuring IAM policies to enable Lambda access to other resources](#configuring-iam-policies-to-enable-lambda-access-to-other-resources)
>		- [Letting other AWS services to access a lambda](#letting-other-aws-services-to-access-a-lambda)
>		- [Scheduling a lambda](#scheduling-a-lambda)
>		- [Lambda with container](#lambda-with-container)
>			- [code](#lambda-with-container-code)
>			- [Setting up environment variables and passing arguments](#setting-up-environment-variables-and-passing-arguments)	
>		- [Lambda with EFS](#lambda-with-efs)
>		- [Lambda with Layers](#lambda-with-layers)
>		- [Lambda versions and aliases](#lambda-versions-and-aliases)
>	- [Policy](#aws-policy)
>	- [Role](#aws-role)
>	- [S3](#s3)
>		- [Creating a public bucket for hosting a static website](#creating-a-public-bucket-for-hosting-a-static-website)
>		- [Synching local files with a bucket](#synching-local-files-with-a-bucket)
>		- [Adding a cloudfront distribution and enabling automatic files invalidation when content changes](#adding-a-cloudfront-distribution-and-enabling-automatic-files-invalidation-when-content-changes)
>	- [Secret](#secret)
>		- [Getting stored secrets](#getting-stored-secrets)
>	- [Security Group](#security-group)
>	- [SSM](#ssm)
>		- [Parameter Store](#parameter-store)
>			- [Storing and retrieving data with Parameter Store](#storing-and-retrieving-data-with-parameter-store)
>			- [Using versions with Parameter Store](#using-versions-with-parameter-store)
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
>		- [no resource plugin 'aws-v4.17.0' found in the workspace or on your $PATH](#no-resource-plugin-aws-v4170-found-in-the-workspace-or-on-your-path)
>		- [AWS Lambda: `IMAGE Launch error: fork/exec /lambda-entrypoint.sh: exec format error`](#aws-lambda:-image-launch-error-forkexec-lambda-entrypointsh-exec-format-error)
> * [Annexes](#annexes)
>	- [AWS recap](#aws-recap)
>		- [IAM, Policies and co](#iam-policies-and-co)
>			- [Identity-based policies](#identity-based-policies)
>			- [Resource-based policies](#resource-based-policies)
>	- [Docker files examples](#docker-files-examples)
>		- [`Dockerfile` example](#dockerfile-example)
>		- [`.dockerignore` example](#dockerignore-example)
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

## Project config

```js
const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')

const ENV = pulumi.getStack()
const PROJ = pulumi.getProject()
const PROJECT = `${PROJ}-${ENV}`
const REGION = aws.config.region
const ACCOUNT_ID = aws.config.allowedAccountIds[0]
```

# Helper methods
## Resolving `Output<T>`

To know more about the issue this helper fixes, please refer to this document: https://gist.github.com/nicolasdao/6cdd85d94b8ee992297d351c248f4092#the-outputt-type-the-pulumiinterpolate-and-apply-functions

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
		"refresh": "func() { pulumi refresh -s $1 -y; }; func",
		"blast": "func() { pulumi destroy -s $1; }; func",
		"clean": "func() { pulumi stack rm $1; }; func",
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
- `npm run remove dev`: Removes the dev stack.
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
### Dockerfile for Automation API in a Lambda

The following example shows what a `Dockerfile` for an AWS Lambda would look like:

```dockerfile
FROM amazon/aws-lambda-nodejs:14.2021.09.29.20
ARG FUNCTION_DIR="/var/task"

# Pulumi setup
## 1. Configure the Pulumi environment variables
ENV PULUMI_SKIP_UPDATE_CHECK true
ENV PULUMI_HOME "/tmp"
ENV PULUMI_CONFIG_PASSPHRASE "your-passphrase"
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
	- `PULUMI_HOME` must be set to a folder where the Lambda has write access (by default, it only has write access to the `/tmp` folder. Use EFS to access more options). The default PULUMI_HOME value is `~`. Unfortunately, Lambda don't have access to that folder. Not configuring the PULUMI_HOME variable would result in a `failed to create '/home/sbx_userxxxx/.pulumi'` error message when the lambda executes the `pulumi login file:///tmp/` command. For a detailed example of what files are contained inside this folder, please refer to [this document](https://gist.github.com/nicolasdao/6cdd85d94b8ee992297d351c248f4092#pulumi-files).
	- `PULUMI_CONFIG_PASSPHRASE` must be set, even if you don't use secrets, otherwise, you'll receive an `passphrase must be set with PULUMI_CONFIG_PASSPHRASE or PULUMI_CONFIG_PASSPHRASE_FILE environment variables` error message durin the `pulumi up` execution.
2. `bash -s -- --version 3.10.0`: Use the explicit version to make sure Pulumi's update don't break your code.
3. `mv ~/.pulumi/bin/* /usr/bin` moves the the executable files to where the lambda can access them (i.e., `/usr/bin`). 

## Setting the adequate IAM policies

Because Pulumi relies on the standard AWS SDK to access AWS's APIs, the appropriate policies must be set in your hosting environment. For example, in order to provision S3 buckets, the following policy must be attached:

```js
const createBucketsPolicy = new aws.iam.Policy(`create-bucket`, {
	path: '/',
	description: 'Allows the creation of S3 buckets',
	policy: JSON.stringify({
		Version: '2012-10-17',
		Statement: [{
			Action: [
				's3:CreateBucket',
				's3:Delete*',
				's3:Get*',
				's3:List*',
				's3:Put*'
			],
			Resource: '*',
			Effect: 'Allow'
		}]
	})
})
```

## Using the Automation API in your code

In you Lambda code, you can know use the Automation API, or call Pulumi via the `child_process` (which is actually what the automation API does):

```js
const { automationApi, aws:{ s3 } } = require('@cloudlesslabs/pulumix')

const main = async () => {
	const [errors, result] = await automationApi.up({ 
		project: 'my-project-name',
		provider: {
			name:'aws',
			version: '4.17.0' // IMPORTANT: This cannot be any version. Please refer to the note below.
		},
		stack: {
			name: 'dev',
			config: {
				'aws:region': 'ap-southeast-2',
				'aws:allowedAccountIds': [123456]
			}
		}, 
		program: async () => {
			const myBucket = await s3.bucket({
				name:'my-unique-website-name',
				website: {
					indexDocument: 'index.html'
				}
			})
			return myBucket
		} 
	})

	console.log(`Pulumi home dir: ${result.stack.workspace.pulumiHome}`)
	console.log(`Pulumi work dir(contains checkpoints): ${result.stack.workspace.workDir}`)
	console.log(`Pulumi output:`)
	console.log(result.outputs.myBucket.value)
	// Example
	// { 
	// 	id: 'lu-20210922kogrikvuow',
	// 	arn: 'arn:aws:s3:::lu-20210922kogrikvuow',
	// 	bucket: 'lu-20210922kogrikvuow',
	// 	bucketDomainName: 'lu-20210922kogrikvuow.s3.amazonaws.com',
	// 	bucketRegionalDomainName: 'lu-20210922kogrikvuow.s3.ap-southeast-2.amazonaws.com',
	// 	websiteDomain: 's3-website-ap-southeast-2.amazonaws.com',
	// 	websiteEndpoint: 'lu-20210922kogrikvuow.s3-website-ap-southeast-2.amazonaws.com'
	// }
}

```

console.log('RESULT')
	console.log(result)
	console.log('RESULT OUTPUTS')
	console.log((result||{}).outputs)

	// Clean Pulumi checkpoints
	const workspace = ((result||{}).stack||{}).workspace||{}
	const { pulumiHome, workDir } = workspace

> IMPORTANT: The `provider.version` required and is tied to the Pulumi version you're using (`3.10.0` in this example). Configuring the wrong AWS version will throw an error similar to [no resource plugin 'aws-v4.17.0' found in the workspace or on your $PATH](#no-resource-plugin-aws-v4170-found-in-the-workspace-or-on-your-path). To know which AWS version to use, set one up, deploy, and check the error message.

# AWS
## AppSync
### Default AppSync settings

The following example:
- Creates a new GraphQL endpoint with the schema defined below. That new endpoint only accepts authenticated requests via API key (default setup).
- Connects a Lambda resolver to the `project` field of the `Query` type. That lambda will receive the following payload:
```js
/**
 * Processes the GraphQL request.
 *
 * @param  {Object} event
 * @param  {Object} 	...rest		Depends on the the value of 'mappingTemplate.payload'
 * @param  {Object} 	.args			Arguments, e.g., { where: { id:1 , name:'jeans' }, limit:20 }
 * @param  {Object} 	.identity		Identity object. It depends on the authentication method. It will typically contain claims.
 * @param  {Object} 	.source		GraphQL response object from parent.
 * 
 * @return {Object}
 */
exports.handler = async event => {
	const { field, hello, ...rest } = event
	const { source, args, identity } = rest
	console.log('FIELD CONTROLLED VIA THE mappingTemplate.payload')
	console.log({
		field, 
		hello
	})

	console.log('RESERVED FIELDS')
	console.log({
		source, // GraphQL response object from a parent.
		args, // Arguments. In the example below { id:1, name:'jeans' }
		identity // Identity object. It depends on the authentication method. It will typically contain claims.
	})	
}
```

To learn more about the `identity` object, please refer to the [Cognito `$context.identity` object example](#cognito-contextidentity-object).

```js
const pulumi = require('@pulumi/pulumi')
const { resolve, aws: { appSync } } = require('@cloudlesslabs/pulumix')

const ENV = pulumi.getStack()
const PROJ = pulumi.getProject()
const PROJECT = `${PROJ}-${ENV}`
const PRODUCT_STACK = `your-product-stack/${ENV}`

const productStack = new pulumi.StackReference(PRODUCT_STACK)
const productApi = productStack.getOutput('lambda')

const main = async () => {
	const tags = {
		Project: PROJ,
		Env: ENV
	}

	const productLambda = await resolve(productApi.lambda)

	const schema = `
		type Product {
			id: ID!
			name: String
		}
		type User {
			id: ID!
		}
		type Query {
			products(id: Int, name: String): [Product]
			users: [User]
		}
		schema {
			query: Query
		}`

	// Create the GraphQL API with its Schema.
	const graphql = await appSync.api({
		name: PROJECT, 
		description: `Lineup ${ENV} GraphQL API`, 
		schema, 
		resolver: {
			// Add all the lambda that are used as data source must be listed here
			// in order to configure access from this GraphQL API.
			lambdaArns:[productLambda.arn] 
		},
		cloudwatch: true, 
		tags
	})

	// Create a data source to retrieve and store data.
	const dataSource = await appSync.dataSource({ 
		name: PROJECT, 
		api: {
			id: graphql.api.id,
			roleArn: graphql.roleArn
		}, 
		functionArn: productLambda.arn, 
		tags 
	})

	// Create a VTL resolver that can bridge between a field and data source.
	const productResolver = await appSync.resolver({
		name: `${PROJECT}-resolver-product`, 
		api:{
			id: graphql.api.id,
			roleArn: graphql.roleArn
		}, 
		type: 'Query', 
		field: 'projects', 
		mappingTemplate:{
			payload: {
				field: 'projects',
				hello: 'world'
			}
		}, 
		dataSource,
		tags
	})

	return {
		graphql,
		dataSource,
		resolvers: {
			productResolver
		}
	}
}

module.exports = main()
```

> NOTE: The sample above is similar to:
```js
const graphql = await appSync.api({
	// ...
	authConfig: {
		apiKey: true
	}
})
```

### Lambda resolvers

Because AppSync resolvers that use Lambda data source can be straightforward (most of the time, they're just a pass through to the lambda), we've created a `lambdaResolvers` helper method which created a single data source for that lambda and then uses GraphQL schema inspection to isolate the fields for which resolvers must be created to route HTTP requests to that Lambda data source.

```js
const pulumi = require('@pulumi/pulumi')
const { resolve, aws: { appSync } } = require('@cloudlesslabs/pulumix')

const ENV = pulumi.getStack()
const PROJ = pulumi.getProject()
const PROJECT = `${PROJ}-${ENV}`
const PRODUCT_STACK = `your-product-stack/${ENV}`

const productStack = new pulumi.StackReference(PRODUCT_STACK)
const productApi = productStack.getOutput('lambda')

const main = async () => {
	const tags = {
		Project: PROJ,
		Env: ENV
	}

	const productLambda = await resolve(productApi.lambda)

	const schema = `
		type Product {
			id: ID!
			name: String
		}
		type User {
			id: ID!
		}
		type Query {
			products(id: Int, name: String): [Product]
			users: [User]
		}
		schema {
			query: Query
		}`

	// Create the GraphQL API with its Schema.
	const graphql = await appSync.api({
		name: PROJECT, 
		description: `Lineup ${ENV} GraphQL API`, 
		schema, 
		resolver: {
			// Add all the lambda that are used as data source must be listed here
			// in order to configure access from this GraphQL API.
			lambdaArns:[productLambda.arn]
		},
		cloudwatch: true, 
		tags
	})

	// Create a single data source using the 'functionArn' value and then create as many resolvers as 
	// there are fields in the 'Query' type.
	const { dataSource, resolvers } = await appSync.lambdaResolvers({
		name: PROJECT, 
		api: {
			id: graphql.api.id,
			roleArn: graphql.roleArn
		}, 
		schema: {
			value: schema,
			includes:['Query'] // This means resolvers for all the `Query` fields will be created. 
		}, 
		functionArn: productLambda.arn, 
		tags
	})

	return {
		graphql,
		productAPI: {
			dataSource,
			resolvers
		}
	}
}

module.exports = main()
```

### Auth with Cognito, OIDC and IAM

Use the `authConfig` property. For example, Cognito:

```js
const graphql = await appSync.api({
	name: 'my-api', 
	description: `My GraphQL API`, 
	schema:`
		schema {
			query: Query
		}
		type Product {
			id: ID!
			name: String
		}
		type User {
			id: ID!
		}
		type Query {
			products: [Product]
			users: [User]
		}`, 
	resolver: {
		lambdaArns:[productLambda.arn]
	},
	authConfig: {
		cognito: {
			userPoolId: '1234',
			awsRegion: 'ap-southeast-2'
		}
	},
	cloudwatch: true, 
	tags
})
```

#### IAM config

`authConfig`:

```js
{
	iam: true
}
```

#### Cognito Auth
##### Cognito config

`authConfig`:

```js
{
	cognito: {
		userPoolId: '1234' // Required
		awsRegion: 'ap-southeast-2', // Required
		// appIdClientRegex: '^my-app.*', // Optional
		// defaultAction: 'DENY' // Default is 'ALLOW'. Allowed values: 'DENY', 'ALLOW'
	}
}
```

##### Cognito `$context.identity` object

This object is the one that is both accessible in the VTL mapping template and passed to the Lambda under the `event.identity` property. It is similar to this sample:

```js
{
	claims: {
		sub: '3c5b5034-1975-4889-a839-d43a7e0fbc48',
		iss: 'https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_k63pzVJgQ',
		version: 2,
		client_id: '7n06fpr1t4ntm1hofbh8bnhp96',
		origin_jti: '84c72cd1-eaad-40e5-a98f-9d7cd7a586cd',
		event_id: 'c95393c0-bab7-40a8-b9e9-48e17b8d23fd',
		token_use: 'access',
		scope: 'phone openid profile email',
		auth_time: 1634788385,
		exp: 1634791985,
		iat: 1634788385,
		jti: 'ade2fe51-4b56-4a8f-9d9f-a9f3d03fd0aa',
		username: '3c5b5034-1975-4889-a839-d43a7e0fbc48'
	},
	defaultAuthStrategy: 'ALLOW',
	groups: null,
	issuer: 'https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_k63pzVJgQ',
	sourceIp: [ '49.179.157.39' ],
	sub: '3c5b5034-1975-4889-a839-d43a7e0fbc48',
	username: '3c5b5034-1975-4889-a839-d43a7e0fbc48'
	}
}
```

#### OIDC config

`authConfig`:

```js
{
	oidc: {
		issuer: 'dewd'
		clientId: '1121321'
		authTtl: '60000', // 60,000 ms (1 min)
		iatTtl: '60000' // 60,000 ms (1 min)
	}
}
```

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
const { aws:{ rds:{ aurora } } } = require('@cloudlesslabs/pulumix')

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
const { aws:{ ec2, rds:{ aurora } } } = require('@cloudlesslabs/pulumix')

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
const { aws:{ lambda, rds:{ policy: { createConnectPolicy } } } } = require('@cloudlesslabs/pulumix')

const rdsAccessPolicy = createConnectPolicy({ name:`my-project-access-rds`, rdsArn:proxy.arn })

const lambdaOutput = await lambda.fn({
	//...
	policies:[rdsAccessPolicy],
	//...
})
```

`createConnectPolicy` accepts the following input:
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
const { aws: { ec2 } } = require('@cloudlesslabs/pulumix')

const EC2_SHELL = `#!/bin/bash
set -ex
cd /tmp
sudo yum install -y telnet`

const EC2_RSA_PUBLIC_KEY = 'ssh-rsa AAAA...' // You'll give the private key to your dev so they use it to connect

const ec2Output = ec2.instance({
	name: 'my-ec2-machine',
	ami: 'ami-02dc2e45afd1dc0db', // That's Amazon Linux 2 for 64-bits ARM which comes pre-installed with the SSM agent.
	instanceType: 't4g.nano', // EC2 ARM graviton 2 
	availabilityZone: 'ap-southeast-2a', // Tip: Use `npx get-regions` to find an AZ.
	subnetId: privateSubnetId,
	userData: EC2_SHELL,
	publicKey:EC2_RSA_PUBLIC_KEY,
	ssm: { // Toggles SSM
		vpcId:vpc.id,
		vpcDefaultSecurityGroupId: vpc.vpc.defaultSecurityGroupId
	},
	tags: {
		Project: 'my-cool-project',
		Env: 'dev'
	}
})
```

## ECR - Container Repository

```js
const awsx = require('@pulumi/awsx')
const path = require('path')

// ECR images. Doc:
// 	- buildAndPushImage API: https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/awsx/ecr/#buildAndPushImage
// 	- 2nd argument is a DockerBuild object: https://www.pulumi.com/docs/reference/pkg/docker/image/#dockerbuild
const image = awsx.ecr.buildAndPushImage('my-image-name', {
	context: path.resolve('../app'),
	args:{
		SOME_ARG: 'hello'
	},
	tags: {
		Name: 'my-image-name'
	}
})
```

Where `args` is what is passed to the `--build-arg` option of the `docker build` command.

The URL for this new image is inside the `image.imageValue` property.

## ECR

```js
const { aws:{ ecr } } = require('@cloudlesslabs/pulumix')

const myImage = await ecr.image({ 
	name: 'my-image',
	tag: 'v2',
	dir: path.resolve('./app')
})
```

Where `myImage` is structured as follow:
- `myImage.imageValues`: It contains the values you can use in the `FROM` directive of another Dockerfile (e.g., `FROM 12345.dkr.ecr.ap-southeast-2.amazonaws.com/my-image:v2`). If the `tag` property is set, this array contains two values. The first item is tagged with the the `tag` value, and the second is tagged with `<tag>-<SHA-digest>`. If the `tag` is not set, this array contains only one item tagged with the SHA-digest.
- `myImage.repository`: Output object with the repository's details.
- `lifecyclePolicy`: Output object with the lifecycle policy.

```js
const myImage = await ecr.image({ 
	name: 'my-image',
	tag: 'v3',
	dir: path.resolve('./app'),
	args: {
		DB_USER: '1234',
		DB_PASSWORD: '4567'
	},
	imageTagMutable: false, // the default is true
	lifecyclePolicies:[{
		description: 'Only keep up to 50 tagged images',
		tagPrefixList:['v'],
		countNumber: 50
	}], 
	tags: {
		Project: 'my-cool-project',
		Env: 'prod',
		Name: 'my-image'
	}
})
```

> NOTICE:
>	- When `imageTagMutable` is set to false, each tagged version becomes immutable, which means your deployment will fail if you're pushing a tag that already exists.

By default, repositories are private. To make them public, use:

```js
const myImage = await ecr.image({ 
	name: 'my-image',
	tag: 'v3',
	dir: path.resolve('./app'),
	args: {
		DB_USER: '1234',
		DB_PASSWORD: '4567'
	},
	imageTagMutable: false, // the default is true
	lifecyclePolicies:[{
		description: 'Only keep up to 50 tagged images',
		tagPrefixList:['v'],
		countNumber: 50
	}], 
	publicConfig: {
		aboutText: 'This is a public repo',
		description: 'This is a public repo',
		usageText: 'Use it as follow...',
		architectures: ['ARM', 'ARM 64', 'x86', 'x86-64'],
		operatingSystems: ['Linux']
	},
	tags: {
		Project: 'my-cool-project',
		Env: 'prod',
		Name: 'my-image'
	}
})
```

## EFS
### Mounting an EFS access point on a Lambda
```js
const pulumi = require('@pulumi/pulumi')
const { aws:{ securityGroup, vpc, lambda, efs } } = require('@cloudlesslabs/pulumix')
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
	const { securityGroup:accessToEfsSecurityGroup } = await securityGroup.sg({ 
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
	const lambdaOutput = await lambda.fn({
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
		cloudwatch: true,
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

> IMPORTANT: When using Docker, please make sure that your image uses the same architecture (i.e., `x86_64` vs `arm64`) then your Lambda OS. DO NOT USE something like `FROM amazon/aws-lambda-nodejs:14` as this is equivalent to the latest digest. Who knows what architecture the latest digest uses. Instead, browse the [Docker Hub registry](https://hub.docker.com/r/amazon/aws-lambda-nodejs/tags) and find the tag that explicitly supports your OS architecture. For example, `FROM amazon/aws-lambda-nodejs:14.2021.09.29.20` uses `linux/arm64` while `14.2021.10.14.13` uses `linux/amd64`.

### A few words about AWS Lambda
#### AWS Lambda key design principles

It is important to know the key design principles behind AWS Lambdas before using them. Please refer to this document for a quick refresher course: https://gist.github.com/nicolasdao/e72beb55f3550351e777a4a52d18f0be#a-few-words-about-aws-lambda

#### ARM architecture recommended

As of 29 of September 2021, [ARM-based lambdas are powered by the AWS Graviton2 processor](https://aws.amazon.com/blogs/aws/aws-lambda-functions-powered-by-aws-graviton2-processor-run-your-functions-on-arm-and-get-up-to-34-better-price-performance/). This results in a significantly better of performance/price ratio. 

This is why `@cloudlesslabs/pulumix` uses the `arm64` architecture as default rather than `x86_64` (which is the normal AWS SDK and Pulumi default). This configuration can be changed via the `architecture` property:

```js
const { resolve } = require('path')
const { aws:{ lambda } } = require('@cloudlesslabs/pulumix')

lambda.fn({
	name: 'my-lambda',
	architecture: 'x86_64', // Default is 'arm64'
	fn: {
		runtime: 'nodejs12.x', 	
		dir: resolve('./app')
	}
})
```

__IMPORTANT__: When using Docker, please make sure that your image uses the same architecture (i.e., `x86_64` vs `arm64`) then your Lambda OS. DO NOT USE something like `FROM amazon/aws-lambda-nodejs:14` as this is equivalent to the latest digest. Who knows what architecture the latest digest uses. Instead, browse the [Docker Hub registry](https://hub.docker.com/r/amazon/aws-lambda-nodejs/tags) and find the tag that explicitly supports your OS architecture. For example, `FROM amazon/aws-lambda-nodejs:14.2021.09.29.20` uses `linux/arm64` while `14.2021.10.14.13` uses `linux/amd64`.

### Basic lambda

```js
const { resolve } = require('path')
const { aws:{ lambda } } = require('@cloudlesslabs/pulumix')

lambda.fn({
	name: 'my-lambda',
	fn: {
		runtime: 'nodejs12.x', 	
		dir: resolve('./app')
	},
	timeout: 30,					// Optional. Default 3 seconds.
	memorySize: 128,				// Optional. Default 128MB
	cloudwatch: true,				// Optional. Default false.
	logsRetentionInDays: 7			// Optional. The default is 0 (i.e., never expires). 
	policies: [somePolicy],			// Optional. Default null.			
	tags: {							// Optional.
		Project: 'my-project',
		Env: 'dev'
	}
}).then(output => {
	console.log(output.lambda)
	console.log(output.role)
	console.log(output.logGroup)
})
```

### API Gateway with explicit Lambda handlers

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

### Basic Lambda with an API Gateway

This next sample is more explicit than the previous example. It assumes that the root folder contains an `app/` folder which contains the actual NodeJS lambda code:

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
const { aws:{ lambda } } = require('@cloudlesslabs/pulumix')

const ENV = pulumi.getStack()
const PROJ = pulumi.getProject()
const PROJECT = `${PROJ}-${ENV}`
const REGION = aws.config.region

const tags = {
	Project: PROJ,
	Env: ENV,
	Region: REGION
}

const main = async () => {
	const lambdaOutput = await lambda.fn({
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

	return api.url
}

module.exports = main()
```

### Configuring IAM policies to enable Lambda access to other resources

Tl;dr:

```js
const { aws:{ lambda } } = require('@cloudlesslabs/pulumix')

const lambdaOutput = await lambda.fn({
	// ...
	cloudwatch: true,
	logsRetentionInDays: 7 // This is optional. The default is 0 (i.e., never expires). 
})
```

The rest of this section focuses on how the above configuration works under the hood. 

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

const lambdaOutput = await lambda.fn({
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
> const lambdaOutput = await lambda.fn({
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
> const lambdaOutput = await lambda.fn({
> 	// ...
> 	cloudwatch: true,
> 	logsRetentionInDays: 7 // This is optional. The default is 0 (i.e., never expires). 
> })
>```

### Letting other AWS services to access a lambda

For God knows what reason, not all services can invoke AWS Lambdas via the standard [Identity-based policies](#identity-based-policies) strategy. That's why it is recommended to use the [Resource-based policies](#resource-based-policies) strategy instead via the Pulumi `aws.lambda.Permission` API. For example, this is how you would allow AWS Cognito to invoke a lambda:

```js
new aws.lambda.Permission(name, {
	action: 'lambda:InvokeFunction',
	function: lambda.name,
	principal: 'cognito-idp.amazonaws.com',
	sourceArn: userPool.arn
})
```

> To easily find the principal's name, use the the command `npx get-principals`.

### Scheduling a lambda

```js
const { aws:{ lambda } } = require('@cloudlesslabs/pulumix')
const { resolve } = require('path')

const lambdaOutput = await lambda.fn({
	name: 'my-example',
	fn: {
		runtime: 'nodejs12.x', 
		dir: resolve('./app')
	},
	scheduleExpression: 'rate(1 minute)'
})
```

> To learn more about the `scheduleExpression` syntax, please refer to the official AWS doc at https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html.

The event object sent to the Lambda is similar to this:

```js
{
	version: '0',
	id: 'cee5b84f-57b6-c60b-2c8c-9e1867b7e9ac',
	'detail-type': 'Scheduled Event',
	source: 'aws.events',
	account: '12345677',
	time: '2022-01-27T02:18:59Z',
	region: 'ap-southeast-2',
	resources: [
		'arn:aws:events:ap-southeast-2:12345677:rule/some-event-name'
	],
	detail: {}
}
```

### Lambda with container

__WARNING__: You must make sure that the Docker image is compatible with the Lambda architecture (i.e., x86_64 vs arm64). For a list of all the AWS lambda images with their associated OS, please refer to https://hub.docker.com/r/amazon/aws-lambda-nodejs/tags?page=1&ordering=last_updated.

#### Lambda with container code

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
	FROM amazon/aws-lambda-nodejs:14.2021.09.29.20
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
const { aws:{ lambda } } = require('@cloudlesslabs/pulumix')

const ENV = pulumi.getStack()
const PROJ = pulumi.getProject()
const PROJECT = `${PROJ}-${ENV}`

const lambdaOutput = await lambda.fn({
	name: PROJECT,
	fn: {
		dir: resolve('./app'),
		type: 'image' // If './app' contains a 'Dockerfile', this prop is not needed. 'lambda' is able to automatically infer the type is an 'image'.
	},
	timeout:30, 
	memorySize:128
})
```

> (1) The [amazon/aws-lambda-nodejs:14.2021.09.29.20](https://hub.docker.com/r/amazon/aws-lambda-nodejs) docker image hosts a node web server listening on port 8080. The CMD expects a string or array following this naming convention: "<FILE NAME CONTAINING THE HANDLER>.<HANDLER NAME>".
> (2) Once the container is running, the only way to test it is to perform POST to this path: `2015-03-31/functions/function/invocations`. This container won't listen to anything else; no GET, no PUT, no DELETE. 

You may also want to add a `.dockerignore`. We've added a Dockerfile and a .dockerignore example in the [Annexes](#annexes) under the [Docker files examples](#docker-files-examples) section.

#### Setting up environment variables and passing arguments

As a quick refresher, the following `Dockerfile`:

```dockerfile
FROM amazon/aws-lambda-nodejs:14.2021.09.29.20
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

```dockerfile
FROM amazon/aws-lambda-nodejs:14.2021.09.29.20
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

### Lambda with EFS

Please refer to the [Mounting an EFS access point on a Lambda](#mounting-an-efs-access-point-on-a-lambda) section.

> For a full example of a project that uses Lambda with Docker and Git installed to save files on EFS, please refer to this project: https://github.com/nicolasdao/example-aws-lambda-efs

### Lambda with Layers

> IMPORTANT: Your layer code must be under `/your-layer/nodejs/`, not `your-layer/`

For a refresher on how Lambda Layers work, please refer to this document: https://gist.github.com/nicolasdao/e72beb55f3550351e777a4a52d18f0be#layers

Pulumi file `index.js`:

```js
const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const { resolve } = require('path')
const { aws:{ lambda } } = require('@cloudlesslabs/pulumix')

const ENV = pulumi.getStack()
const PROJ = pulumi.getProject()
const PROJECT = `${PROJ}-${ENV}`
const REGION = aws.config.region
const RUNTIME = 'nodejs12.x'

const tags = {
	Project: PROJ,
	Env: ENV,
	Region: REGION
}

const main = async () => {
	const lambdaLayerOutput1 = await lambda.layer({
		name: `${PROJECT}-layer-01`,
		description: 'Includes puffy',
		runtime: RUNTIME, 	
		dir: resolve('./layers/layer01'),
		tags
	})
	const lambdaLayerOutput2 = await lambda.layer({
		name: `${PROJECT}-layer-02`,
		description: 'Do something else',
		runtime: RUNTIME, 	
		dir: resolve('./layers/layer02'),
		tags
	})

	const lambdaOutput = await lambda.fn({
		name: PROJECT,
		fn: {
			runtime: RUNTIME, 	
			dir: resolve('./app')
		},
		layers:[
			lambdaLayerOutput1.arn,
			lambdaLayerOutput2.arn
		],
		timeout:30, 
		memorySize:128,  
		tags
	})

	return {
		lambda: lambdaOutput,
		lambdaLayer: lambdaLayerOutput1
	}
}

module.exports = main()
```

Lambda file:

```js
exports.handler = async () => {
	console.log('Welcome to lambda test layers!')
	try {
		require('puffy')
		console.log('puffy is ready')
	} catch (err) {
		console.error('ERROR')
		console.log(err)
	}
	try {
		const { sayHi } = require('/opt/nodejs/utils')
		sayHi()
		sayBye()
	} catch (err) {
		console.error('ERROR IN LAYER ONE')
		console.log(err)
	}
	try {
		const { sayHi } = require('/opt/nodejs')
		sayHi()
	} catch (err) {
		console.error('ERRor in layer twO')
		console.log(err)
	}
}
```

Layer01 code `./layers/layer01/nodejs/utils.js`

```js
module.exports = {
	sayHi: () => console.log('Hello, I am layer One')
}
```

Layer02 code `./layers/layer01/nodejs/index.js`

```js
module.exports = {
	sayHi: () => console.log('Hello, I am layer Two')
}
```

### Lambda versions and aliases

> To learn more about what versions and aliases are and why they are useful, please refer to this document: [AWS LAMBDA/Deployment strategies](https://gist.github.com/nicolasdao/e72beb55f3550351e777a4a52d18f0be#deployment-strategies)

To publish the latest deployment to a new version, use the `publish` property:

```js
const lambdaOutput = await lambda.fn({
	name: PROJECT,
	fn: {
		runtime: RUNTIME, 	
		dir: resolve('./app')
	},
	publish: true,
	timeout:30, 
	memorySize:128,  
	tags
})
```

To create an alias:

```js
// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/lambda/alias/
const testLambdaAlias = new aws.lambda.Alias('testLambdaAlias', {
	name: 'prod',
	description: 'a sample description',
	functionName: lambdaOutput.arn,
	functionVersion: '1',
	routingConfig: {
		additionalVersionWeights: {
			'2': 0.5,
		}
	}
})
```

Full API doc at https://www.pulumi.com/registry/packages/aws/api-docs/lambda/alias/.

## AWS Policy

```js
// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/iam/policy/
const cloudWatchPolicy = new aws.iam.Policy('my-custom-policy', {
	name: 'my-custom-policy',
	description: 'IAM policy for logging from a lambda',
	path: '/',
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
```

To see a concrete example that combine a role and a policy to allow multiple services to invole a Lambda, please refer to [this example](#example-configuring-multiple-aws-services-to-invoke-a-lambda) under the [AWS role](#aws-role) section.

## AWS Role

```js
// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/iam/role/
const lambdaRole = new aws.iam.Role('lambda-role', {
	name: 'lambda-role',
	description: 'IAM role for a Lambda',
	assumeRolePolicy: {
		 Version: '2012-10-17',
		 Statement: [{
				Action: 'sts:AssumeRole',
				Principal: {
					Service: 'lambda.amazonaws.com', // tip: Use the command `npx get-principals` to find any AWS principal
				},
				Effect: 'Allow',
				Sid: ''
		 }],
	}
})
```

> __TIPS:__ The `Service` property supports both the string type and the array string type. The `Statement` for a role with multiple services would look like this:
> ```js
> [{
> 	Action: 'sts:AssumeRole',
> 	Principal: {
> 		Service: [
> 			'lambda.amazonaws.com',
> 			'cognito-idp.amazonaws.com'
> 		]
> 	},
> 	Effect: 'Allow',
> 	Sid: ''
> }]
> ```

##### Example: Configuring multiple AWS services to invoke a lambda

This example assumes we have already acquired a lambda's ARN (string):

```js
const lambdaArnString = getLambdaArn() // Just for demo. 

// 1. Create a multi-services IAM role.
const myRole = new aws.iam.Role('my-multi-services-role', {
	name: 'my-multi-services-role',
	description: 'IAM role for a multi-services role',
	assumeRolePolicy: {
		 Version: '2012-10-17',
		 Statement: [{
				Action: 'sts:AssumeRole',
				Principal: {
					Service: [// tip: Use the command `npx get-principals` to find any AWS principal
						'events.amazonaws.com',
						'cognito-idp.amazonaws.com'
					]
				},
				Effect: 'Allow',
				Sid: ''
		 }],
	}
})

// 2. Create a policy that can invoke the lambda.
const invokePolicy = new aws.iam.Policy('my-custom-policy', {
	name: 'my-custom-policy',
	description: 'IAM policy for invoking a lambda',
	path: '/',
	policy: JSON.stringify({
		Version: '2012-10-17',
		Statement: [{
			Action: [
				'lambda:InvokeFunction'
			],
			Resource: lambdaArnString,
			Effect: 'Allow'
		}]
	})
})

// 3. Attach the policy to the role
const lambdaRolePolicyAttachment = new aws.iam.RolePolicyAttachment(`attached-policy`, {
	role: myRole.name,
	policyArn: invokePolicy.arn
})
```

## S3
### Creating a public bucket for hosting a static website

```js
const { aws:{ s3 }, resolve } = require('@cloudlesslabs/pulumix')

const createBucket = async name => {
	const { bucket } = await s3.bucket({
		name,
		website: { // When this property is set, the bucket is public. Otherwise, the bucket is private.
			indexDocument: 'index.html'
		}
	})

	const [websiteEndpoint, bucketDomainName, bucketRegionalDomainName] = await resolve([
		bucket.websiteEndpoint, 
		bucket.bucketDomainName,
		bucket.bucketRegionalDomainName])

	console.log(`Website URL: ${websiteEndpoint}`)
	console.log(`Bucket domain name: ${bucketDomainName}`) // e.g., 'bucketname.s3.amazonaws.com'
	console.log(`Bucket regional domain name: ${bucketRegionalDomainName}`) // e.g., 'https://bucketname.s3.ap-southeast-2.amazonaws.com'
}

createBucket('my-unique-name')
```

### Synching local files with a bucket

This feature is not using native Pulumi APIs. Instead, it uses the AWS SDK to sync files via the S3 API after the bucket has been created. When the `content` property of the `s3.bucket` input is set, a new `files` property is added to the output. The new `files` property is an array containing object similar to this:

```js
[{
	key: "favicon.png",
	hash: "5efd4dc4c28ef3548aec63ae88865ff9"
},{
	key: "global.css",
	hash: "8ff861b6a5b09e7d5fa681d8dd31262a"
}]
```

Because this array is stored in Pulumi, we can use this reference object to determine which file must be updated (based on its hash), which file must be added (based its key) and which file must be deleted (based on its key). This is demoed in the sample below where you can see that the `existingContent` is passed from the stack to the `s3.bucket` API.

The following example syncs the files stored under the `./app/public` folder and excludes all files under the `node_modules` folder.

```js
const pulumi = require('@pulumi/pulumi')
const { resolve, aws: { s3 } } = require('@cloudlesslabs/pulumix')
const { join } = require('path')

const ENV = pulumi.getStack()
const PROJ = pulumi.getProject()
const PROJECT = `${PROJ}-${ENV}`
const thisStack = new pulumi.StackReference(`${PROJ}/${ENV}`)
const oldFiles = thisStack.getOutput('files')

const main = async () => {
	const existingContent = (await resolve(oldFiles)) || []
	
	const { bucket, files } = await s3.bucket({
		name: PROJECT,
		website: { // When this property is set, the bucket is public. Otherwise, the bucket is private.
			indexDocument: 'index.html',
			content: {
				dir:join(__dirname, './app/public'),
				ignore: '**/node_modules/**',
				existingContent, // e.g., [{key: "favicon.png",hash: "5efd4dc4c28ef3548aec63ae88865ff9" },{ key: "global.css",hash: "8ff861b6a5b09e7d5fa681d8dd31262a" }]
				// remove:true
			}
		}
	})

	return {
		bucket,
		files
	}
}

module.exports = main()
```

> IMPORTANT: To delete a bucket, its content must be removed first. Re-deploy the stack by uncommenting the `// remove:true` line. This will remove all the content. 

### Adding a cloudfront distribution and enabling automatic files invalidation when content changes

Using the exact same sample from above:

```js
const main = async () => {
	const existingContent = (await resolve(oldFiles)) || []
	
	const { bucket, files, cloudfront } = await s3.bucket({
		name: PROJECT,
		website: { // When this property is set, the bucket is public. Otherwise, the bucket is private.
			indexDocument: 'index.html',
			content: {
				dir:join(__dirname, './app/public'),
				ignore: '**/node_modules/**',
				existingContent, // e.g., [{key: "favicon.png",hash: "5efd4dc4c28ef3548aec63ae88865ff9" },{ key: "global.css",hash: "8ff861b6a5b09e7d5fa681d8dd31262a" }]
				// remove:true
			},
			cloudfront: {
				invalidateOnUpdate: true
			}
		}
	})

	return {
		bucket,
		files,
		cloudfront
	}
}
```

## Secret
### Getting stored secrets

```js
const { aws:{ secret } } = require('@cloudlesslabs/pulumix')

secret.get('my-secret-name').then(({ version, data }) => {
	console.log(version)
	console.log(data) // Actual secret object
})
```

## Security Group

> WARNING: __Don't forget__ to also define an egress rule to allow traffic out from your resource. This is a typicall mistake that causes systems to not be able to contact any other services. The most common egress rule is:
> `{  protocol: '-1',  fromPort:0, toPort:65535, cidrBlocks: ['0.0.0.0/0'],  ipv6CidrBlocks: ['::/0'],  description:'Allow all traffic' }`

```js
const { aws:{ securityGroup } } = require('@cloudlesslabs/pulumix')

const { securityGroup:mySecurityGroup, securityGroupRules:myRules } = await securityGroup.sg({
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

## SSM
### Parameter Store
#### Storing and retrieving data with Parameter Store

```js
const { aws: { ssm } } = require('@cloudlesslabs/pulumix')

const main = async () => {
	// Full parameters list at https://www.pulumi.com/registry/packages/aws/api-docs/ssm/parameter/
	const foo = await ssm.parameterStore.parameter({
		name: 'foo',
		value: { hello:'world' }
	})

	return foo
}

main()
```

To retrieve a value from Parameter store:

```js
const { aws: { ssm } } = require('@cloudlesslabs/pulumix')

const main = async () => {
	const { version, value } = await ssm.parameterStore.get({ name:'foo', version:2, json:true })
	console.log({
		version,
		value
	})
}
```

> NOTICE: This method does not use the Pulumi API as it creates `registered twice` issues when both a `get` and `create` operations that use the same name are put in the same script.

#### Using versions with Parameter Store 

Parameter Store versions each update. The version uses numbers starting from 1 and are automatically incremented. The version cannot be set explicitly. 

To retrieve a specific version, include the version in the parameter store's ID as follow:

```js
const param = aws.ssm.Parameter.get('foo','foo:12')
```

When the version is not used with the parameter store's ID, the latest version is returned.

## Step-function

By default, this uitility creates a policy that allows the step-function to invoke any lambda. 

```js
const { aws: { stepFunction } } = require('@cloudlesslabs/pulumix')

const main = async () => {
	const preProvision = await stepFunction.stateMachine({
		name: 'my-step-function',
		type: 'standard', // Valid values: 'standard' (default) or 'express'
		description: 'Does something.', 
		states: preProvisionWorkflow, 
		// policies: [], 
		cloudWatchLevel: 'all', // Default is 'off'. Valid values: 'all', 'error', 'fatal'
		logsRetentionInDays: 7, // Default 0 (i.e., never expires). Only applies when 'cloudWatch' is true.
		tags:{
			Name: 'my-step-function'
		}
	})

	return {
		preProvision
	}
}

module.exports = main()
```

The `preProvisionWorkflow` is a JSON object that you can export from the Step Function designer in the AWS console. This object is rather complex so we recommend to use the designer.

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

### no resource plugin 'aws-v4.17.0' found in the workspace or on your $PATH

This typically happens with the Automation API. The AWS Pulumi plugin is not found because:
- You have not installed the AWS plugin with the `stack.workspace.installPlugin('aws', 'v4.17.0')`.
- You have installed the incorrect version of this plugin. The tutorial usually shows this example: `stack.workspace.installPlugin('aws', 'v4.0.0')`. The plugin is version sensitive.

Which version of the AWS SDK is required depends on the Pulumi version you're using. The best way to found out is to try to deploy without installing the AWS SDK, then read the error message to figure the version out.

### AWS Lambda: `IMAGE Launch error: fork/exec /lambda-entrypoint.sh: exec format error`

This typically happens when the image used to run Lambda containers is using an OS that is incompatible with the expected Lambda OS. For example, `amazon/aws-lambda-nodejs:14.2021.09.29.20` uses the `arm64` architecture. This error will occur if the Lambda has been configured with its default `x86_64` architecture. 

To fix this issue, please refer to the [ARM architecture recommended](#arm-architecture-recommended) section.

# Annexes
## AWS recap
### IAM, Policies and co

There are 2 main ways to grant a service access to a resource:
- [Identity-based policies](#identity-based-policies): Attach a policy on a service's IAM role which can access the resource.
- [Resource-based policies](#resource-based-policies): Attach a policy on a resource's IAM role which allows the service to access the resource.

Choosing one strategy over the other depends on your use case. That being said, some scenarios only accept one. For example, when configuring a lambda to be triggered by a schedule CRON job (i.e., Cloudwatch event), only the resource-based policy via an AWS lambda permission works. Go figure...

#### Identity-based policies

The standard way to configure allow a service to access a resource is to:
1. Create a role for the service trying to access the resource. In the example below, the role `lambda-role` can only be _assumed_ by the `lambda.amazonaws.com` principal.
> Tip: Use `npx get-principals` to find the principal URI.
2. Create a policy that allows specific actions on that resource. Alternatively, use one of the existing [AWS Managed Policies](https://gist.github.com/gene1wood/55b358748be3c314f956). 
> Tip: Use `npx get-policies` to search AWS managed policies and get their ARN.
3. Associate the role with the policy.
4. Attach the new role to the service.

For example:

```js
// Step 1: Create a role that identifies the resource (mainly the principal).
const lambdaRole = new aws.iam.Role('lambda-role', {
	assumeRolePolicy: {
		 Version: '2012-10-17',
		 Statement: [{
				Action: 'sts:AssumeRole',
				Principal: {
					Service: 'lambda.amazonaws.com', // tip: Use the command `npx get-principals` to find any AWS principal
				},
				Effect: 'Allow',
				Sid: ''
		 }],
	}
})
// Step 2: Create a policy or use the `npx get-policies` to get a managed AWS policy ARN
const cloudWatchPolicy = new aws.iam.Policy('cw-policy', {
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
// Step 3: Attach the policy to the role. You can attach more than one.
const lambdaLogs = new aws.iam.RolePolicyAttachment(`attached-policy`, {
	role: lambdaRole.name,
	policyArn: cloudWatchPolicy.arn
})
// Step 4: Reference that role on the resource
const lambda = new aws.lambda.Function('my-lambda', {
	// ... other properties
	role: lambdaRole.arn,
	dependsOn:[lambdaLogs]
})
```

#### Resource-based policies

## Docker files examples](#docker-files-examples)
### `Dockerfile` example](#dockerfile-example)

This example shows how you would setup two environment variables as well as setup the GitHub auth token to install private NPM packages hosted on GitHub:

> WARNING: The `amazon/aws-lambda-nodejs:14.2021.09.29.20` image targets ARM architecture. Therefore, make sure your Lambda uses `arm64`. To find the tag that explicitly supports your OS architecture, browse the [official AWS Lambda Docker Hub registry](https://hub.docker.com/r/amazon/aws-lambda-nodejs/tags).

```dockerfile
FROM amazon/aws-lambda-nodejs:14.2021.09.29.20
ARG FUNCTION_DIR="/var/task"
ARG GITHUB_ACCESS_TOKEN
ARG SOME_ENV_DEMO

ENV SOME_ENV_DEMO $SOME_ENV_DEMO

# Create function directory
RUN mkdir -p ${FUNCTION_DIR}

# Setup access to the private GitHub package
RUN echo "//npm.pkg.github.com/:_authToken=$GITHUB_ACCESS_TOKEN" >> ~/.npmrc
COPY .npmrc ${FUNCTION_DIR}

# Install all dependencies
COPY package*.json ${FUNCTION_DIR}
RUN npm install --only=prod --prefix ${FUNCTION_DIR}

# Copy app files
COPY . ${FUNCTION_DIR}

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "index.handler" ]
```

### `.dockerignore` example

```
Dockerfile
README.md
LICENSE
node_modules
npm-debug.log
.env
```

# References

- [Creating and using an IAM policy for IAM database access](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.IAMPolicy.html)
