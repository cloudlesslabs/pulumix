/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

const pulumi = require('@pulumi/pulumi')
const { join } = require('path')
const fg = require('fast-glob')
const fs = require('fs')
const { error:{ catchErrors } } = require('puffy')

/**
 * Converts an Output<T> to a Promise<T>
 * 
 * @param  {Output<T>||[Output<T>]}     resource
 * @return {Promise<T>||Promise<[T]>}
 */
const resolve = resource => new Promise((next, fail) => {
	if (!resource)
		next(resource)
	try {
		if (Array.isArray(resource)) {
			if (resource.every(r => r && r.apply))
				pulumi.all(resource).apply(data => next(data))    
			else
				Promise.all(resource.map(r => resolve(r))).then(data => next(data)).catch(fail)
		} else if (resource.apply)
			resource.apply(data => next(data))
		else
			next(resource)
	} catch(err) {
		fail(err)
	}
})

//
// Gets an array of absolute file paths located under the 'folderPath', or a Channel that streams those files.
// 
// @param  {String}				folderPath			Absolute or relative path to folder
// @param  {String|[String]}	options.pattern 	Default is '*.*' which means all immediate files. To get all the files
//													use '**/*.*'
// @param  {String|[String]}	options.ignore		e.g., '**/node_modules/**'
// @param  {Channel}			options.channel		When a channel is passed, all files are streamed to that channel instead of 
// 													being returned as an array. The last file found add a specific string on 
// 													the channel to indicates that the scan is over. That string value is: 'end'.
// @return {[String]}         						If a channel is passed via 'options.channel', than the output is null and 
// 													the files are streamed to that channel.
//
const listFiles = async (folderPath, options={}) => {
	const pattern = options.pattern || '*.*'
	const ignore = options.ignore
	const patterns = (typeof(pattern) == 'string' ? [pattern] : pattern).map(p => join(folderPath, p))
	const opts = ignore ? { ignore:(typeof(ignore) == 'string' ? [ignore] : ignore).map(p => join(folderPath, p)) } : {}

	return await catchErrors(fg(patterns,opts).then(files => files||[]))
}

/**
 * Deletes a file.
 * 
 * @param  {String}  filePath 	Absolute file path on the local machine
 * @return {Void}
 */
const deleteFile = filePath => catchErrors(new Promise((onSuccess, onFailure) => fs.unlink(filePath||'', err => err ? onFailure(err) : onSuccess())))

/**
 * Gets a file under a Google Cloud Storage's 'filePath'.
 * 
 * @param  {String}  filePath 	Absolute file path on the local machine
 * @return {Buffer}
 */
const readFile = filePath => catchErrors(new Promise((onSuccess, onFailure) => fs.readFile(filePath||'', (err, data) => err ? onFailure(err) : onSuccess(data))))


/**
 * Unwrap an output AND its properties. Example: 
 * 
 * 	unwrap(o, x => ({ id: x.id })).apply(v => console.log(`ID is ${v.id}`))
 * 	unwrap(arrayOutput, x => ({ id: x.id })).apply(v => v.forEach(x => console.log(`ID is ${x.id}`)))
 * 
 * @param  {Output<T>|Output<[T]>}	output			Could also be an object of type T or [T] or a promise Promise<T> or Promise<[T]>
 * @param  {Func}					props			(1) Mapping function from (T => U) (e.g., x => ({ id:x.id, name:x.name }))
 * 
 * @return {Output<U>|Output<[U]>}	unwrappedOut	Each property of U is unwrapped and ready to be read.	
 *
 * (1) U must be an object.
 */
const unwrap = (output, props) => {
	const _output = !output || !output.apply || typeof(output.apply) != 'function' 
		? pulumi.output(output)
		: output

	const _getProps = props && props.length ? () => props : v => Object.keys(v)
	
	const _mapValuesToOutputs = typeof(props) == 'function'
		? (idx=0) => v => {
			const _v = !v || !v.apply || typeof(v.apply) != 'function' ? pulumi.output(v) : v
			return Object.entries(props(_v)).map(([p,vv]) => ([p,(vv instanceof Promise) ? pulumi.output(vv) : vv, idx++]))
		}
		: (idx=0) => v => {
			const _props = _getProps(v)
			return _props.map(p => {
				const _val = v[p]
				return [p, (_val instanceof Promise) ? pulumi.output(_val) : _val, idx++]
			})
		}

	return _output.apply(val => {
		if (!val)
			return null

		const isArray = Array.isArray(val)
		const values = isArray ? val : [val]
		const outputs = values.map(_mapValuesToOutputs())

		return pulumi
			.all(outputs.reduce((acc, outs) => {
				acc.push(...outs.map(o => o[1]))
				return acc
			}, []))
			.apply(vals => {
				const unwrappedValues = outputs.map(outs => outs.reduce((acc, [prop,,i]) => {
					acc[prop] = vals[i]
					return acc
				}, {}))

				return isArray ? unwrappedValues : unwrappedValues[0]
			})
	})
}

const SUPPORTED_BACKENDS = ['pulumi', 's3', 'azblob', 'gs', 'file']
/**
 * Gets the project and stack name. Manages cases where the backend is not Pulumi.
 * 
 * @param  {Object}	options
 * @param  {String}		.backend			Valid values: 'pulumi' (default), 's3', 'azblob', 'gs', 'file'.
 * 
 * @return {Object}	output
 * @return {String}		.project			e.g., 'my-project'
 * @return {String}		.stack				e.g., 'prod'
 * @return {String}		.fullStack			e.g., 'prod' or 'my-project.prod'
 * @return {Function}	.createResourceName	e.g., createResourceName('lambda') -> 'my-project-lambda-prod'
 */
const getProject = options => {
	const { backend } = options || {}
	const project = pulumi.getProject()
	const stack = pulumi.getStack()

	const stackData = backend === undefined || backend === null || backend === 'pulumi'
		? { stack, fullStack:stack }
		: SUPPORTED_BACKENDS.indexOf(backend) < 0
			? null
			: { stack:stack.replace(`${project}.`,''), fullStack:stack }

	if (!stackData)
		throw new Error(`Unsupported 'backend' value. Expecting one of those values: ${SUPPORTED_BACKENDS}. Found '${backend}' instead.`)

	return {
		project,
		...stackData,
		createResourceName: name => `${project}${name ? `-${name}` : ''}-${stackData.stack}`
	}
}

/**
 * Gets the stack reference
 * 
 * @param  {Object}			input
 * @param  {String}				.org		
 * @param  {String}				.project		
 * @param  {String}				.stack		
 * @param  {String}				.backend	
 * 	
 * @return {Output<Stack>}	stackRef
 */
const getStack = ({ org, project, stack, backend }) => {
	if (!project)
		throw new Error('Missing required argument \'project\',')
	if (!stack)
		throw new Error('Missing required argument \'stack\',')

	if (backend === undefined || backend === null || backend === 'pulumi')
		return new pulumi.StackReference(org ? `${org}/${project}/${stack}` : `${project}/${stack}`)
	else if (SUPPORTED_BACKENDS.indexOf(backend) < 0)
		throw new Error(`Unsupported 'backend' value. Expecting one of those values: ${SUPPORTED_BACKENDS}. Found '${backend}' instead.`)

	return new pulumi.StackReference(`${project}.${stack}`)
}

const keepResourcesOnly = data => {
	if (!data || !Array.isArray(data))
		return 
	else
		return data.filter(d => d && (d instanceof pulumi.Resource || d instanceof pulumi.CustomResource))
}

module.exports = {
	resolve,
	unwrap,
	getProject,
	getStack,
	files: {
		list: listFiles,
		remove: deleteFile,
		read: readFile
	},
	keepResourcesOnly
}