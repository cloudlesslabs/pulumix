/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

// Version: 0.0.5

const pulumi = require('@pulumi/pulumi')
const awsx = require('@pulumi/awsx')
const { unwrap } = require('../utils')

/**
 * Creates a new VPC. Doc: https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/awsx/ec2/
 * Resources:
 *    1. VPC
 *    2. (Optional) Public subnets is 'subnets' contains { type: 'public' }
 *    3. (Optional) Private subnets is 'subnets' contains { type: 'private' }
 *    4. (Optional) Isolated subnets is 'subnets' contains { type: 'isolated' }
 *    4. (Optional) NAT gateways if 'subnets' contains both { type: 'public' } and { type: 'private' }
 * 
 * @param  {String}					name                        
 * @param  {String}					cidrBlock							Optional. Default is '10.0.0.0/16'.
 * @param  {Number}					numberOfAvailabilityZones			Optional. Default is 2.                
 * @param  {[Object]}				subnets								Optional. WARNING(1): Default is [{ type: 'public' }, { type: 'private' }]
 * @param  {Number}					numberOfNatGateways					Optional (2).    
 * @param  {Boolean}				protect                        
 * @param  {Object}					tags        
 *                 
 * @return {Object}					vpc
 * @return {Output<String>}				.id
 * @return {Output<String>}				.arn
 * @return {Output<String>}				.cidrBlock
 * @return {Output<String>}				.ipv6CidrBlock
 * @return {Output<String>}				.defaultNetworkAclId
 * @return {Output<String>}				.defaultRouteTableId
 * @return {Output<String>}				.defaultSecurityGroupId
 * @return {Output<String>}				.dhcpOptionsId
 * @return {Output<String>}				.mainRouteTableId
 * @return {Output<[Object]>}			.publicSubnets[]
 * @return {Output<String>}					.id
 * @return {Output<String>}					.name
 * @return {Output<String>}					.availabilityZone
 * @return {Output<String>}					.type
 * @return {Output<[Object]>}			.privateSubnets[]
 * @return {Output<String>}					.id
 * @return {Output<String>}					.name
 * @return {Output<String>}					.availabilityZone
 * @return {Output<String>}					.type
 * @return {Output<[Object]>}			.isolatedSubnets[]
 * @return {Output<String>}					.id
 * @return {Output<String>}					.name
 * @return {Output<String>}					.availabilityZone
 * @return {Output<String>}					.type
 * @return {Output<[String]>}			.availabilityZones				
 * @return {Output<[Object]>}			.natGateways[]
 * @return {Output<String>}					.id							e.g., 'nat-1234567'
 * @return {Output<String>}					.name						e.g., 'my-app-dev-0'
 * @return {Output<String>}					.privateIp					e.g., '10.0.26.107'
 * @return {Output<String>}					.publicIp					e.g., '13.147.192.140'
 * @return {Output<Object>}					.subnet
 * @return {Output<String>}						.id						e.g., 'subnet-1234566'
 * @return {Output<String>}						.name					e.g., 'my-app-dev-public-0'
 * @return {Output<String>}						.availabilityZone		e.g., 'ap-southeast-2a'
 *
 * (1) The reason the default subnets is a warning is because it provisions a "Pulumi private subnet" in each AZ. Standard 
 * private subnets are just subnets with no internet gateway, meaning the public internet cannot initiate a connection to them. 
 * A "Pulumi private subnet" is a private subnet that was also provisioned with a NAT gateway in each public subnet so that 
 * they could reach the public internet but not the inverse (the number of NATs can be configured via the 'numberOfNatGateways' 
 * property). The issue with that Pulumi specific concept is that NATs are not free. If you simply wanted a true native private 
 * subnet, then you must use what Pulumi refers as to a "isolated" subnet. Example:
 *
 * subnets: [{ type: "public" }, { type: "isolated", name: "db" }]
 *
 * (2) 'numberOfNatGateways' is only configurable if there is at least one public subnet. In that case, the default value is 
 * equal to 'numberOfAvailabilityZones'.  
 */
const VPC = function ({ name, cidrBlock, subnets, numberOfAvailabilityZones, numberOfNatGateways, protect, tags }) {
	tags = tags || {}

	// VPC doc: https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/awsx/ec2/
	const vpc = new awsx.ec2.Vpc(name, { 
		cidrBlock,
		subnets,
		numberOfAvailabilityZones: numberOfAvailabilityZones ? numberOfAvailabilityZones*1 : 0,
		numberOfNatGateways: numberOfNatGateways ? numberOfNatGateways*1 : 0,
		tags: {
			...tags,
			Name: name
		}
	}, { protect })

	const getSubnet = type => x => ({ 
		id: x.subnet.id, 
		name: x.subnetName, 
		availabilityZone: x.subnet.availabilityZone,
		type
	})

	const subnetsAndAZs = pulumi.all([
		unwrap(vpc.publicSubnets, getSubnet('public')),
		unwrap(vpc.privateSubnets, getSubnet('private')),
		unwrap(vpc.isolatedSubnets, getSubnet('isolated'))
	]).apply(([publicSubnets, privateSubnets, isolatedSubnets]) => {
		const _subnets = [
			...(publicSubnets||[]),
			...(privateSubnets||[]),
			...(isolatedSubnets||[])
		]
		const availabilityZones = Array.from(new Set(_subnets.map(s => s.availabilityZone).filter(x => x)))

		return {
			subnets: _subnets,
			publicSubnets,
			privateSubnets,
			isolatedSubnets,
			availabilityZones
		}
	})

	this.id = vpc.id
	this.arn = vpc.vpc.arn
	this.cidrBlock = vpc.vpc.cidrBlock
	this.ipv6CidrBlock = vpc.vpc.ipv6CidrBlock
	this.defaultNetworkAclId = vpc.vpc.defaultNetworkAclId
	this.defaultRouteTableId = vpc.vpc.defaultRouteTableId
	this.defaultSecurityGroupId = vpc.vpc.defaultSecurityGroupId
	this.dhcpOptionsId = vpc.vpc.dhcpOptionsId
	this.mainRouteTableId = vpc.vpc.mainRouteTableId
	this.publicSubnets = subnetsAndAZs.publicSubnets
	this.privateSubnets = subnetsAndAZs.privateSubnets
	this.isolatedSubnets = subnetsAndAZs.isolatedSubnets
	this.availabilityZones = subnetsAndAZs.availabilityZones
	this.natGateways = getNatGateways(vpc.natGateways, subnetsAndAZs.subnets)

	return this
}

/**
 * Resolves the NAT gateways details. 
 * 
 * @param  {Output<[NAT]>}		outputNatGateways		
 * @param  {Output<[Subnet]>}	outputSubnets[]
 * @param  {String}					.id							e.g., 'subnet-0fb5a6a53c701836a'
 * @param  {String}					.name						e.g., 'lineup-network-dev-public-1'
 * @param  {String}					.availabilityZone			e.g., 'ap-southeast-2c'
 * 
 * @return {Output<[Object]>}	natGateways[]					
 * @return {String}					.id							e.g., 'nat-1234567'
 * @return {String}					.name						e.g., 'my-app-dev-0'
 * @return {String}					.privateIp					e.g., '10.0.26.107'
 * @return {String}					.publicIp					e.g., '13.147.192.140'
 * @return {String}					.subnet.id					e.g., 'subnet-1234566'
 * @return {String}					.subnet.name				e.g., 'my-app-dev-public-0'
 * @return {String}					.subnet.availabilityZone	e.g., 'ap-southeast-2a'
 */
const getNatGateways = (outputNatGateways, outputSubnets) =>
	pulumi.all([
		unwrap(outputNatGateways, x => ({
			id: x.natGateway.id,
			name: x.natGatewayName,
			subnetId: x.natGateway.subnetId,
			privateIp: x.natGateway.privateIp,
			publicIp: x.natGateway.publicIp
		})), 
		unwrap(outputSubnets)
	]).apply(([natGateways, subnets]) => {
		if (!natGateways || !natGateways.length)
			return null

		return natGateways.map(n => {
			n.subnet = subnets.find(s => s.id == n.subnetId)
			return n
		})
	})

module.exports = {
	VPC
}



