/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

// Version: 0.0.2

const aws = require('@pulumi/aws')
const docker = require('@pulumi/docker')
const { resolve } = require('../utils')


/**
 * Creates a new ECR repository and uploads a Docker image to it.
 * 
 * @param  {String}			name									Image name
 * @param  {String}			tag										Image tag
 * @param  {Object}			publicConfig							If set, the repo is public.
 * @param  {String}			publicConfig.aboutText
 * @param  {String}			publicConfig.description
 * @param  {String}			publicConfig.usageText
 * @param  {[String]/		publicConfig.architectures				e.g., ['ARM', 'ARM 64', 'x86', 'x86-64']
 * @param  {String}			publicConfig.logoImageBlob				base64-encoded repository logo payload. (Only visible for verified accounts).
 * @param  {[String]}		publicConfig.operatingSystems			['Linux', 'Windows']
 * @param  {String}			dir										Absolute path to the image project.
 * @param  {Object}			args									(1) Arguments passed to the '--build-arg' option in the 'docker build' command.
 * @param  {[String]}		extraOptions							(2) Arguments passed to the 'docker build' command.
 * @param  {Boolean}		scanOnPush								Default false. True means that the image is periodically scanned for issues (NOT FREE).
 * @param  {Boolean}		imageTagMutable							Default true.
 * @param  {String}			tag										Image tag
 * @param  {String}			lifecyclePolicies[].description					
 * @param  {[String]}		lifecyclePolicies[].tagPrefixList		e.g., ['prod', 'dev', 'v']
 * @param  {String}			lifecyclePolicies[].countType			(3) 'sinceImagePushed' or 'imageCountMoreThan' (default)
 * @param  {String}			lifecyclePolicies[].countNumber			Unit is 'days' if 'countType' is 'sinceImagePushed', otherwise it is 'number of images'.
 * @param  {String}			tags
 * 
 * @return {[String]} 		imageValues								(4) Image values including its tag. Can be used in a Dockerfile with the FROM directive.
 * @return {Output<Repo>}	repository								Usual properties (e.g., id, arn, urn, ...)
 * @return {Output<String>}	repository.name							AWS repo name
 * @return {Output<String>}	repository.registryId					e.g., '1234' (same as AWS account ID)
 * @return {Output<String>}	repository.repositoryUrl				e.g., '1234.dkr.ecr.ap-southeast-2.amazonaws.com/your-repo-name'
 * @return {Output<Policy>}	lifecyclePolicy							
 *
 *
 * (1) { DB_USER:'1234', DB_PASSWORD:'4567' } -> docker build --build-arg DB_USER="1234" --build-arg DB_PASSWORD="4567"
 * (2) ['--build-arg', 'DB_USER="1234"`,'--build-arg', 'DB_PASSWORD="4567"'] -> docker build --build-arg DB_USER="1234" --build-arg DB_PASSWORD="4567" 
 * (3) countType:
 * 		- 'imageCountMoreThan': Images are sorted from youngest to oldest based on pushed_at_time and then all images greater than the specified count are expired.
 * 		- 'sinceImagePushed': All images whose pushed_at_time is older than the specified number of days based on countNumber are expired.
 * (4) The image values is the 'repositoryUrl' prefixed with the image's tag. For example:
 * 		- ${repositoryUrl}:v1
 *   	- ${repositoryUrl}:1234556 where '1234556' is the SHA of the image.
 *
 */
const createImage = async ({ name, tag, publicConfig, dir, args, scanOnPush, imageTagMutable, extraOptions, lifecyclePolicies, tags }) => {
	if (!name)
		throw new Error('Missing required argument \'name\'.')

	const cleanTag = tag ? tag.toLowerCase().replace(/\s/g,'').trim() : null
	const taggedName = cleanTag ? `${name}:${cleanTag}` : name
	const lifecyclePolicyName = `${name}-lc-policy`

	// ECR doc: https://www.pulumi.com/docs/reference/pkg/aws/ecr/repository/
	const repository = createRepo({ 
		name, 
		scanOnPush: scanOnPush ? true : false, 
		imageTagMutable, 
		publicConfig, 
		tags: {
			...(tags||{}),
			Name: name
		}
	})

	// ECR lifecycle policy doc: https://www.pulumi.com/docs/reference/pkg/aws/ecr/lifecyclepolicy/
	const lifecyclePolicy = !lifecyclePolicies || !lifecyclePolicies.length ? null : new aws.ecr.LifecyclePolicy(lifecyclePolicyName, {
		repository: repository.name,
		policy: JSON.stringify({
			rules: lifecyclePolicies.map((p,idx) => {
				if (p.countType != 'sinceImagePushed')
					p.countType = 'imageCountMoreThan'
				const policy = {
					rulePriority: idx+1,
					description: p.description,
					selection: {
						countType: p.countType, // e.g., 'sinceImagePushed' or 'imageCountMoreThan'
						countNumber: p.countNumber
					},
					action: {
						type: 'expire'
					}
				}

				if (p.countType == 'sinceImagePushed')
					policy.selection.countUnit = 'days'
				if (p.tagPrefixList && p.tagPrefixList.length) {
					policy.selection.tagStatus = 'tagged'
					policy.selection.tagPrefixList = p.tagPrefixList
				} else
					policy.selection.tagStatus = 'untagged'

				return policy
			})
		},null,'  '),
		tags: {
			...(tags||{}),
			Repository: name,
			Name: lifecyclePolicyName
		}
	})

	const [registryId, repositoryUrl] = await resolve([repository.registryId, repository.repositoryUrl])

	const dockerBuildConfig = {
		context: dir,
		args, 
		extraOptions
	}

	// Pushes image to repo.
	const imageValue = await resolve(docker.buildAndPushImage(taggedName, dockerBuildConfig, repositoryUrl, null, async () => {
		// Construct Docker registry auth data by getting the short-lived authorizationToken from ECR, and
		// extracting the username/password pair after base64-decoding the token.
		//
		// See: http://docs.aws.amazon.com/cli/latest/reference/ecr/get-authorization-token.html
		const credentials = await aws.ecr.getCredentials({ registryId }, { async: true })
		const decodedCredentials = Buffer.from(credentials.authorizationToken, 'base64').toString()
		const [username, password] = decodedCredentials.split(':')
		if (!password || !username)
			throw new Error('Invalid credentials')
		
		return {
			registry: credentials.proxyEndpoint,
			username: username,
			password: password
		}
	}))

	const imageValues = cleanTag ? [`${repositoryUrl}:${cleanTag}`] : []
	if (imageValues[0] != imageValue)
		imageValues.push(imageValue)

	return {
		repository,
		imageValues,
		lifecyclePolicy
	}
}

/**
 * Creates a private or public repo. 
 * 
 * @param  {String}				name
 * @param  {Boolean}			scanOnPush
 * @param  {Boolean}			imageTagMutable
 * @param  {Object}				publicConfig						If set, the repo is public.
 * @param  {String}				publicConfig.aboutText
 * @param  {String}				publicConfig.description
 * @param  {String}				publicConfig.usageText
 * @param  {[String]/			publicConfig.architectures		e.g., ['ARM', 'ARM 64', 'x86', 'x86-64']
 * @param  {String}				publicConfig.logoImageBlob		base64-encoded repository logo payload. (Only visible for verified accounts).
 * @param  {[String]}			publicConfig.operatingSystems	['Linux', 'Windows']
 * @param  {Object}				tags
 * 
 * @return {Output<String>}		repository.id
 * @return {Output<String>}		repository.name
 * @return {Output<String>}		repository.arn
 * @return {Output<String>}		repository.registryId
 * @return {Output<String>}		repository.repositoryUrl	
 * @return {Output<Object>}		repository.catalogData			Only for public repo.
 * @return {Output<Boolean>}	repository.forceDestroy			Only for public repo.
 */
const createRepo = ({ name, scanOnPush, imageTagMutable, publicConfig, tags }) => {
	if (!publicConfig)
		// ECR doc: https://www.pulumi.com/docs/reference/pkg/aws/ecr/repository/
		return new aws.ecr.Repository(name, {
			name,
			imageScanningConfiguration: {
				scanOnPush: scanOnPush ? true : false,
			},
			imageTagMutability: imageTagMutable === false ? 'IMMUTABLE' : 'MUTABLE',
			tags: {
				...(tags||{}),
				Name: name
			}
		})
	else {
		// ECR public doc: https://www.pulumi.com/docs/reference/pkg/aws/ecrpublic/repository/
		const r = new aws.ecrpublic.Repository(name, {
			repositoryName: name,
			catalogData: publicConfig,
			tags: {
				...(tags||{}),
				Name: name
			}
		})

		return {
			id: r.id,
			name: r.repositoryName,
			arn: r.arn,
			registryId: r.registryId,
			repositoryUrl: r.repositoryUri,
			catalogData: r.catalogData,
			forceDestroy: r.forceDestroy
		}
	}
}

module.exports = {
	image: createImage
}









