// Cloudfront doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html
const AWS = require('aws-sdk')
const { error:{ catchErrors, wrapErrors } } = require('puffy')

/**
 * Gets resources by tag. Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/ResourceGroupsTaggingAPI.html#getResources-property
 * 
 * @param  {Object}   tags							Required
 * @param  {String}   region						Required. WARNING. Certain AWS services are global (e.g., 'cloudfront'), which means their region is 'us-east-1'. 		
 * @param  {[String]} types							Optional. For example: 'ec2:instance', 'cloudfront:distribution'
 * 
 * @return {String}   output.paginationToken		
 * @return {[Object]} output.resources[]		
 * @return {String} 	.arn
 * @return {Object} 	.tags		
 */
const getResourcesByTags = ({ tags, region, types }) => catchErrors((async() => {
	const errMsg = 'Failed to get resources by tag'

	if (!tags)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'tags\'')])
	if (!region)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'region\'')])

	const keys = Object.keys(tags)
	if (!keys.length)
		return []

	const resource = new AWS.ResourceGroupsTaggingAPI({ apiVersion: '2017-01-26', region })
	const resourceTypeFilter = !types || !types.length ? {} : {
		ResourceTypeFilters: types
	}

	const [errors, resp] = await _getResources(resource, {
		...resourceTypeFilter,
		TagFilters: keys.map(Key => ({
			Key,
			Values:[tags[Key]]
		}))
	})

	if (errors)
		throw wrapErrors(errMsg, errors)

	const { PaginationToken, ResourceTagMappingList } = resp || {}
	return {
		paginationToken: PaginationToken,
		resources: (ResourceTagMappingList||[]).map(r => ({
			arn: r.ResourceARN,
			tags: (r.Tags||[]).reduce((acc,tag) => {
				acc[tag.Key] = tag.Value
				return acc
			}, {})
		}))
	}
})())

const _promisify = fn => (resource, ...args) => catchErrors(new Promise((next,fail) => {
	resource[fn](...args, (err,data) => {
		if (err)
			fail(err)
		else
			next(data)
	})
}))

const _getResources = _promisify('getResources')

module.exports = {
	getResources: getResourcesByTags
}