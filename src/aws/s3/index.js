/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

// Version: 0.0.1

const aws = require('@pulumi/aws')
const { resolve } = require('../../utils')
const { getWebsiteProps, syncFiles } = require('./utils')
const { error: { mergeErrors } } = require('puffy')

/**
 * Creates an S3 bucket. Doc: https://www.pulumi.com/docs/reference/pkg/aws/s3/bucket/
 * Resources:
 * 	1. S3 bucket.
 * 	
 * @param  {String}				name				
 * @param  {String}				acl								Valid values: 'private' (default), 'public-read' (for website), 'public-read-write', 'aws-exec-read', 'authenticated-read', and 'log-delivery-write'	
 * @param  {Object}				website							If exists, overwrites 'acl' with 'public-read'
 * @param  {String}					.indexDocument				e.g., 'index.html'	
 * @param  {String}					.errorDocument				e.g., 'error.html'
 * @param  {String}					.redirectAllRequestsTo		e.g., 'https://neap.co'
 * @param  {Object}					.routingRules
 * @param  {[Object]}				.cors						https://www.pulumi.com/docs/reference/pkg/aws/s3/bucket/#using-cors	
 * @param  {Object}					.content
 * @param  {String}						.dir        			Local path to the content that should be moved to the bucket.
 * @param  {String|[String]}			.ignore					(1) Ignore patterns for files under 'dir' 
 * @param  {[Object]}					.existingContent[]		Skip uploading files that match both the key AND the hash
 * @param  {String}							.key				Bucket object key
 * @param  {String}							.hash				Bucket object hash
 * @param  {Boolean}					.remove					Default false. True means all files must be removed from the bucket.
 * @param  {Boolean}					.noWarning				Default false.
 * @param  {Boolean}			versioning						Default false.		
 * @param  {String}				tags				
 * 
 * @return {Output<Bucket>}		output.bucket
 * @return {Output<String>}			.websiteEndpoint			Unfriendly AWS URL where the S3 website can be accessed (only set when the 'website' property is set).
 * @return {Output<String>}			.bucketDomainName			e.g., 'bucketname.s3.amazonaws.com'
 * @return {Output<String>}			.bucketRegionalDomainName	e.g., 'https://bucketname.s3.ap-southeast-2.amazonaws.com'
 * @return {Output<String>}			.region						e.g., 'ap-southeast-2'
 * @return {Output<[Object]>}		.content[]
 * @return {Output<String>}				.key					Object's key in S3
 * @return {Output<String>}				.hash					MD5 file hash    
 *
 * 
 */
// (1) For example, to ignore the content under the node_modules folder: '**/node_modules/**'
// 
const createBucket = async ({ name, acl:_acl, website:_website, versioning, tags }) => {
	if (!name)
		throw new Error('Missing required argument \'name\'.')
	if (_website && !_website.indexDocument && !_website.redirectAllRequestsTo) 
		throw new Error('Missing required arguments. When \'website\' is specified, \'website.indexDocument\' or \'website.redirectAllRequestsTo\' are required.')

	tags = tags || {}
	const acl = _website ? 'public-read' : _acl
	const { website, corsRules } = getWebsiteProps(_website)

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

	// Uploading content
	if (_website && _website.content && _website.content.dir) {
		const [bucketName] = await resolve([bucket.name, bucket.urn])

		const [errors, files] = await syncFiles({ 
			bucket:bucketName, 
			dir:_website.content.dir, 
			ignore: _website.content.ignore,
			existingObjects: _website.content.existingContent,
			remove: _website.content.remove,
			noWarning: true
		})
		if (errors)
			throw mergeErrors(errors)

		bucket.content = (files||[]).map(file => ({ key:file.key, hash:file.hash }))
	} else
		bucket.content = null

	return {
		bucket
	}
}

module.exports = {
	bucket: createBucket
}


