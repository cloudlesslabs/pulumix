/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

/*
 APIs:
 	- up
 	- login
 	- getLocalFiles
 	- cleanLocalFiles
 */

import util from 'util'
import { join } from 'path'
import cp from 'child_process'
import { LocalWorkspace } from '@pulumi/pulumi/automation/index.js'
import { catchErrors, wrapErrors } from 'puffy-core/error'
import { delay } from 'puffy-core/time'
import { fileList, fileRemove } from './utils.js'

const exec = util.promisify(cp.exec)

export const login = options => catchErrors((async () => {
	const { homeDir } = options || {}
	const loginCmd = `pulumi login file://${homeDir||'/tmp/'}`
	const errMsg = `Command '${loginCmd}' failed.`
	
	const user = await Promise.race([
		exec('pulumi whoami').then(resp => resp.stdout||'').catch(() => null), 
		delay(2000)
	])
	const needToLogin = !user || user.indexOf('sbx_user') < 0 // Lambda uses sandboxed users called 'sbx_userxxxx'
	if (needToLogin) {
		const [loginErrors] = await Promise.race([
			exec(loginCmd).then(data => ([null,data])).catch(err => ([[err], null])), 
			delay(5000).then(() => ([[new Error(`Command '${loginCmd}' timeout`)],null]))
		])
		
		if (loginErrors)
			throw wrapErrors(errMsg, loginErrors)	
	}
})())


/**
 * Executes `pulumi up`
 * 
 * @param  {String}		stack.name
 * @param  {Object}		stack.config							(1). This is the config object that would usually be under the `Pulumi.<STACK>.yaml` file.	
 * @param  {String}		project
 * @param  {Promise}	program
 * @param  {Promise}	provider.name							e.g., 'aws', 'gcp'
 * @param  {Promise}	provider.version						e.g., '4.17.0'								
 * @param  {Function}	onOutput								(Optional)
 * 
 * @return {[String]}	result.info								stdout from the `pulumi up` command.
 * @return {Object}		result.outputs							Ref: https://github.com/cloudlesslabs/pulumi-recipes#using-the-automation-api-in-your-code
 * @return {String}		result.stack.name
 * @return {String}		result.stack.workspace.pulumiHome
 * @return {Promise}	result.stack.workspace.program
 * @return {String}		result.stack.workspace.secretsProvider
 * @return {String}		result.stack.workspace.workDir			The absolute path where the checkpoint files are stored.
 * @return {Object}		result.stack.workspace.envVars
 *
 * (1) Example: { 'aws:region': 'ap-southeast-2', 'aws:allowedAccountIds':[196799624576] }
 */
export const up = ({ stack:_stack, project, program, provider, onOutput:_onOutput }) => catchErrors((async () => {
	const errMsg = `Command 'pulumi up --stack ${(_stack||{}).name}' failed.`

	if (!_stack)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'stack\'')])
	if (!_stack.name)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'stack.name\'')])
	if (!_stack.config)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'stack.config\'')])
	if (!project)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'project\'')])
	if (!program)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'program\'')])
	if (!provider)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'provider\'')])
	if (!provider.name)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'provider.name\'')])
	if (provider.name == 'aws' && !_stack.config['aws:region'])
		throw wrapErrors(errMsg, [new Error('Missing required argument. \'stack.config["aws:region"]\' is required and the provider is \'aws\'')])
	if (provider.name == 'gcp' && !_stack.config['gcp:region'])
		throw wrapErrors(errMsg, [new Error('Missing required argument. \'stack.config["gcp:region"]\' is required and the provider is \'gcp\'')])

	const [loginErrors] = await login()
	if (loginErrors)
		throw wrapErrors(errMsg, loginErrors)

	const stackName = _stack.name
	const stackArgs = { stackName, projectName: project, program }
	const stackConfig = { 
		pulumiHome: process.env.PULUMI_HOME, 
		stackSettings: { 
			[stackName]: { 
				config:_stack.config 
			} 
		} 		
	}
	const [stackErrors, stack] = await catchErrors(LocalWorkspace.createOrSelectStack(stackArgs, stackConfig))
	if (stackErrors)
		throw wrapErrors(errMsg, [new Error(`Failed to create stack '${stackName}' for project '${project}'`), ...stackErrors])

	const [installErrors] = await catchErrors(stack.workspace.installPlugin(provider.name, `v${provider.version||'4.0.0'}`))
	if (installErrors)
		throw wrapErrors(errMsg, [new Error(`Failed to install AWS plugin for stack '${stackName}' for project '${project}'`), ...installErrors])

	const info = []
	const onOutput = !_onOutput ? m => info.push(m) : m => {
		_onOutput(m)
		info.push(m)
	}

	const [upErrors, upRes] = await catchErrors(stack.up({ onOutput }))
	if (upErrors) {
		const rootError = new Error(errMsg)
		const currentError = new Error(`Failed to execute 'pulumi up' for stack '${stackName}' for project '${project}'`)
		const localErrors = [currentError, ...upErrors]
		const allErrors = [rootError, ...localErrors]
		// Log all the errors now, because as of August 2021, a failure here makes the entire program crash.
		const errorText = allErrors.map(e => e.stack).join('\n')
		console.error(errorText)
		throw wrapErrors(errMsg, localErrors)
	}
	
	return {
		stack,
		info,
		outputs: upRes.outputs
	}
})())

/**
 * Compiles a list of predicates into a single function that can decide whether or not a file is valid or not.
 * 
 * @param  {String|RegExp|[]}	filter	e.g., 'project-name', ['project-name', 'automation-']
 * 
 * @return {Function}			fn
 */
const getFilterFn = filter => {
	if (!filter)
		return () => true

	const aFilter = Array.isArray(filter) ? filter : [filter]
	const fns = aFilter.reduce((acc,f) => {
		const fn = f instanceof RegExp 
			? file => file && f.test(file) 
			: typeof(f) == 'string' 
				? file => file && file.indexOf(f) >= 0
				: null
		if (fn)
			acc.push(fn)
		return acc
	}, [])

	if (fns.length)
		return file => fns.some(fn => fn(file))
	else
		return () => true
}

/**
 * Removes all the non-critical files under the pulumi home folder.
 * 
 * @param  {String}			pulumiHome
 * @param  {String|RegExp}	options.filter		e.g., 'project-name', ['project-name', 'automation-']
 * 
 * @return {[String]}		filesDeleted		
 */
export const cleanLocalFiles = (pulumiHome, options) => catchErrors((async() => {
	const errMsg = 'Failed to clean Pulumi\'s local files'
	const [pulumiFilesErrors, pulumiFiles] = await getLocalFiles(pulumiHome, { ignore: ['**/plugins/**', 'credentials.json'] })
	if (pulumiFilesErrors)
		throw wrapErrors(errMsg, pulumiFilesErrors)

	const { filter } = options || {}
	const filterfn = getFilterFn(filter)
	
	const targetList = pulumiFiles.filter(f => filterfn(f))
	const count = targetList.length

	// Deletes those files
	for (let i=0;i<count;i++) {
		const file = targetList[i]
		const [deleteErrors] = await fileRemove(file)
		if (deleteErrors)
			throw wrapErrors(`Failed to delete file '${file}'`, deleteErrors)
	}

	return targetList
})())

/**
 * Gets all the files under the pulumi home folder.
 * 
 * @param  {String}   pulumiHome
 * @param  {String}   options.ignore		Glob pattern to ignore file (e.g., ['credentials.json'])
 * 
 * @return {[String]} pulumiFiles
 */
export const getLocalFiles = (pulumiHome, options) => catchErrors((async() => {
	const errMsg = 'Failed to get the Pulumi local files'
	if (!pulumiHome)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'pulumiHome\'.')])

	const [filesErrors, pulumiFiles] = await fileList(pulumiHome, { ...(options||{}), pattern:'**/*.*' })
	if (filesErrors)
		throw wrapErrors(errMsg, filesErrors)

	const checkpointsFolder = join(pulumiHome,'.pulumi')
	const [checkpointErrors, checkpointFiles] = await fileList(checkpointsFolder, { pattern:'**/*.*' })
	if (checkpointErrors)
		throw wrapErrors(errMsg, checkpointErrors)

	return [...(pulumiFiles||[]), ...(checkpointFiles||[])]
})())



