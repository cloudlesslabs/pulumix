# PULUMI RECIPES

# Table of contents

> * [AWS](#aws)
>	- [Aurora](#aurora)
>		- [SSM bastion host to access a private RDS instance](#ssm-bastion-host-to-access-a-private-rds-instance)
>	- [EC2](#ec2)
>	- [EFS](#efs)
>	- [Lambda](#lambda)
>	- [Secret](#secret)
>	- [Security Group](#security-group)
>	- [Step-function](#step-function)
>	- [VPC](#vpc)

# AWS
## Aurora
### 

### SSM bastion host to access a private RDS instance

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

## Secret

## Security Group

## Step-function

## VPC

