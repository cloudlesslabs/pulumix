const aws = require('@pulumi/aws')

/**
 * Creates an EFS file system and an access point. 
 * Resources:
 * 	1. EFS file system
 * 	2. Multiple Mount targets (one for each subnetIds)
 * 	3. (Optional) Access point if 'accessPointDir' is defined.
 * 
 * @param  {String}   project        
 * @param  {[String]} subnetIds      
 * @param  {String}   accessPointDir		
 * @param  {[String]} securityGroups
 * @param  {Object}   tags
 * 
 * @return {String}   efs.fileSystem.id
 * @return {String}   efs.fileSystem.arn
 * @return {String}   efs.fileSystem.dnsName
 * @return {String}   efs.accessPoint.id
 * @return {String}   efs.accessPoint.arn
 * @return {String}   efs.accessPoint.fileSystemId		
 * @return {Number}   efs.accessPoint.posixUser.gid								e.g., 1000
 * @return {Number}   efs.accessPoint.posixUser.uid								e.g., 1000
 * @return {Number}   efs.accessPoint.rootDirectory.creationInfo.ownerGid		e.g., 1000
 * @return {Number}   efs.accessPoint.rootDirectory.creationInfo.ownerUid		e.g., 1000
 * @return {String}   efs.accessPoint.rootDirectory.creationInfo.permissions	e.g., '755'		
 * @return {String}   efs.accessPoint.rootDirectory.path						Access point's directory in EFS.		
 */
const createEFS = ({ name, subnetIds, securityGroups, accessPointDir, protect, tags }) => {
	if (!name)
		throw new Error('Missing required argument \'name\'.')
	if (!subnetIds)
		throw new Error('Missing required argument \'subnetIds\'.')
	if (!subnetIds.length)
		throw new Error('Wrong argument exception. \'subnetIds\' cannot be empty.')

	tags = tags || {}
	// EFS
	const fileSystem = new aws.efs.FileSystem(name, {
		tags: {
			Name: name // That's also going to be used to add afriendly name to the resource.
		}
	}, { protect })
	
	const targets = []
	for (let i = 0; i < subnetIds.length; i++) {
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
		accessPoint
	}
}

module.exports = createEFS
