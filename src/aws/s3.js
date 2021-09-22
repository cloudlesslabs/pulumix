/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

// Version: 0.0.1

const aws = require('@pulumi/aws')

/**
 * Creates an S3 bucket. 
 * Resources:
 * 	1. S3 bucket.
 * 	
 * @param  {String}           name				
 * @param  {String}           acl										Valid values: 'private' (default), 'public-read' (for website), 'public-read-write', 'aws-exec-read', 'authenticated-read', and 'log-delivery-write'	
 * @param  {Object}           website									If exists, overwrites 'acl' with 'public-read'
 * @param  {String}           website.indexDocument						e.g., 'index.html'	
 * @param  {String}           website.errorDocument						e.g., 'error.html'
 * @param  {String}           website.redirectAllRequestsTo				e.g., 'https://neap.co'
 * @param  {Object}           website.routingRules
 * @param  {[Object]}         website.cors								https://www.pulumi.com/docs/reference/pkg/aws/s3/bucket/#using-cors	
 * @param  {Boolean}          versioning								Default false.		
 * @param  {String}           tags				
 * 
 * @return {Output<Bucket>}   output.bucket
 * @return {Output<String>}   output.bucket.websiteEndpoint				Unfriendly AWS URL where the S3 website can be accessed (only set when the 'website' property is set).
 * @return {Output<String>}   output.bucket.bucketDomainName			e.g., 'bucketname.s3.amazonaws.com'
 * @return {Output<String>}   output.bucket.bucketRegionalDomainName	e.g., 'https://bucketname.s3.ap-southeast-2.amazonaws.com'
 * @return {Output<String>}   output.bucket.region						e.g., 'ap-southeast-2'
 */
const createS3 = async ({ name, acl:_acl, website:_website, versioning, tags }) => {
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

	return {
		bucket
	}
}

/**
 * Parses the website into the correct AWS format
 * 
 * @param  {String}   website.indexDocument		e.g., 'index.html'	
 * @param  {String}   website.errorDocument		e.g., 'error.html'
 * @param  {Object}   website.routingRules
 * @param  {Object}   website.cors	
 * 		
 * @return {Object}   output.website.indexDocument
 * @return {Object}   output.website.errorDocument
 * @return {String}   output.website.routingRules		
 * @return {[Object]} output.corsRules			
 */
const getWebsiteProps = website => {
	if (!website)
		return {}

	if (typeof(website) == 'boolean')
		return { website:{} }

	const { cors, ...web } = website

	if (web.routingRules && typeof(web.routingRules) != 'string')
		web.routingRules = JSON.stringify(web.routingRules)

	return {
		website: web,
		corsRules: cors
	}
}

// const isValidUrl = (value='') => 
// 	/^http[s]{0,1}:\/\/localhost:[0-9]+/.test(value) ||
// 	/^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i.test(value)

// const validateDomain = domain => {
// 	if (!domain)
// 		throw new Error(`Missing required 'domain'`)

// 	domain = domain.toLowerCase().trim()
// 	if (/:\//.test(domain))
// 		throw new Error(`'domain' cannot contain protocol`)
// 	if (!/^[a-b0-9-]/.test(domain))
// 		throw new Error(`A domain must start with a letter, a number or an hyphen`)
// 	if (!isValidUrl(`http://${domain}`))
// 		throw new Error(`Domain '${domain}' is invalid`)
// }

module.exports = createS3



