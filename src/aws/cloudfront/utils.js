// Cloudfront doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html
const AWS = require('aws-sdk')
const cloudfront = new AWS.CloudFront({apiVersion: '2020-05-31'})
const { error:{ catchErrors, wrapErrors } } = require('puffy')
const { getResources } = require('../tag/utils')

/**
 * Selects distribution by id or tags.
 * 
 * @param  {String}				id
 * @param  {Object}				tags
 * @param  {Boolean}			existMode			Default false. True means that the function return a boolean that simply check if at least one Cloudfront distribution matches the predicates.
 * 		
 * @return {[Object]|Boolean}	data[]				If 'existMode' is true, the output is a boolean.
 * @return {String} 				.id	
 * @return {String} 				.arn	
 * @return {String} 				.domain	
 * @return {String} 				.status	
 * @return {Date} 					.lastUpdate	
 * @return {String} 				.eTag	
 * @return {Object} 				.fullDetails	Original response
 */
const selectDistribution = ({ id, tags, existMode }) => catchErrors((async() => {
	const errMsg = 'Failed to select distribution'

	if (!id && !tags)
		return []

	if (id) {
		const [errors, resp] = await _getDistribution({ Id:id })
		if (errors)
			throw wrapErrors(errMsg, errors)

		const { ETag, Distribution } = resp || {}
		const { Id, ARN, Status, LastModifiedTime, DomainName } = Distribution || {} 

		if (existMode)
			return Id !== undefined

		return Id ? [{
			id: Id,
			arn: ARN,
			domain: DomainName,
			status: Status,
			lastUpdate: LastModifiedTime,
			eTag: ETag,
			fullDetails: Distribution
		}] : []
	} else {
		const [errors, resp] = await getResources({ tags, region: 'us-east-1', types: ['cloudfront:distribution'] })
		if (errors)
			throw wrapErrors(errMsg, errors)

		const ids = ((resp||{}).resources||[]).map(r => (r.arn||'').split('/').slice(-1)[0]).filter(x => x)
		if (ids.length) {
			if (existMode)
				return true
			const data = await Promise.all(ids.map(i => selectDistribution({ id:i })))
			const allErrors = []
			const allDistros = []
			for(let i=0;i<data.length;i++) {
				const [errors2, distros] = data[i]
				if (errors2)
					allErrors.push(...errors2)
				else if (distros && distros[0])
					allDistros.push(distros[0])
			}

			if (allErrors.length)
				throw wrapErrors(errMsg, allErrors)
			return allDistros
		} else 
			return existMode ? false : []
	}
})())


/**
 * Finds distribution by id or tags.
 * 
 * @param  {String}	id
 * @param  {Object}	tags
 * 		
 * @return {Object}	data				
 * @return {String} 	.id	
 * @return {String} 	.arn	
 * @return {String} 	.domain	
 * @return {String} 	.status	
 * @return {Date} 		.lastUpdate	
 * @return {String} 	.eTag	
 * @return {Object} 	.fullDetails	Original response
 */
const findDistribution = ({ id, tags }) => selectDistribution({ id, tags }).then(data => data[0] ? data : [null, (data[1]||[])[0]])

/**
 * Checks if at least one distribution matches the predicates.
 * 
 * @param  {String}		id
 * @param  {Object}		tags
 * 		
 * @return {Boolean}
 */
const distributionExists = ({ id, tags }) => catchErrors((async() => {
	const errMsg = 'Failed to verify if distributions exist' 

	if (!id && (!tags || !Object.keys(tags).length))
		return false

	const [errors, result] = await selectDistribution({ id, tags, existMode:true })
	if (errors)
		throw wrapErrors(errMsg, errors)

	return result
})())

/**
 * Cloudfront distribution doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html#createDistributionWithTags-property
 * Side-effects:
 * 	- If no "Name" tag is explicitly defined, one is created using the 'name' value.
 * 
 * @param  {String}		name				Required.
 * @param  {String}		domain				Required. e.g., bucket.bucketRegionalDomainName
 * @param  {String}		operationId			Required. Used to prevent to submit the same request over and over again.
 * @param  {String}		description	
 * @param  {Boolean}	disable				Default false.
 * @param  {String}		viewerPolicy		Default is 'allow-all'. Allowed values: 'allow-all', 'https-only', 'redirect-to-https'
 * @param  {[String]}	allowedMethods		Default is ['GET', 'HEAD']. Allowed values: 'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'OPTIONS', 'DELETE'
 * @param  {[String]}	cachedMethods		Default is ['GET', 'HEAD']. Allowed values: 'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'OPTIONS', 'DELETE'
 * @param  {String}		defaultRootObject	Default 'index.html'.
 * @param  {[String]}	aliases				e.g., ['www.example.com', 'example.com']
 * @param  {String}		priceClass			Default 'PriceClass_All'. Allowed values: 'PriceClass_100', 'PriceClass_200', 'PriceClass_All'
 * @param  {Object}		tags			
 * 	
 * @return {Object}		resp
 * @return {String}			.id
 * @return {String}			.arn
 * @return {String}			.status
 * @return {String}			.domain
 * @return {Object}			.fullDetails	Original response.
 */
const createDistribution = input => catchErrors((async() => {
	let {
		name, 
		domain,
		operationId,
		description,
		disable, 
		viewerPolicy,
		allowedMethods,
		cachedMethods,
		defaultRootObject,
		aliases,
		priceClass,
		tags
	} = input || {}

	const errMsg = 'Failed to create cloudfront distribution '

	if (!name)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'name\'')])
	if (!domain)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'domain\'')])
	if (!operationId)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'operationId\'')])

	tags = tags || {}
	if (!tags.Name)
		tags.Name = name

	allowedMethods = allowedMethods || ['GET', 'HEAD']
	cachedMethods = cachedMethods || ['GET', 'HEAD']

	const originIsS3 = /.*\.s3\.(.*?)amazonaws.com/.test(domain)
	const customOriginConfig = !originIsS3 ? {} : {
		CustomOriginConfig: {
			HTTPPort: 80, 
			HTTPSPort: 80,
			OriginProtocolPolicy: 'http-only'
		}
	}

	const DistributionConfig = {
		CallerReference: operationId,
		Comment: description || `Cloudfront distribution '${name}'.`,
		Enabled: disable !== true,
		IsIPV6Enabled: true,
		DefaultRootObject: defaultRootObject === null ? null : (defaultRootObject||'index.html'),
		Origins: {
			Items:[{
				Id: name,
				DomainName: domain,
				...customOriginConfig
			}],
			Quantity: 1
		},
		Aliases: { 
			Quantity: (aliases||[]).length, 
			Items: aliases || []
		},
		DefaultCacheBehavior: {
			TargetOriginId: name,
			ViewerProtocolPolicy: viewerPolicy || 'allow-all',
			AllowedMethods: {
				Items: allowedMethods,
				Quantity: allowedMethods.length,
				CachedMethods: {
					Items: cachedMethods,
					Quantity: cachedMethods.length
				}
			},
			DefaultTTL: 3600,
			MaxTTL: 86400,
			MinTTL: 0,
			ForwardedValues: {
				QueryString: false,
				Cookies: {
					Forward: 'none',
					// WhitelistedNames: {
					// 	Quantity: 0,
					// 	Items:[]
					// }
				},
				// Headers: {
				// 	Quantity: 0,
				// 	Items:[]
				// },
				// QueryStringCacheKeys: {
				// 	Quantity: 0,
				// 	Items:[]
				// }
			},
			TrustedSigners: {
				Enabled: false,
				Quantity: 0,
				Items: []
			}
			// FunctionAssociations: {
			// 	Quantity: 0,
			// 	Items:[]
			// },
			// LambdaFunctionAssociations: {
			// 	Quantity: 0,
			// 	Items:[]
			// }
		},
		PriceClass: priceClass || 'PriceClass_All',
		Restrictions: {
			GeoRestriction: {
				Quantity: 0,
				RestrictionType: 'none'
			}
		},
		ViewerCertificate: {
			CloudFrontDefaultCertificate: true
		}
	}

	const tagKeys = Object.keys(tags||{})
	const Tags = {
		Items: tagKeys.map(Key => ({
			Key,
			Value: tags[Key]
		}))
	}

	const [errors, resp] = await _createDistribution({ DistributionConfigWithTags: { DistributionConfig, Tags } })
	if (errors)
		throw wrapErrors(errMsg, errors)

	const { Id, ARN, Status, DomainName } = (resp || {}).Distribution || {}

	return {
		id: Id,
		arn: ARN,
		status: Status,
		domain: DomainName,
		fullDetails: resp
	}
})())

/**
 * Invalidates one, many or all paths in a distribution. Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html#createInvalidation-property
 * 
 * @param  {String}		id				Required.
 * @param  {String}		operationId		Required. Used to prevent to submit the same request over and over again.
 * @param  {[String]}	paths			e.g., ['/images/image1.jpg', '/images/image*', '/images/*', '/*']
 * 
 * @return {String}		resp.location
 * @return {Object}		resp.invalidation
 * @return {String}			.id
 * @return {String}			.status
 * @return {Date}			.createTime
 * @return {[String]}		.paths
 * @return {String}			.operationId
 */
const invalidateDistribution = ({ id, operationId, paths }) => catchErrors((async () => {
	const errMsg = `Failed to invalidate Cloudfront distribution ID '${id}'`

	if (!id)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'id\'')])
	if (!operationId)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'operationId\'')])

	if (!paths || !paths.length)
		return 

	const [errors, resp] = await _createInvalidation({
		DistributionId: id,
		InvalidationBatch: {
			CallerReference: operationId,
			Paths: {
				Quantity: paths.length,
				Items: paths
			}
		}
	})

	if (errors)
		throw wrapErrors(errMsg, errors)

	const { Id, Status, CreateTime, InvalidationBatch } = (resp||{}).Invalidation || {}
	const { Paths, CallerReference } = InvalidationBatch || {}

	return {
		location: (resp||{}).Location,
		invalidation: {
			id: Id,
			status: Status,
			createTime: CreateTime,
			paths: (Paths||{}).Items,
			operationId: CallerReference
		}
	}
})())


const _promisify = fn => (...args) => catchErrors(new Promise((next,fail) => {
	cloudfront[fn](...args, (err,data) => {
		if (err)
			fail(err)
		else
			next(data)
	})
}))

const _createDistribution = _promisify('createDistributionWithTags')
const _createInvalidation = _promisify('createInvalidation')
const _getDistribution = _promisify('getDistribution')

module.exports = {
	distribution: {
		exists: distributionExists,
		select: selectDistribution,
		find: findDistribution,
		create: createDistribution,
		invalidate: invalidateDistribution
	}
}




