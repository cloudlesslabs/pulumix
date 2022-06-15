const pulumi = require('@pulumi/pulumi')
const crypto = require('crypto')
const aws = require('@pulumi/aws')
const AWS = require('aws-sdk')
const { time: { delay } } = require('puffy-core')

const REGION = aws.config.region

const outputSchema = {
	deploymentId: undefined,
	version: undefined,
	restApiId: undefined,
	description: undefined,
	hash: undefined,
	history: undefined
}

/**
 * 
 * @param  {Object} props
 * @param  {String} 	.description
 * @param  {String} 	.version		
 * @param  {String} 	.restApiId
 * @param  {[Object]} 	.previousSnapshots[]
 * @param  {String} 		.id
 * @param  {String} 		.version
 * 
 * @return {Object}	output
 * @return {String}		.deploymentId
 * @return {String}		.version
 * @return {String}		.description
 * @return {String}		.restApiId
 * @return {String}		.hash				SHA1 hash of the { version, description } object.
 * @return {String}		.history			Stringify version of the updated 'previousSnapshots' including the new 'deploymentId'.
 */
const _createOutputs = async (props, previousSnapshots) => {
	const { version, description, restApiId } = props || {}
	if (!restApiId)
		throw new Error('Missing required \'restApiId\'.')
	if (!version)
		throw new Error('Missing required \'version\'.')

	const hash = _getPropsHash(props)
	previousSnapshots = previousSnapshots || []
	let snapshot = null

	// If the version already exists, revert to that version
	const previousSnapshotId = (previousSnapshots.find(d => d && d.id && d.version == version)||{}).id
	if (previousSnapshotId)
		snapshot = await _getSnapshot({ id:previousSnapshotId, restApiId })
	else {
		snapshot = await _createSnapshot({ restApiId, description:`version:${version}${description ? ` - ${description}` : ''}` })
		previousSnapshots.push({
			id: snapshot.id,
			version
		})
	}

	return {
		deploymentId: snapshot.id, 
		version,
		description: description||null,
		restApiId: restApiId||null,
		hash,
		history:JSON.stringify(previousSnapshots.map(s => ([s.id,s.version])))
	}
}

const snapshotProvider = {
	/**
	 * 
	 * @param  {Object} props
	 * @param  {String} 	.description
	 * @param  {String} 	.version	
	 * @param  {String} 	.restApiId
	 * 
	 * @return {Object} output
	 * @return {String} 	.id
	 * @return {Object} 	.outs
	 * @return {String}			.deploymentId
	 * @return {String}			.version
	 * @return {String}			.description
	 * @return {String}			.restApiId
	 * @return {String}			.hash				SHA1 hash of the { version, description } object.
	 * @return {String}			.history			Stringify version of the updated 'previousSnapshots' including the new 'deploymentId'.
	 */
	async create(props) {
		const id = crypto.randomBytes(16).toString('hex')
		const outs = await _createOutputs(props)

		return { 
			id,
			outs
		}
	},

	/**
	 * 
	 * @param	{String}	id 
	 * @param	{Object}	currentOuts
	 * @param	{String}		.deploymentId
	 * @param	{String}		.version
	 * @param	{String}		.description
	 * @param	{String}		.restApiId
	 * @param	{String}		.hash				SHA1 hash of the { version, description } object.
	 * @param	{String}		.history			Stringify version of the updated 'previousSnapshots' including the new 'deploymentId'.
	 * @param	{Object}	props
	 * @param	{String} 		.version	
	 * @param	{String}		.description
	 * @param	{String}		.restApiId
	 * 
	 * @return	{Object}	output
	 * @return	{Boolean}		.changes
	 */
	async diff(id, currentOuts, props) {
		const hash = _getPropsHash(props)
		return {
			changes: (currentOuts||{}).hash != hash
		}
	},

	/**
	 * 
	 * 
	 * @param	{String}	id 
	 * @param	{Object}	currentOuts
	 * @param	{String}		.deploymentId
	 * @param	{String}		.version
	 * @param	{String}		.description
	 * @param	{String}		.restApiId
	 * @param	{String}		.hash
	 * @param	{String}		.history			Stringify version of the updated 'previousSnapshots' including the new 'deploymentId'.
	 * @param	{Object}	props
	 * @param	{String} 		.version	
	 * @param	{String}		.description
	 * @param	{String}		.restApiId
	 *
	 * @return	{Object}	output
	 * @return	{Object} 		.outs
	 * @return	{String}			.deploymentId
	 * @return	{String}			.version
	 * @return	{String}			.description
	 * @return	{String}			.restApiId
	 * @return	{String}			.hash				SHA1 hash of the { version, description } object.
	 * @return	{String}			.history			Stringify version of the updated 'previousSnapshots' including the new 'deploymentId'.
	 */
	async update(id, currentOuts, props) {
		const previousSnapshots = _parseHistory((currentOuts||{}).history)
		const outs = await _createOutputs(props, previousSnapshots)
		outs.restApiId = currentOuts.restApiId

		return {
			outs
		}
	}
}

class Snapshot extends pulumi.dynamic.Resource {
	constructor(name, props, opts) {
		super(
			snapshotProvider, 
			name, 
			{ 
				...outputSchema,
				...(props||{})
			}, 
			opts)
	}
}

/**
 * Creates a SHA1 hash of an object.
 * 
 * @param  {Object} obj
 * 
 * @return {String} hash
 */
const _getHash = obj => {
	const strObj = obj === null || obj === undefined ? '' : typeof(obj) == 'object' ? JSON.stringify(obj) : `${obj}`	
	return crypto.createHash('sha1').update(strObj).digest('hex')
}

/**
 * Creates a SHA1 hash of an object.
 * 
 * @param  {Object} obj
 * @param  {String} 	.version
 * @param  {String} 	.description
 * 
 * @return {String} hash
 */
const _getPropsHash = obj => _getHash({ version:(obj||{}).version, description:(obj||{}).description })

/**
 * Creates a new API Gateway snapshot, aka deployment in the broken AWS jargon.
 * 
 * @param  {String} restApiId
 * @param  {String} description
 * 
 * @return {Object} snapshot
 * @return {String} 	.id
 */
const _createSnapshot = async ({ restApiId, description }) => {
	if (!restApiId)
		throw new Error('Missing required argument \'restApiId\'')
	if (typeof(restApiId) != 'string')
		throw new Error(`Wrong argument exception. 'restApiId' is expected to be a string. Found ${typeof(restApiId)} instead.`)

	const apigateway = new AWS.APIGateway({ region:REGION })

	let retryCount = 0
	while (retryCount < 10) {
		// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/APIGateway.html#createDeployment-property
		const [error, data] = await apigateway.createDeployment({
			restApiId,
			description
		}).promise().then(d => ([null, d])).catch(err => ([err,null]))

		if (error) {
			const tooManyRequests = /oo many requests/.test((error.message||'').toLowerCase())
			if (tooManyRequests) {
				await delay([7000, 14000]) // max 1 deployment per 5 seconds per account. Doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html#api-gateway-control-service-limits-table
				retryCount++
			} else
				throw error 
		} else {
			if (!data || !data.id)
				throw new Error('Missing \'id\' in the \'createDeployment\' response.')

			return data
		}
	}

	throw new Error('Max amount of API Gateway deployment retries exceeded (max 10).')
}

/**
 * Creates a new API Gateway snapshot, aka deployment in the broken AWS jargon.
 * 
 * @param  {String} restApiId
 * @param  {String} description
 * 
 * @return {Object} snapshot
 * @return {String} 	.id
 * @return {String} 	.description
 */
const _getSnapshot = async ({id, restApiId}) => {
	if (!id)
		throw new Error('Missing required argument \'id\'')
	if (!restApiId)
		throw new Error('Missing required argument \'restApiId\'')
	if (typeof(restApiId) != 'string')
		throw new Error(`Wrong argument exception. 'restApiId' is expected to be a string. Found ${typeof(restApiId)} instead.`)

	const apigateway = new AWS.APIGateway({ region:REGION })

	let retryCount = 0
	while (retryCount < 10) {
		// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/APIGateway.html#getDeployment-property
		const [error, data] = await apigateway.getDeployment({
			deploymentId:id,
			restApiId,
		}).promise().then(d => ([null, d])).catch(err => ([err,null]))

		if (error) {
			const tooManyRequests = /oo many requests/.test((error.message||'').toLowerCase())
			if (tooManyRequests) {
				await delay([1000, 3000]) // max 5 requests every 2 seconds per account. Doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html#api-gateway-control-service-limits-table
				retryCount++
			} else
				throw error 
		} else {
			if (!data)
				throw new Error(`Snapshot (aka API Gateway Deployment) ID ${id} not found.`)
			if (!data.id)
				throw new Error('Missing \'id\' in the \'getDeployment\' response.')

			return data
		}
	}

	throw new Error('Max amount of API Gateway \'getDeployment\' retries exceeded (max 10).')
}

const _parseHistory = history => {
	if (!history)
		throw new Error('Missing required argument \'history\'')
	const array = JSON.parse(history)
	return array.map(([id,version]) => ({ id, version }))

}

module.exports = {
	Snapshot
}