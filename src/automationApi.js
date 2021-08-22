// Version: 0.0.1

const { LocalWorkspace } = require('@pulumi/pulumi/automation')
const util = require('util')
const cp = require('child_process')
const { error:{ catchErrors, wrapErrors }, promise:{ delay } } = require('puffy')

const exec = util.promisify(cp.exec)

const login = options => catchErrors((async () => {
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
 * @param  {String}		stackName		
 * @param  {String}		projectName
 * @param  {Promise}	program
 * @param  {Promise}	provider.name							e.g., 'aws', 'gcp'
 * @param  {Promise}	provider.version						e.g., '4.17.0'
 * @param  {Object}		config									(1). This is the config object that would usually be under the `Pulumi.<STACK>.yaml` file.	
 * @param  {Function}	onOutput								(Optional)
 * 
 * @return {[String]}	result.info								stdout from the `pulumi up` command.
 * @return {Object}		result.outputs
 * @return {String}		result.stack.name
 * @return {String}		result.stack.workspace.pulumiHome
 * @return {Promise}	result.stack.workspace.program
 * @return {String}		result.stack.workspace.secretsProvider
 * @return {String}		result.stack.workspace.workDir			The absolute path where the checkpoint files are stored.
 * @return {Object}		result.stack.workspace.envVars
 *
 * (1) Example: { 'aws:region': 'ap-southeast-2', 'aws:allowedAccountIds':[196799624576] }
 */
const pulumiUp = ({ stackName, projectName, program, provider, config, onOutput:_onOutput }) => catchErrors((async () => {
	const errMsg = `Command 'pulumi up --stack ${stackName}' failed.`

	if (!stackName)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'stackName\'')])
	if (!projectName)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'projectName\'')])
	if (!program)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'program\'')])
	if (!provider)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'provider\'')])
	if (!provider.name)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'provider.name\'')])
	if (!config)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'config\'')])
	if (provider.name == 'aws' && !config['aws:region'])
		throw wrapErrors(errMsg, [new Error('Missing required argument. \'config["aws:region"]\' is required and the provider is \'aws\'')])
	if (provider.name == 'gcp' && !config['gcp:region'])
		throw wrapErrors(errMsg, [new Error('Missing required argument. \'config["gcp:region"]\' is required and the provider is \'gcp\'')])

	const [loginErrors] = await login()
	if (loginErrors)
		throw wrapErrors(errMsg, loginErrors)

	const stackArgs = { stackName, projectName, program }
	const stackConfig = !config ? undefined : { pulumiHome: process.env.PULUMI_HOME, stackSettings: { [stackName]: { config } } }
	const [stackErrors, stack] = await catchErrors(LocalWorkspace.createOrSelectStack(stackArgs, stackConfig))
	if (stackErrors)
		throw wrapErrors(errMsg, [new Error(`Failed to create stack '${stackName}' for project '${projectName}'`), ...stackErrors])

	const [installErrors] = await catchErrors(stack.workspace.installPlugin(provider.name, `v${provider.version||'4.0.0'}`))
	if (installErrors)
		throw wrapErrors(errMsg, [new Error(`Failed to install AWS plugin for stack '${stackName}' for project '${projectName}'`), ...installErrors])

	// console.log('INSTALLED AWS')
	// console.log(data)
	// await stack.setConfig('aws:region', { value: 'ap-southeast-2' })
	// await stack.refresh()

	const info = []
	const onOutput = !_onOutput ? m => info.push(m) : m => {
		_onOutput(m)
		info.push(m)
	}

	const [upErrors, upRes] = await catchErrors(stack.up({ onOutput }))
	if (upErrors) {
		const rootError = new Error(errMsg)
		const currentError = new Error(`Failed to execute 'pulumi up' for stack '${stackName}' for project '${projectName}'`)
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

module.exports = {
	up: pulumiUp,
	login
}


