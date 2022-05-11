/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

// Version: 0.0.1

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const { error: { mergeErrors } } = require('puffy')
const { resolve, unwrap } = require('../../utils')
const { getWebsiteProps, syncFiles, getDiffFiles } = require('./utils')
const { distribution: { invalidate:invalidateDistribution, exists:distributionExists } } = require('../cloudfront/utils')

/**
 * Upload files and optionally invalidate the CloudFront distro if it exists.
 * 
 * @param  {Output<Bucket>}				bucket				
 * @param  {Object} 					content
 * @param  {String}							.dir					Local path to the content that should be moved to the bucket.
 * @param  {String|[String]}				.ignore					(1) Ignore patterns for files under 'dir' 
 * @param  {[Object]}						.existingContent[]		Skip uploading files that match both the key AND the hash
 * @param  {String}								.key				Bucket object key
 * @param  {String}								.hash				Bucket object hash
 * @param  {Boolean>}						.remove					Default false. True means all files must be removed from the bucket.
 * @param  {Output<CloudFrontDistro>} 	cloudfrontDistro
 * @param  {Object}						cloudfront
 * @param  {[String]}						.customDomains			e.g., ['www.example.com', 'example.com']
 * @param  {[String]}						.allowedMethods			Default ['GET', 'HEAD', 'OPTIONS']
 * @param  {Boolean}						.invalidateOnUpdate		Default false. True means that if 'website.content' is set and content updates are detected, then the distribution must be invalidated
 * 
 * @return {[Object]}					files[]
 * @return {String}							.key					Object's key in S3
 * @return {String}							.hash					MD5 file hash   
 */
const _uploadFiles = async ({ bucket, content, cloudfrontDistro, cloudfront }) => {
	let files

	const [bucketName] = await resolve([bucket.bucket, bucket.urn])

	if (pulumi.runtime.isDryRun()) { // if this is preview
		if (!content.remove) {
			const [errors, filesData] = await getDiffFiles({ 
				dir: content.dir, 
				ignore: content.ignore,
				previousFiles: content.existingContent
			})
			if (errors)
				throw mergeErrors(errors)

			const { srcFiles } = filesData || {}
			files = (srcFiles||[]).map(file => ({ key:file.key, hash:file.hash }))
		}
	} else {
		const [errors, filesData] = await syncFiles({ 
			bucket: bucketName, 
			dir: content.dir, 
			ignore: content.ignore,
			existingObjects: content.existingContent,
			remove: content.remove,
			noWarning: true
		})
		if (errors)
			throw mergeErrors(errors)

		const { updated, srcFiles } = filesData || {}
		files = (srcFiles||[]).map(file => ({ key:file.key, hash:file.hash }))

		if (updated && cloudfrontDistro && cloudfront && cloudfront.invalidateOnUpdate) {
			const distroId = await resolve(cloudfrontDistro.id)
			if (distroId) {
				const [distroExistsErrors, distroExists] = await distributionExists({ id:distroId })
				if (distroExistsErrors)
					throw mergeErrors(errors)
				if (distroExists) {
					const [invalidationErrors] = await invalidateDistribution(({ id:distroId, operationId:`${Date.now()}`, paths:['/*'] }))
					if (invalidationErrors)
						throw mergeErrors(errors)
				}
			}
		}
	}

	return files || []
}

/**
 * Doc: https://www.pulumi.com/docs/reference/pkg/aws/s3/bucket/
 * 
 * Resources:
 * 	1. S3 bucket.
 * 	2. (Optional) CloudFront Distribution
 * 	3. (Optional) Uploads files to S3.
 * 	
 * @param  {Output<String>}				name				
 * @param  {Output<String>}				acl								Valid values: 'private' (default), 'public-read' (for website), 'public-read-write', 'aws-exec-read', 'authenticated-read', and 'log-delivery-write'	
 * @param  {Object}						website							If exists, overwrites 'acl' with 'public-read'
 * @param  {Output<String>}					.indexDocument				e.g., 'index.html'	
 * @param  {Output<String>}					.errorDocument				e.g., 'error.html'
 * @param  {Output<String>}					.redirectAllRequestsTo		e.g., 'https://neap.co'
 * @param  {Output<Object>}					.routingRules
 * @param  {Output<[Object]>}				.cors						https://www.pulumi.com/docs/reference/pkg/aws/s3/bucket/#using-cors	
 * @param  {Output<Object>}					.content
 * @param  {Output<String>}						.dir					Local path to the content that should be moved to the bucket.
 * @param  {Output<String|[String]>}			.ignore					(1) Ignore patterns for files under 'dir' 
 * @param  {Output<[Object]>}					.existingContent[]		Skip uploading files that match both the key AND the hash
 * @param  {Output<String>}							.key				Bucket object key
 * @param  {Output<String>}							.hash				Bucket object hash
 * @param  {Output<Boolean>}					.remove					Default false. True means all files must be removed from the bucket.
 * @param  {Output<Object>}					.cloudfront
 * @param  {Output<[String]>}					.customDomains			e.g., ['www.example.com', 'example.com']
 * @param  {Output<[String]>}					.allowedMethods			Default ['GET', 'HEAD', 'OPTIONS']
 * @param  {Output<Boolean>}					.invalidateOnUpdate		Default false. True means that if 'website.content' is set and content updates are detected, then the distribution must be invalidated
 * @param  {Output<Boolean>}			versioning						Default false.		
 * @param  {Output<String>}				tags				
 * 
 * @return {Object}						output
 * @return {Output<Bucket>}					.bucket
 * @return {Output<String>}						.websiteEndpoint			Unfriendly AWS URL where the S3 website can be accessed (only set when the 'website' property is set).
 * @return {Output<String>}						.bucketDomainName			e.g., 'bucketname.s3.amazonaws.com'
 * @return {Output<String>}						.bucketRegionalDomainName	e.g., 'http://bucketname.s3.ap-southeast-2.amazonaws.com'
 * @return {Output<String>}						.region						e.g., 'ap-southeast-2'
 * @return {Output<CloudFront>}				.cloudfront
 * @return {Output<String>}						.domainName					URL where the website is hosted.
 * @return {Output<[Object]>}				.files[]
 * @return {Output<String>}						.key						Object's key in S3
 * @return {Output<String>}						.hash						MD5 file hash    
 * 
 */
// (1) For example, to ignore the content under the node_modules folder: '**/node_modules/**'
// 
const Website = function (input) {
	const output = unwrap(input).apply(({ name, acl:_acl, website:__website, versioning, tags }) => {
		if (!name)
			throw new Error('Missing required argument \'name\'.')

		return unwrap(__website).apply(_website => {
			if (_website && !_website.indexDocument && !_website.redirectAllRequestsTo) 
				throw new Error('Missing required arguments. When \'website\' is specified, \'website.indexDocument\' or \'website.redirectAllRequestsTo\' are required.')

			tags = tags || {}
			const acl = _website ? 'public-read' : _acl
			const { website, corsRules, content:_content, cloudfront:_cloudfront } = getWebsiteProps(_website)

			return pulumi.all([unwrap(_content), unwrap(_cloudfront)]).apply(([content, cloudfront]) => {
				const policy = !website ? undefined : JSON.stringify({
					Version: '2012-10-17',
					Statement: [{
						Sid: 'PublicReadGetObject',
						Effect: 'Allow',
						Principal: '*',
						Action: 's3:GetObject',
						Resource: `arn:aws:s3:::${name}/*`
					}]
				})

				// S3 bucket doc: https://www.pulumi.com/docs/reference/pkg/aws/s3/bucket/
				const bucket = new aws.s3.Bucket(name, {
					bucket: name,
					acl,
					website,
					corsRules,
					policy,
					versioning: !versioning ? undefined : { enabled:true },
					tags: {
						...tags,
						Name: name
					}
				})

				let cloudfrontDistro = null
				if (cloudfront) {
					const cloudfrontName = `${name}-distro`
					const originId = cloudfront.customDomains && cloudfront.customDomains[0] ? cloudfront.customDomains[0] : cloudfrontName
					cloudfrontDistro = new aws.cloudfront.Distribution(cloudfrontName, {
						name: cloudfrontName,
						origins: [{
							domainName: bucket.bucketRegionalDomainName,
							originId
						}],
						enabled: true,
						isIpv6Enabled: true,
						defaultRootObject: website.indexDocument || 'index.html',
						aliases: cloudfront.customDomains,
						defaultCacheBehavior: {
							allowedMethods: cloudfront.allowedMethods && cloudfront.allowedMethods.length ? cloudfront.allowedMethods : ['GET', 'HEAD', 'OPTIONS'],
							cachedMethods: ['GET', 'HEAD'],
							targetOriginId: originId,
							forwardedValues: {
								queryString: false,
								cookies: {
									forward: 'none',
								}
							},
							viewerProtocolPolicy: 'redirect-to-https',
							minTtl: 0,
							defaultTtl: 3600,
							maxTtl: 86400
						},
						restrictions: {
							geoRestriction: {
								restrictionType: 'none'
							}
						},
						tags: {
							...tags,
							Name: cloudfrontName
						},
						viewerCertificate: {
							cloudfrontDefaultCertificate: true
						}
					})
				}

				// Uploading content and invalidating distribution
				const files = content && content.dir
					? pulumi.output(_uploadFiles({ bucket, content, cloudfrontDistro, cloudfront }))
					: null

				return {
					bucket,
					cloudfront: cloudfrontDistro,
					files
				}
			})
		})
	})

	this.bucket = output.bucket
	this.cloudfront = output.cloudfront
	this.files = output.files

	return this
}

module.exports = {
	Website
}



