/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

const fs = require('fs')
const fg = require('fast-glob')
const { join, extname, sep, posix } = require('path')
const { createHash } = require('crypto')
const { utils: { throttle } } = require('core-async')
const mime = require('mime-types')
const { error:{ catchErrors, wrapErrors } } = require('puffy')
const AWS = require('aws-sdk')
const s3 = new AWS.S3({ apiVersion: '2006-03-01', computeChecksums: true })


/**
 * Syncs files with an S3 bucket. Doc: 
 * 		- putObject: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
 * 		- deleteObjects: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#deleteObjects-property
 *
 * WARNING: This operation requires a the 's3:PutObject' permission. If the ACL is also set, then the 's3:PutObjectAcl'
 * permission is also required.
 * 
 * @param  {String}				bucket					Bucket name.
 * @param  {[Object]}			files[]
 * @param  {Buffer}					.content
 * @param  {String}					.path		
 * @param  {String}					.key
 * @param  {String}					.contentType		
 * @param  {String}					.cacheControl		
 * @param  {String}					.hash			
 * @param  {Number}					.contentLength	
 * @param  {String}				dir		
 * @param  {String|[String]}	ignore					(1) Ignore patterns for files under 'dir' 
 * @param  {[Object]}			existingObjects[]		Skip uploading files that match both the key AND the hash
 * @param  {String}					.key				Bucket object key
 * @param  {String}					.hash				Bucket object hash
 * @param  {Boolean}			remove					Default false. True means all files must be removed from the bucket.
 * @param  {Boolean}			noWarning				Default false.
 * 
 * @return {Boolean}			output.updated			True means at least one file was either uploaded or deleted.
 * @return {Boolean}			output.srcFiles			All files(2) in the local file system.
 * @return {Boolean}			output.uploadedFiles	Uploaded files(2) dues to being new or having changed
 * @return {Boolean}			output.deletedFiles		Deleted files(2) are files that are in the 'existingObjects' but not in the local file system anymore.
 */
// (1) For example, to ignore the content under the node_modules folder: '**/node_modules/**'
// (2) A file object is structured as follow:
//		{String} file				Absolute file path.
//		{String} dir				Absolute folder path.	
//		{String} key				Object's key in S3
//		{String} path				Relative file path (relative to the folder).	
//		{String} hash				MD5 file hash	
//		{String} contentType		e.g., 'application/javascript; charset=utf-8' or 'image/png'
//		{Number} contentLength		File's size in bytes.	
//		{Buffer} content			Only set if 'includeContent' is set to true.
// 
const syncFiles = ({ bucket, files, dir, ignore, existingObjects, remove, noWarning }) => catchErrors((async () => {
	const errMsg = `Failed to sync files with S3 bucket '${bucket}'`
	existingObjects = existingObjects || []

	if (!bucket)
		throw wrapErrors(errMsg, [new Error('Missing required \'bucket\' argument')])

	if (!(await bucketExists(bucket))) {
		console.log(`WARNING: Bucket '${bucket}' does not exist (yet). Synching files aborted.`)
		return []
	}

	let _files = files && files.length ? [...files] : []

	if (dir) {
		const [fileErrors, dirFiles] = await getFiles({ dir, includeContent:true, ignore })
		if (fileErrors)
			throw wrapErrors(errMsg, dirFiles)	
		
		_files.push(...dirFiles)
	}

	if (remove)
		_files = []

	const deletedFiles = existingObjects.reduce((acc, file) => {
		const fileExists = _files.some(f => f.key == file.key)
		if (!fileExists)
			acc.push(file)
		return acc
	}, [])

	// Uploads files
	const [srcFileErrors, srcFiles] = await uploadFiles({ bucket, files:_files, ignoreObjects:existingObjects, noWarning })
	if (srcFileErrors)
		throw wrapErrors(errMsg, srcFileErrors)

	// Deletes files
	if (deletedFiles.length) {
		const [removeErrors] = await removeObjects({ bucket, keys:deletedFiles.map(f => f.key) })
		if (removeErrors)
			throw wrapErrors(errMsg, removeErrors)
	}

	const uploadedFiles = (srcFiles||[]).filter(x => !x.ignored)

	const output = {
		updated: uploadedFiles.length > 0 || deletedFiles.length > 0,
		srcFiles,
		uploadedFiles,
		deletedFiles
	}

	return output
})())

/**
 * Uploads files to an S3 bucket. Doc: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
 * 
 * WARNING: This operation requires a the 's3:PutObject' and the 's3:ListBucket' permissions. If the ACL is also set, then the 's3:PutObjectAcl'
 * permission is also required.
 * 
 * @param  {String}				bucket					Bucket name.
 * @param  {[Object]}			files[]
 * @param  {Buffer}					.content
 * @param  {String}					.path		
 * @param  {String}					.key
 * @param  {String}					.contentType		
 * @param  {String}					.cacheControl		
 * @param  {String}					.hash			
 * @param  {Number}					.contentLength	
 * @param  {String}				dir		
 * @param  {String|[String]}	ignore					(1) Ignore patterns for files under 'dir'.
 * @param  {[Object]}			ignoreObjects[]			Skip uploading files that match both the key AND the hash
 * @param  {String}					.key				Bucket object key
 * @param  {String}					.hash				Bucket object hash
 * @param  {Boolean}			noWarning				Default false.
 * 
 * @return {String}				data[].file				Absolute file path.
 * @return {String}				data[].dir				Absolute folder path.
 * @return {Boolean}			data[].ignored			True means the file was not uploaded because it was in the 'ignoreObjects' list.
 * @return {String}				data[].key				Object's key in S3
 * @return {String}				data[].path				Relative file path (relative to the folder).	
 * @return {String}				data[].hash				MD5 file hash	
 * @return {String}				data[].contentType		e.g., 'application/javascript; charset=utf-8' or 'image/png'
 * @return {Number}				data[].contentLength	File's size in bytes.	
 * @return {Buffer}				data[].content			Only set if 'includeContent' is set to true.
 */
// (1) For example, to ignore the content under the node_modules folder: '**/node_modules/**'
// 
const uploadFiles = ({ bucket, files, dir, ignore, ignoreObjects, noWarning }) => catchErrors((async () => {
	const errMsg = `Failed to upload files to S3 bucket '${bucket}'`
	ignoreObjects = ignoreObjects || []

	if (!bucket)
		throw wrapErrors(errMsg, [new Error('Missing required \'bucket\' argument')])

	if (!(await bucketExists(bucket))) {
		if (!noWarning)
			console.log(`WARNING: Bucket '${bucket}' does not exist (yet). Uploading files aborted.`)
		return []
	}

	const _files = files && files.length ? [...files] : []

	if (dir) {
		const [fileErrors, dirFiles] = await getFiles({ dir, includeContent:true, ignore })
		if (fileErrors)
			throw wrapErrors(errMsg, dirFiles)	
		
		_files.push(...dirFiles)
	}

	if (!_files || !_files.length)
		return []


	const allErrors = []
	const objects = await throttle(_files.map((file,idx) => (async () => {
		const { content, contentType, cacheControl, hash, contentLength, key } = file || {}
		if (!key)
			allErrors.push(new Error(`Missing required 'files[${idx}].key' property`))
		if (!content)
			allErrors.push(new Error(`Missing required 'files[${idx}].content' property`))

		if (allErrors.length)
			return

		const f = { ...file, ignored:false }
		if (ignoreObjects.some(x => x.key == key && x.hash == hash)) {
			f.ignored = true
			return file
		} else {
			const [errors] = await putObject({
				Body: content, 
				Bucket: bucket, 
				Key: key,
				ContentType: contentType,
				CacheControl: cacheControl,
				ContentLength: contentLength
			})

			if (errors) {
				allErrors.push(...errors)
				return
			} else
				return f
		}
	})), 10)

	if (allErrors.length)
		throw wrapErrors(errMsg, allErrors)

	return objects
})())

const putObject = (...args) => new Promise(next => {
	try {
		s3.putObject(...args, (err, data) => err ? next([[err],null]) : next([null,data]))
	} catch(err) {
		next([[err],null])
	}
})

const headBucket = (...args) => new Promise(next => {
	try {
		s3.headBucket(...args, (err, data) => err ? next([[err],null]) : next([null,data]))
	} catch(err) {
		next([[err],null])
	}
})

const deleteObjects = (...args) => new Promise(next => {
	try {
		s3.deleteObjects(...args, (err, data) => err ? next([[err],null]) : next([null,data]))
	} catch(err) {
		next([[err],null])
	}
})

/**
 * Checks if a file or folder exists
 * 
 * @param  {String}  filePath 	Absolute or relative path to file or folder on the local machine
 * @return {Boolean}   
 */
const fileExists = filePath => new Promise(onSuccess => fs.exists((filePath||''), yes => onSuccess(yes ? true : false)))

/**
 * Gets a file under a Google Cloud Storage's 'filePath'.
 * 
 * @param  {String}  filePath 	Absolute file path on the local machine
 * @return {Buffer}
 */
const readFile = filePath => new Promise((onSuccess, onFailure) => fs.readFile(filePath||'', (err, data) => err ? onFailure(err) : onSuccess(data)))

//
// Gets an array of absolute file paths located under the 'folderPath', or a Channel that streams those files.
// 
// @param  {String}				folderPath			Absolute or relative path to folder
// @param  {String|[String]}	options.pattern 	Default is '*.*' which means all immediate files. To get all the files
//													use '**/*.*'. To include the hidden files, use: ['**/*.*', '**/.*/*'].
// @param  {String|[String]}	options.ignore		e.g., '**/node_modules/**'
// @param  {Channel}			options.channel		When a channel is passed, all files are streamed to that channel instead of 
// 													being returned as an array. The last file found add a specific string on 
// 													the channel to indicates that the scan is over. That string value is: 'end'.
// @return {[String]}         						If a channel is passed via 'options.channel', than the output is null and 
// 													the files are streamed to that channel.
// 													
const listFiles = async (folderPath, options={}) => {
	folderPath = folderPath||''
	const pattern = options.pattern || '*.*'
	const ignore = options.ignore
	const channel = options.channel
	const patterns = (typeof(pattern) == 'string' ? [pattern] : pattern).map(p => join(folderPath, p))
	const opts = ignore ? { ignore:(typeof(ignore) == 'string' ? [ignore] : ignore).map(p => join(folderPath, p)) } : {}

	if (!channel)
		return await fg(patterns,opts)
	else {
		const stream = fg.stream(patterns,opts)
		stream.on('data', data => {
			channel.put(data)
		})
		stream.on('end', () => {
			channel.put('end')
			stream.destroy()
		})
		stream.on('error', err => {
			console.log(`An error happened while streaming files from ${folderPath}: ${err}`)
			stream.destroy()
		})

		return null
	}
}

//
// Gets an array of absolute file paths located under the 'folderPath', or a Channel that streams those files.
// 
// @param  {String}				folderPath			Absolute or relative path to folder
// @param  {String|[String]}	options.pattern 	Default is '*.*' which means all immediate files. To get all the files
//													use '**/*.*'. To include the hidden files, use: ['**/*.*', '**/.*/*'].
// @param  {String|[String]}	options.ignore		e.g., '**/node_modules/**'
// @param  {Channel}			options.channel		When a channel is passed, all files are streamed to that channel instead of 
// 													being returned as an array. The last file found add a specific string on 
// 													the channel to indicates that the scan is over. That string value is: 'end'.
// 													
// @return {[String]}         						If a channel is passed via 'options.channel', than the output is null and 
// 													the files are streamed to that channel.
// 		
const getLocalFiles = (folderPath, options) => catchErrors((async () => {
	const errMsg = `Failed to list files in folder '${folderPath}'`
	options = options || {}

	if (!folderPath)
		throw wrapErrors(errMsg, [new Error('Missing required \'folderPath\' argument')])
	if (!(await fileExists(folderPath)))
		throw wrapErrors(errMsg, [new Error(`Folder '${folderPath}' not found.`)])

	const [errors, data] = await catchErrors(listFiles(folderPath, options))
	if (errors)
		throw wrapErrors(errMsg, errors)		
	return data || []
})())

/**
 * Gets the content type associated with a file extension. 
 *
 * @param  {String}	fileOrExt		e.g., 'json', '.md', 'file.html', 'folder/file.js'
 * 
 * @return {String}	contentType		e.g., 'application/json; charset=utf-8', 'text/x-markdown; charset=utf-8', 'text/html; charset=utf-8'
 */
const getContentType = fileOrExt => !fileOrExt ? '' : (mime.contentType(fileOrExt) || '')

// getLocalFiles(join(__dirname, '../app'), { pattern:'**/*.*', ignore:'**/node_modules/**' }).then(([errors, data]) => {
// 	console.log(errors)
// 	console.log(data)
// })


//
// Gets a flat list of all the files under a folder.
// 
// @param  {String}			dir		
// @param  {Boolean}			includeContent			Default false.
// @param  {String|[String]}	ignore					e.g., Ignore the content under the node_modules folder: '**/node_modules/**'
// 
// @return {String}			data[].file				Absolute file path.	
// @return {String}			data[].dir				Absolute folder path.	
// @return {String}			data[].path				Relative file path (relative to the folder).	
// @return {String}			data[].key				S3 key
// @return {String}			data[].hash				MD5 file hash	
// @return {String}			data[].contentType		e.g., 'application/javascript; charset=utf-8' or 'image/png'
// @return {Number}			data[].contentLength	File's size in bytes.	
// @return {Buffer}			data[].content			Only set if 'includeContent' is set to true.
//
const getFiles = ({ dir, includeContent, ignore }) => catchErrors((async () => {
	const errMsg = `Fail to get all files in folder '${dir}'`

	const [listErrors, files] = await getLocalFiles(dir, { pattern:'**/*.*', ignore })
	if (listErrors)
		throw wrapErrors(errMsg, listErrors)	

	if (!files || !files.length)
		return []

	const allErrors = []
	const filesData = await throttle(files.map(file => async () => {
		const [readErrors, buf] = await catchErrors(readFile(file))
		if (readErrors) {
			allErrors.push(...readErrors)
			return null
		} else {
			const contentLength = buf ? buf.length : 0
			const content = contentLength ? buf.toString() : ''
			const hash = createHash('md5').update(content).digest('hex')
			const path = file.replace(dir,'')

			const output = {
				file,
				dir,
				path,
				key: path.split(sep).filter(x => x).join(posix.sep),
				hash,
				contentType: getContentType(extname(file)),
				contentLength
			}

			if (includeContent)
				output.content = buf

			return output
		}
	}),10)

	if (allErrors.length)
		throw wrapErrors(errMsg, allErrors)	

	return filesData
})())

/**
 * Removes multiple keys from a bucket (max. 1000).
 * 
 * @param  {String}				bucket		Bucket's name
 * @param  {[String]|[Object]}	keys		e.g., ['key01', 'key02', { name:'key03', version:'123' }]
 * 
 * @return {Void}
 */
const removeObjects = ({ bucket, keys }) => catchErrors((async () => {
	const errMsg = `Failed to remove objects from S3 bucket '${deleteObjects}'`

	if (!bucket)
		throw wrapErrors(errMsg, [new Error('Missing required \'bucket\' argument')])

	if (!keys || !keys.length)
		return

	if (keys.length > 1000)
		throw wrapErrors(errMsg, [new Error(`'S3.deleteObjects' only support a maximum of 1000 keys to be deleted at once. Current request attempts to delete ${keys.length} keys.`)])

	const [errors] = await catchErrors(deleteObjects({
		Bucket: bucket,
		Delete: {
			Objects: keys.map(key => {
				if (typeof(key) == 'string')
					return { Key:key }
				else {
					const { name, version } = key || {}
					if (name) {
						const o = { Key:key }
						if (version)
							o.VersionId = version
						return o
					} else
						return null
				}
			}).filter(x => x)
		}
	}))

	if (errors)
		throw wrapErrors(errMsg, errors)

	return
})())

const bucketExists = async bucket => {
	const [headErrors] = await headBucket({ Bucket:bucket })
	return !headErrors
}

/**
 * Parses the website into the correct AWS format. Doc: https://www.pulumi.com/docs/reference/pkg/aws/s3/bucket/#bucketwebsite
 * 
 * @param  {String}   website.indexDocument						e.g., 'index.html'	
 * @param  {String}   website.errorDocument						e.g., 'error.html'
 * @param  {String}   website.redirectAllRequestsTo		
 * @param  {Object}   website.routingRules
 * @param  {Object}   website.cors	
 * @param  {Object}   website.content	
 * @param  {Object}   website.cloudfront	
 * 		
 * @return {String}   output.website.indexDocument
 * @return {String}   output.website.errorDocument
 * @param  {String}   output.website.redirectAllRequestsTo		
 * @return {Object}   output.website.routingRules		
 * @return {[Object]} output.corsRules			
 * @return {Object}   output.content	
 */
const getWebsiteProps = website => {
	if (!website)
		return {}

	if (typeof(website) == 'boolean')
		return { website:{} }

	const { cors, content, cloudfront, ...web } = website

	if (web.routingRules && typeof(web.routingRules) != 'string')
		web.routingRules = JSON.stringify(web.routingRules)

	return {
		website: web,
		corsRules: cors,
		content,
		cloudfront
	}
}


module.exports = {
	getWebsiteProps,
	uploadFiles,
	syncFiles
}


