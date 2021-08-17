// Version: 0.0.6

const aws = require('@pulumi/aws')
const { resolve } = require('./utils')
const securityGroup = require('./securityGroup')

/**
 * Creates an EFS file system and an access point. 
 * Resources:
 * 	1. EFS file system
 * 	2. Multiple Mount targets (one for each subnetIds)
 * 	3. (Optional) Access point if 'accessPointDir' is defined.
 * 
 * @param  {String}   		  project        
 * @param  {Output<String>}   vpcId        
 * @param  {[String]}         subnetIds      
 * @param  {String}           accessPointDir		
 * @param  {String}           ingress[].protocol										e.g., 'tcp'
 * @param  {Number}           ingress[].fromPort										e.g., 3306
 * @param  {Number}           ingress[].toPort											e.g., 3306
 * @param  {[String]}         ingress[].cidrBlocks										e.g., ['0.0.0.0/0']
 * @param  {[String]}         ingress[].ipv6CidrBlocks									e.g., ['::/0']
 * @param  {[String]}         ingress[].securityGroups									e.g., ['sg-123455', 'sg-7654211']
 * @param  {[String]}         securityGroups
 * @param  {String}           performanceMode											Valid values: 'generalPurpose' (default), 'maxIO'
 * @param  {Boolean}          encrypted													Default false
 * @param  {Object}           tags
 * 
 * @return {String}           efs.fileSystem.id
 * @return {String}           efs.fileSystem.arn
 * @return {String}           efs.fileSystem.dnsName
 * @return {String}           efs.accessPoint.id
 * @return {String}           efs.accessPoint.arn
 * @return {String}           efs.accessPoint.fileSystemId		
 * @return {Number}           efs.accessPoint.posixUser.gid								e.g., 1000
 * @return {Number}           efs.accessPoint.posixUser.uid								e.g., 1000
 * @return {Number}           efs.accessPoint.rootDirectory.creationInfo.ownerGid		e.g., 1000
 * @return {Number}           efs.accessPoint.rootDirectory.creationInfo.ownerUid		e.g., 1000
 * @return {String}           efs.accessPoint.rootDirectory.creationInfo.permissions	e.g., '755'		
 * @return {String}           efs.accessPoint.rootDirectory.path						Access point's directory in EFS.	
 * @return {[Output<Target>]} efs.targets												Mount targets (one per subnet)
 * @return {[Output<SG>]}     efs.securityGroup											EFS security group contaning the 'ingress' rules.
 */
const createEFS = async ({ name, vpcId, subnetIds:_subnetIds, securityGroups, accessPointDir, ingress, performanceMode, encrypted, protect, tags }) => {
	if (!name)
		throw new Error('Missing required argument \'name\'.')
	if (!_subnetIds)
		throw new Error('Missing required argument \'subnetIds\'.')
	if (!vpcId)
		throw new Error('Missing required argument \'vpcId\'.')
	
	const subnetIds = await resolve(_subnetIds)
	if (!subnetIds.length)
		throw new Error('Wrong argument exception. \'subnetIds\' cannot be empty.')

	tags = tags || {}
	ingress = ingress || []
	securityGroups = securityGroups || []
	
	// EFS doc: https://www.pulumi.com/docs/reference/pkg/aws/efs/filesystem/
	const fileSystem = new aws.efs.FileSystem(name, {
		performanceMode,
		encrypted,
		tags: {
			...tags,
			Name: name // That's also going to be used to add afriendly name to the resource.
		}
	}, { protect })
	
	// Security group
	const efsSecurityGroup = await securityGroup({
		name: `${name}-efs-sg`, 
		description: `Controls the EFS filesystem ${name} access.`, 
		vpcId, 
		ingress, 
		egress:[{ 
			protocol: '-1', 
			fromPort: 0,
			toPort: 65535,
			cidrBlocks: ['0.0.0.0/0'], 
			ipv6CidrBlocks: ['::/0'], 
			description:'Allows EFS to respond.' 
		}], 
		tags
	})
	securityGroups.push(efsSecurityGroup.securityGroup.id)

	const targets = []
	for (let i=0;i<subnetIds.length;i++) {
		targets.push(new aws.efs.MountTarget(`fs-mount-${i}`, {
			fileSystemId: fileSystem.id,
			subnetId: subnetIds[i],
			securityGroups
		}))
	}
	const accessPoint = !accessPointDir ? null : new aws.efs.AccessPoint(name, {
		fileSystemId: fileSystem.id,
		posixUser: { uid: 1000, gid: 1000 },
		rootDirectory: { 
			path: accessPointDir, // The access points only work on sub-folder. Do not use '/'.
			creationInfo: { 
				ownerGid: 1000, 
				ownerUid: 1000, 
				permissions: '755' // 7 means the read+write+exec rights. 1st nbr is User, 2nd is Group and 3rd is Other.
			} 
		},
		tags: {
			...tags,
			Name: name // That's also going to be used to add afriendly name to the resource.
		}
	}, { 
		dependsOn: targets,
		protect
	})

	return {
		fileSystem,
		accessPoint,
		targets,
		securityGroup: efsSecurityGroup
	}
}

module.exports = createEFS
