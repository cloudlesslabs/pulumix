const { resolve, unwrap, getProject, getStack } = require('./utils')

module.exports = {
	aws: require('./aws'),
	automationApi: require('./automationApi'),
	resolve, 
	unwrap,
	getProject, 
	getStack
}