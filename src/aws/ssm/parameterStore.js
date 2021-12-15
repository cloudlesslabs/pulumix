const AWS = require('aws-sdk')
const aws = require('@pulumi/aws')
const ssm = new AWS.SSM({apiVersion: '2014-11-06'})

// Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SSM.html#getParameter-property
const ssmGetParameter = arg => new Promise((next,fail) => ssm.getParameter(arg, (err,data) => err ? fail(err) : next(data)))

/**
 * Gets a parameter from AWS Parameter Store.
 * 
 * WARNING: Requires the 'ssm:GetParameter' permission in the policy.
 * 
 * @param  {String}  name
 * @param  {String}  version						Optional. If null, then the latest version is returned.	
 * @param  {Boolean} json							Default false. True means the Value is parsed to JSON.
 * 
 * @return {String}	 output.Name
 * @return {String}	 output.Type					Valid values: 'String', 'StringList', 'SecureString'
 * @return {String}	 output.Value					If 'json' is true, this is an object.
 * @return {Number}	 output.Version
 * @return {Date}	 output.LastModifiedDate		UTC date
 * @return {String}	 output.ARN
 * @return {String}	 output.DataType				Valid values: 'text', 'aws:ec2:image'
 */
const getParameter = async ({ name, version, json }) => {
	if (!name)
		throw new Error('Missing required argument \'name\'.')

	const Name = version ? `${name}:${version}` : name
	const data = await ssmGetParameter({ Name })

	if (json && data && data.Parameter && data.Parameter.Value) {
		try {
			data.Parameter.Value = JSON.parse(data.Parameter.Value)
		} catch(err) {
			throw new Error(`Failed to JSON parse Parameter Store '${Name}'. Failed parsed value: ${data.Parameter.Value}`)
		}
	} 

	if (!data || !data.Parameter)
		return null
	else
		return Object.keys(data.Parameter).reduce((acc,key) => {
			const newKey = key.replace(/^./, m => (m||'').toLowerCase())
			acc[newKey] = data.Parameter[key]
			return acc
		}, {})
}

/**
 * Creates a new Parameter Store value. Doc: https://www.pulumi.com/registry/packages/aws/api-docs/ssm/parameter/
 * 
 * @param  {Object} 				args
 * @param  {String} 					.name	required	
 * @param  {String} 					.type	Valid types are 'String' (default), 'StringList' and 'SecureString'	
 * @param  {Object} 					.value	This is serialized to string.
 * 
 * @return {Output<ParameterStore>}
 */
const create = async (args) => {
	if (!args)
		throw new Error('Missing required \'args\'.')
	if (!args.name)
		throw new Error('Missing required \'args.name\'.')
	if (args.value === undefined || args.value === null)
		throw new Error('Missing required \'args.value\'.')

	const { value, ...rest } = args
	const t = typeof(value)
	if (t == 'object')
		rest.value = value instanceof Date ? value.toISOString() : JSON.stringify(value)
	else if (t == 'number')
		rest.value = `${value}`
	else if (t == 'boolean')
		rest.value = value ? 'true' : 'false'
	else if (t == 'function')
		rest.value = value.toString()
	else
		rest.value = value

	if (!rest.type)
		rest.type = 'String'

	// https://www.pulumi.com/registry/packages/aws/api-docs/ssm/parameter/
	return new aws.ssm.Parameter(args.name, rest)
}

module.exports = {
	get: getParameter,
	parameter: create
}