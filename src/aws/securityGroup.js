/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

// Version: 0.0.4

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const crypto = require('crypto')
const { unwrap } = require('../utils')

/**
 * Creates a security group and attach(1) ingress and egress rules to it.
 *
 * WARNING: DO NOT UPDATE THE 'description' FIELD. This will trigger a replace of the security group, even if the name is the same.
 * 
 * Resources:
 *     1. Security group
 *     2. Multiple security group rules (as many as the total of the ingress and egress rules).
 *
 * (1) As of August 2021, the aws.ec2.SecurityGroup API is limited to max 2 rules. That's why we use the 'aws.ec2.SecurityGroupRule' API 
 * instead. More details about this limitation at https://www.pulumi.com/docs/reference/pkg/aws/ec2/securitygroup/
 * 
 * @param  {String}								name                
 * @param  {String}								description                
 * @param  {String}								vpcId                
 * @param  {Output<String>}						ingress[].protocol            e.g., 'tcp', '-1' (all protocols)
 * @param  {Output<Number>}						ingress[].fromPort            e.g., 3306
 * @param  {Output<Number>}						ingress[].toPort            e.g., 3306
 * @param  {Output<String>}						ingress[].description
 * @param  {[Output<String>]}					ingress[].cidrBlocks        e.g., ['0.0.0.0/0']
 * @param  {[Output<String>]}					ingress[].ipv6CidrBlocks    e.g., ['::/0']
 * @param  {[Output<String>]}					ingress[].securityGroups    e.g., ['sg-1234522', 'sg-76322']
 * @param  {Output<Boolean>}					ingress[].self        
 * @param  {Output<String>}						egress[].protocol            e.g., 'tcp', '-1' (all protocols)
 * @param  {Output<Number>}						egress[].fromPort            e.g., 3306
 * @param  {Output<Number>}						egress[].toPort                e.g., 3306
 * @param  {Output<String>}						egress[].description
 * @param  {[Output<String>]}					egress[].cidrBlocks            e.g., ['0.0.0.0/0']
 * @param  {[Output<String>]}					egress[].ipv6CidrBlocks        e.g., ['::/0']
 * @param  {[Output<String>]}					egress[].securityGroups        e.g., ['sg-1234522', 'sg-76322']
 * @param  {Output<Boolean>}					egress[].self            
 * @param  {Object}								tags        
 *         
 * @return {Output<SecurityGroup>}				securityGroup
 * @return {Output<[SecurityGroupRule]>}		securityGroupRules
 */
const SecurityGroup = function ({ name, description, vpcId, ingress, egress, tags }) {
	if (!name)
		throw new Error('Missing required \'name\' argument.')

	tags = tags || {}
	
	// Security group doc: https://www.pulumi.com/docs/reference/pkg/aws/ec2/securitygroup/
	const securityGroup = new aws.ec2.SecurityGroup(name, {
		name,
		description,
		vpcId,
		tags: {
			...tags,
			Name: name
		}
	})

	this.securityGroup = leanifySecurityGroup(securityGroup)
	this.securityGroupRules = unwrap(securityGroup, x => ({ id:x.id })).apply(sg => {
		return pulumi
			.all([
				resolveRules(ingress, 'ingress', sg.id),
				resolveRules(egress, 'egress', sg.id)
			])
			.apply(([ingressRules, egressRules]) => {
				return [...ingressRules, ...egressRules].map(rule => {
					const { hash, ...raw } = rule
					const ruleName = `${name}-sgr-${hash}`
					// Security group rule doc: https://www.pulumi.com/docs/reference/pkg/aws/ec2/securitygrouprule/
					return new aws.ec2.SecurityGroupRule(ruleName, {
						...raw,
						tags: {
							...tags,
							Name: ruleName
						}
					})
				})
			})
	})

	return this
}

const hashRule = rule => crypto.createHash('md5').update(JSON.stringify(rule)).digest('hex').slice(0,8)

const leanifySecurityGroup = sg => {
	const { id, arn, name, description } = sg || {}
	return { id, arn, name, description }
}

/**
 * Map inline security group rules to explicit SecurityGroupRule objects
 * 
 * @param  {Output<String>}            rules[].protocol                                e.g., 'tcp', '-1' (all protocols)
 * @param  {Output<Number>}            rules[].fromPort                                e.g., 3306
 * @param  {Output<Number>}            rules[].toPort                                    e.g., 3306
 * @param  {Output<String>}            rules[].description
 * @param  {[Output<String>]}        rules[].cidrBlocks                                e.g., ['0.0.0.0/0']
 * @param  {[Output<String>]}        rules[].ipv6CidrBlocks                            e.g., ['::/0']
 * @param  {[Output<String>]}        rules[].securityGroups                            e.g., ['sg-1234522', 'sg-76322']
 * @param  {Output<Boolean>}        rules[].self
 * @param  {String}                    type                                            Valid values: 'ingress', 'egress'
 * @param  {String}                    securityGroupId                                    e.g., 'sg-6fw4w'
 * 
 * @return {String}                    securityGroupRules[].securityGroupId
 * @return {String}                    securityGroupRules[].type
 * @return {String}                    securityGroupRules[].protocol
 * @return {String}                    securityGroupRules[].fromPort
 * @return {String}                    securityGroupRules[].toPort    
 * @return {[String]}                securityGroupRules[].cidrBlocks        
 * @return {[String]}                securityGroupRules[].ipv6CidrBlocks   
 * @return {String}                    securityGroupRules[].sourceSecurityGroupId   
 * @return {String}                    securityGroupRules[].description
 * @return {String}                    securityGroupRules[].hash                        First 8 characters of the MD5 hash of the securityGroupRule object (excl. description).
 */
const resolveRules = (rules, type, securityGroupId) => {
	if (!rules || !rules.length)
		return []

	return unwrap(rules, rule => ({
		protocol:rule.protocol,
		fromPort:rule.fromPort,
		toPort:rule.toPort,
		description:rule.description,
		cidrBlocks:rule.cidrBlocks,
		ipv6CidrBlocks:rule.ipv6CidrBlocks,
		securityGroups:rule.securityGroups,
		self:rule.self
	})).apply(_rules => {
		const securityGroupRules = []
		for (let i=0;i<_rules.length;i++) {
			const {protocol, fromPort, toPort, description, cidrBlocks, ipv6CidrBlocks, securityGroups, self} = _rules[i]

			const sgs = securityGroups && securityGroups.length ? securityGroups : self ? [securityGroupId] : [null]
			for (let j=0;j<sgs.length;j++) {
				const sourceSecurityGroupId = sgs[j]
				const securityGroupRule = {
					securityGroupId,
					type,
					protocol,
					fromPort,
					toPort
				}
				if (sourceSecurityGroupId)
					securityGroupRule.sourceSecurityGroupId = sourceSecurityGroupId
				else {
					securityGroupRule.cidrBlocks = cidrBlocks
					securityGroupRule.ipv6CidrBlocks = ipv6CidrBlocks
				}

				securityGroupRule.hash = hashRule(securityGroupRule)
				if (description)
					securityGroupRule.description = description
				securityGroupRules.push(securityGroupRule)
			}
		}
		return securityGroupRules
	})
}

module.exports = {
	SecurityGroup
}


