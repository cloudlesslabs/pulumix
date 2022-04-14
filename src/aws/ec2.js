/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

// Version: 0.0.3
// Doc: https://www.pulumi.com/docs/reference/pkg/aws/ec2/instance/

const aws = require('@pulumi/aws')

/**
 * Creates a new EC2. Doc: https://www.pulumi.com/docs/reference/pkg/aws/ec2/instance/
 * Resources:
 * 	1. IAM role.
 * 	2. (Optional) Attach the 'AmazonSSMManagedInstanceCore' AWS managed policies if 'ssm' is set.
 * 	3. Instance profile to attach the IAM role to the EC2 instance.
 * 	4. (Optional) Security Group to allow SSM access if 'ssm' is set.
 * 	5. (Optional) KeyPair is 'publicKey' is provided.
 * 	6. EC2 instance.
 * 
 * @param  {String}				name			
 * @param  {String}				ami								e.g., 'ami-02dc2e45afd1dc0db' (Amazon Linux 2 for 64-bits ARM)
 * @param  {String}				instanceType					e.g., 't4g.nano' (cheapest ~$3/month)
 * @param  {String}				availabilityZone				(optional) If not specified, launches the EC2 a random AZ in the VPC.
 * @param  {String}				subnetId						(optional) If not specified, launches the EC2 a random subnet in the VPC.
 * @param  {[String]}			vpcSecurityGroupIds				(optional) If not defined, the EC2 is associated with the default VPC security group.
 * @param  {String}				userData						e.g., `#!/bin/bash\ncd /tmp\nsudo yum install...`
 * @param  {String}				userDataBase64					e.g., Same as 'userData' but base64 encoded (to support gzip for example).
 * @param  {String}				publicKey						Public key for EC2 keypair.
 * @param  {Object}				ssm								Default null. When set, the AWS managed policy 'AmazonSSMManagedInstanceCore' is attached to the instance to allow SSM to connect.
 * @param  {string}					.vpcId							
 * @param  {string}					.vpcDefaultSecurityGroupId	The EC2 instance needs to be configured with a security group that can talk to this SG.
 * @param  {Object}				tags
 * 
 * @return {Object}   			ec2
 * @return {Output<String>}			.id
 * @return {Output<String>}			.arn		
 * @return {Output<String>}			.instanceState				e.g., 'pending', 'running', 'shutting-down', 'terminated', 'stopping', 'stopped'	
 * @return {Output<String>}			.instanceType		
 * @return {Output<String>}			.availabilityZone		
 * @return {Output<String>}			.ami		
 * @return {Output<String>}			.subnetId		
 * @return {Output<[String]>}		.vpcSecurityGroupIds		
 * @return {Output<String>}			.privateIp
 * @return {Output<Object>}			.keyPair		
 * @return {Output<[String]>}			.id						Only returned if 'publicKey' was provided.
 * @return {Output<[String]>}			.arn
 * @return {Output<[String]>}			.name
 * @return {Output<[String]>}			.keyPairId
 */
const EC2 = function ({ name, ami, instanceType, availabilityZone, subnetId, vpcSecurityGroupIds, userData, userDataBase64, publicKey, ssm, tags }) {
	if (!name)
		throw new Error('Missing required \'name\' argument.')
	if (ssm) {
		if (!ssm.vpcId)
			throw new Error('When \'ssm\' is defined, \'ssm.vpcId\' is required to create a security group that allows HTTPS access.')
		if (!ssm.vpcDefaultSecurityGroupId)
			throw new Error('When \'ssm\' is defined, \'ssm.vpcDefaultSecurityGroupId\' is required to create a security group that allows HTTPS access.')
	}
	tags = tags || {}

	// IAM role. Doc: https://www.pulumi.com/docs/reference/pkg/aws/iam/role/
	const roleName = `${name}-ec2`
	const role = new aws.iam.Role(roleName, {
		path: '/',
		assumeRolePolicy: JSON.stringify({
			Version: '2012-10-17',
			Statement: [{
				Action: 'sts:AssumeRole',
				Principal: {
					Service: 'ec2.amazonaws.com'
				},
				Effect: 'Allow',
				Sid: ''
			}]
		}),
		tags: {
			...tags,
			Name: roleName
		}
	})

	// IAM policy: Enables SSM to access this instance. Doc: https://www.pulumi.com/docs/reference/pkg/aws/iam/rolepolicyattachment/
	const ssmAttachedPolicy = !ssm ? null : new aws.iam.RolePolicyAttachment(`${name}-amazonssmmanagedinstancecore`, {
		role: role.name,
		policyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore' // AWS managed policies
	})

	// IAM instance profile. We need this to associated an IAM role to an EC2 instance.
	// Doc: https://www.pulumi.com/docs/reference/pkg/aws/iam/instanceprofile/
	const iamInstanceProfile = new aws.iam.InstanceProfile(`${name}-instanceprofile`, {
		role: role.name
	})

	// Security Group to enable SSM access (making sure that HTTPS on all traffic is enabled)
	if (ssm) {
		// Security Group. Doc: https://www.pulumi.com/docs/reference/pkg/aws/ec2/securitygroup/
		const ec2SgName = `${name}-ssm-sg`
		const ec2Sg = new aws.ec2.SecurityGroup(ec2SgName, {
			description: `Enables SSM access to EC2 ${name}`,
			ingress: [{ protocol: 'tcp', fromPort: 443, toPort: 443, securityGroups: [ssm.vpcDefaultSecurityGroupId], description:'Allows SSM to get access' }],
			egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'], ipv6CidrBlocks: ['::/0'], description:'Allows instance to respond to SSM' }],
			vpcId: ssm.vpcId,
			tags: {
				...tags,
				Name: ec2SgName
			}
		})

		if (!vpcSecurityGroupIds)
			vpcSecurityGroupIds = [ec2Sg.id]
		else
			vpcSecurityGroupIds.push(ec2Sg.id)
	}

	// EC2 KeyPair. Doc: https://www.pulumi.com/docs/reference/pkg/aws/ec2/keypair/
	const keyName = `${name}-keypair`
	const keyPair = !publicKey ? undefined : new aws.ec2.KeyPair(keyName, {
		keyName: keyName,
		publicKey,
		tags: {
			...tags,
			Name: keyName
		}
	})

	// EC2. Doc: https://www.pulumi.com/docs/reference/pkg/aws/ec2/instance/
	const server = new aws.ec2.Instance(name, {
		ami,
		instanceType,
		availabilityZone,
		subnetId,
		vpcSecurityGroupIds,
		iamInstanceProfile,
		userData,
		userDataBase64,
		keyName: keyPair ? keyPair.id : undefined,
		tags: {
			...tags,
			Name: name
		},
		dependsOn: [
			ssmAttachedPolicy
		]
	})

	this.id = server.id
	this.arn = server.arn
	this.instanceState = server.instanceState
	this.instanceType = instanceType
	this.availabilityZone = availabilityZone||null
	this.ami = ami
	this.subnetId = subnetId||null
	this.vpcSecurityGroupIds = vpcSecurityGroupIds||null
	this.privateIp = server.privateIp
	this.keyPair = !keyPair ? null : {
		id: keyPair.id,
		arn: keyPair.arn,
		name: keyPair.name,
		keyPairId: keyPair.keyPairId
	}

	return this
}

module.exports = {
	EC2
}



