// Version: 0.0.3

const awsx = require('@pulumi/awsx')
const { resolve } = require('./utils')

/**
 * Creates a new VPC. Doc: https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/awsx/ec2/
 * Resources:
 *    1. VPC
 *    2. (Optional) Public subnets is 'subnets' contains { type: 'public' }
 *    3. (Optional) Private subnets is 'subnets' contains { type: 'private' }
 *    4. (Optional) Isolated subnets is 'subnets' contains { type: 'isolated' }
 *    4. (Optional) NAT gateways if 'subnets' contains both { type: 'public' } and { type: 'private' }
 * 
 * @param  {String}                name                        
 * @param  {String}                cidrBlock                    Optional. Default is '10.0.0.0/16'.
 * @param  {Number}                numberOfAvailabilityZones    Optional. Default is 2.                
 * @param  {[Object]}              subnets                        Optional. WARNING(1): Default is [{ type: 'public' }, { type: 'private' }]
 * @param  {Number}                numberOfNatGateways            Optional (2).    
 * @param  {Boolean}               protect                        
 * @param  {Object}                tags        
 *                 
 * @return {Output<String>}        id
 * @return {Output<String>}        arn
 * @return {Output<String>}        cidrBlock
 * @return {Output<String>}        ipv6CidrBlock
 * @return {Output<String>}        defaultNetworkAclId
 * @return {Output<String>}        defaultRouteTableId
 * @return {Output<String>}        defaultSecurityGroupId
 * @return {Output<String>}        dhcpOptionsId
 * @return {Output<String>}        mainRouteTableId
 * @return {Output<[String]>}      publicSubnetIds
 * @return {Output<[String]>}      privateSubnetIds
 * @return {Output<[String]>}      isolatedSubnetIds
 * @return {Output<[String]>}      natGatewayIds
 * @return {Promise<[String]>}     availabilityZones            WARNING: This is a promise, not an output.
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
const createVPC = async ({ name, cidrBlock, subnets, numberOfAvailabilityZones, numberOfNatGateways, protect, tags }) => {
	tags = tags || {}

	// VPC doc: https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/awsx/ec2/
	const vpc = new awsx.ec2.Vpc(name, { 
		cidrBlock,
		subnets,
		numberOfAvailabilityZones: numberOfAvailabilityZones ? numberOfAvailabilityZones*1 : undefined,
		numberOfNatGateways: numberOfNatGateways ? numberOfNatGateways*1 : undefined,
		tags: {
			...tags,
			Name: name
		}
	}, { protect })

	const subnetsDetails = await getSubnets(vpc)
	const availabilityZones = await getAvailabilityZones(subnetsDetails)
	const natGateways = await getNatGateways(vpc.natGateways, subnetsDetails)

	return {
		id: vpc.id,
		arn: vpc.vpc.arn,
		cidrBlock: vpc.vpc.cidrBlock,
		ipv6CidrBlock: vpc.vpc.ipv6CidrBlock,
		defaultNetworkAclId: vpc.vpc.defaultNetworkAclId,
		defaultRouteTableId: vpc.vpc.defaultRouteTableId,
		defaultSecurityGroupId: vpc.vpc.defaultSecurityGroupId,
		dhcpOptionsId: vpc.vpc.dhcpOptionsId,
		mainRouteTableId: vpc.vpc.mainRouteTableId,
		publicSubnetIds: vpc.publicSubnetIds,
		privateSubnetIds: vpc.privateSubnetIds,
		isolatedSubnetIds: vpc.isolatedSubnetIds,
		natGateways,
		availabilityZones
	}
}

/**
 * Resolves the NAT gateways details. 
 * 
 * @param  {[Output<NAT>]}    unresolvedNatGateways        
 * @param  {[Output<NAT>]}    
 * @param  {String}            subnets[].id                            e.g., 'subnet-1234566'
 * @param  {String}            subnets[].name                            e.g., 'my-app-dev-public-1'
 * @param  {String}            subnets[].availabilityZone                e.g., 'ap-southeast-2c'
 * 
 * @return {String}            natGateways[].id                        e.g., 'nat-1234567'
 * @return {String}            natGateways[].name                        e.g., 'my-app-dev-0'
 * @return {String}            natGateways[].privateIp                    e.g., '10.0.26.107'
 * @return {String}            natGateways[].publicIp                    e.g., '13.147.192.140'
 * @return {String}            natGateways[].subnet.id                    e.g., 'subnet-1234566'
 * @return {String}            natGateways[].subnet.name                e.g., 'my-app-dev-public-0'
 * @return {String}            natGateways[].subnet.availabilityZone    e.g., 'ap-southeast-2a'
 */
const getNatGateways = async (unresolvedNatGateways, subnets) => {
	if (!unresolvedNatGateways)
		return null

	const natGateways = await resolve(unresolvedNatGateways)
	if (!natGateways || !natGateways.length)
		return null

	subnets = subnets || []

	const resolvedNatGateways = []
	for (let i=0;i<natGateways.length;i++) {
		const natGateway = natGateways[i]//await resolve()
		const [natGatewayId, subnetId, privateIp, publicIp] = await resolve([
			natGateway.natGateway.id,
			natGateway.natGateway.subnetId,
			natGateway.natGateway.privateIp,
			natGateway.natGateway.publicIp
		])

		const subnet = subnets.find(s => s.id == subnetId)

		resolvedNatGateways.push({
			id: natGatewayId,
			name: natGateway.natGatewayName,
			privateIp,
			publicIp,
			subnet
		})
	}

	return resolvedNatGateways
}

/**
 * Aggregates all subnets in a single array. 
 * 
 * @param  {[Output<Subnet>]}    vpc.publicSubnets
 * @param  {[Output<Subnet>]}    vpc.privateSubnets
 * @param  {[Output<Subnet>]}    vpc.isolatedSubnets
 * 
 * @return {String}                subnets[].id                e.g., 'subnet-0fb5a6a53c701836a'
 * @return {String}                subnets[].name                e.g., 'lineup-network-dev-public-1'
 * @return {String}                subnets[].availabilityZone    e.g., 'ap-southeast-2c'
 */
const getSubnets = async vpc => {
	const [subnetsA, subnetsB, subnetsC] = await resolve([vpc.publicSubnets, vpc.privateSubnets, vpc.isolatedSubnets])
	const subnets = [...(subnetsA||[]), ...(subnetsB||[]), ...(subnetsC||[])]
	const resolvedSubnets = []
	for (let i=0;i<subnets.length;i++) {
		const { subnetName, subnet } = subnets[i] || {}
		const [id, availabilityZone] = await resolve([subnet.id, subnet.availabilityZone])
		resolvedSubnets.push({ id, name:subnetName, availabilityZone })
	}
	return resolvedSubnets
}

/**
 * Gets a VPC's AZs.
 * 
 * @param  {[Subnet]}            subnets
 * 
 * @return {Promise<[String]>}    availabilityZones
 */
const getAvailabilityZones = async subnets => {
	const azs = []
	for (let i=0;i<subnets.length;i++) {
		const subnet = subnets[i]||{}
		if (subnet && subnet.availabilityZone) {
			const az = await resolve(subnet.availabilityZone)
			if (azs.indexOf(az) < 0)
				azs.push(az)
		}
	}

	return azs
}

module.exports = createVPC



