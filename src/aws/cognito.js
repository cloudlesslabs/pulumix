/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const { keepResourcesOnly } = require('../utils')

const REGION = aws.config.region
const GRANT_TYPES = ['code', 'implicit', 'client_credentials', 'password', 'refresh_token']
const DEFAULT_GRANT_TYPES = ['password', 'refresh_token']

class UserPool extends aws.cognito.UserPool {
	/**
	 * Creates a Cognito User Pool. Pulumi user pool doc: https://www.pulumi.com/docs/reference/pkg/aws/cognito/userpool/
	 * Resources:
	 * 	1. User Pool
	 * 	2. (Optional) User pool domain if 'domain.name' is defined.
	 *
	 * IMPORTANT:
	 * 	- By default:
	 * 		- The signup requires a unique immutable username which can be anything. To add support for mutable
	 * 		  'email', 'phone' or 'preferred_username' username, use the 'username.aliases' property. Use the 
	 * 		  'username.use' property to add immutable support to use 'email' or 'phone' as username.
	 * 		- The email confirmation method uses a link. To change this to use a code, use the 'email.verification.confirmType' property.
	 * 	
	 * @param  {String}					name	
	 * @param  {Object}					domain									Default null, i.e., no domain setup.
	 * @param  {String}						.name								(1) e.g., 'my-project' or 'my-project.example.com'
	 * @param  {String}						.certArn							AWS Certificate Manager ARN for 'example.com'
	 * @param  {Object}					username								Default is null, i.e., a unique immutable username must be set.
	 * @param  {[String]}					.aliases							Allowed: 'email', 'phone', 'preferred_username'. When set, those mutable values can be used as username on top of the unique immutable username.
	 * @param  {[String]}					.use								Allowed values: 'email', 'phone'. When set, only those immutable values can be used as username.
	 * @param  {Boolean}					.caseSensitive						Default true.
	 * @param  {Object}					attributes								(4) Default null. 
	 * @param  {Object}						.[name]
	 * @param  {String}							.type							Allowed values: 'string', 'number', 'boolean', 'date'
	 * @param  {Boolean}						.required						Default false.
	 * @param  {Boolean}						.mutable						Default true.
	 * @param  {[Number]}						.range							Default null. Min, max constraints on string or number.
	 * @param  {[String]}				autoVerifiedAttributes					Default null. Supported values: 'email', 'phone'
	 * @param  {[String]}				recoveryMechanisms						Default null. Supported values: 'email', 'phone'
	 * @param  {Object}					email									Default is AWS SES is not configured and Cognito send emails (not recommended).
	 * @param  {Object}						.ses								Default null (i.e., Cognito sends email). Not recommended to leave it null as there are daily limits with Cognito.
	 * @param  {String}							.from 							From email
	 * @param  {String}							.replyTo 						Reply to email
	 * @param  {String}							.configurationSet 				Configuration set.
	 * @param  {String}							.arn 							SES ARN.
	 * @param  {Object}						.verification
	 * @param  {String}							.confirmType					Valid values: 'code', 'link' (default)
	 * @param  {String}							.subject
	 * @param  {String}							.message						(3) WARNING: The text must contain certain characters based on the 'confirmType' value.
	 * @param  {Object}					sms	
	 * @param  {Object}						.verification						 
	 * @param  {String}  						.message
	 * @param  {Object}						.mfa						 
	 * @param  {String}  						.message 	
	 * @param  {Object}					hooks									 										
	 * @param  {Object}  					.preAuth							(2) Lambda object.
	 * @param  {Object}  					.postAuth							(2) Lambda object.
	 * @param  {Object}  					.postConfirmation					(2) Lambda object.
	 * @param  {Object}  					.preSignUp							(2) Lambda object.
	 * @param  {Object}  					.preTokenGeneration					(2) Lambda object.
	 * @param  {Object}  					.userMigration						(2) Lambda object. 
	 * @param  {Object}  					.verifyAuthChallengeResponse		(2) Lambda object.
	 * @param  {Object} 				mfa										Default null (i.e., MFA off)
	 * @param  {[String]} 					.methods							Default null (i.e., MFA off). E.g., ['sms', 'totp'] Valid values: 'email', 'sms', 'totp'
	 * @param  {Boolean} 					.optional							Default false. True means only for individual users who have MFA enabled.
	 * @param  {Object}					passwordPolicy							Default 
	 * @param  {Number} 					.minimumLength			
	 * @param  {Boolean} 					.requireLowercase
	 * @param  {Boolean} 					.requireNumbers
	 * @param  {Boolean} 					.requireSymbols
	 * @param  {Boolean} 					.requireUppercase
	 * @param  {Number} 					.temporaryPasswordValidityDays
	 * @param  {[Object]}				groups[]
	 * @param  {String}						.name
	 * @param  {String}						.description
	 * @param  {String}						.roleArn
	 * @param  {Object}					defaultApp								Optional. App configuration.
	 * @param  {String}						.name								Optional. Default `default-app-${name}` where 'name' is the user pool's name.
	 * @param  {Object}  					.oauth								Default is only 'refresh_token' and 'password'('srp' mode only) grant type flows are enabled.
	 * @param  {Boolean}  						.disable						Default false.
	 * @param  {[String]} 						.grantTypes						(1) Default [password', 'refresh_token']. Allowed values: 'code', 'implicit', 'client_credentials', 'password', 'refresh_token'	
	 * @param  {[String]} 						.scopes							(2) e.g., 'phone', 'email', 'openid', and 'profile'
	 * @param  {Boolean}  						.secret					   		Default false. When set to true, a secret is generated. Use this when for server-side authentication. WARNING: True forces the secret to be passed during the authorizaton_code flow, which is not suitable for a SPA or PWA.
	 * @param  {[String]} 						.passwordModes					Allowed values: 'srp'(default), 'standard', 'admin'
	 * @param  {Object} 					.tokenDuration						Default is 1 hour for both id/access token and 30 days for refresh token.
	 * @param  {Number}							.idToken.value					Default 1.
	 * @param  {Number}							.idToken.unit					Default 'hours'. Allowed values: 'seconds', 'minutes', 'hours' (default), 'days'
	 * @param  {Number}							.accessToken.value				Default 1.
	 * @param  {Number}							.accessToken.unit				Default 'hours'. Allowed values: 'seconds', 'minutes', 'hours' (default), 'days'
	 * @param  {Number}							.refreshToken.value				Default 30.
	 * @param  {Number}							.refreshToken.unit				Default 'days'. Allowed values: 'seconds', 'minutes', 'hours', 'days' (default)			
	 * @param  {Object}						.allowedUrls							Default is no allowed URLs configured, meaning 'code' and 'implicit' cannot work.
	 * @param  {[String|Object]} 				.callbacks						(3) e.g., ['https://sample.co', { url:'https://sample.com', default:true }]
	 * @param  {[String]} 						.logouts
	 * @param  {[String]} 					.idps								Allowed values: 'facebook', 'google', 'amazon', 'apple', 'oidc', 'saml'
	 * @param  {Object}					tags
	 * @param  {Output<Resource>}		parent
	 * @param  {Output<[Resource]>}		dependsOn
	 * @param  {Boolean}				protect									Default false.
	 * 			
	 * @return {Output<UserPool>}		pool
	 * @return {Output<String>} 			.id
	 * @return {Output<String>} 			.arn
	 * @return {Output<Object>} 			...
	 * @return {Output<UserPoolDomain>}		.domain
	 * @return {Output<String>}					.awsAccountId
	 * @return {Output<String>}					.cloudfrontDistributionArn
	 * @return {Output<String>}					.domain
	 * @return {String}							.endpoint
	 * @return {Output<App>}				.defaultApp
	 * @return {[Output<UserGroup>]}		.userGroups
	 * @return {[Output<Permission>]}		.permissions
	 *
	 * (1)	If 'domain.certArn' is not provided, then 'domain.name' is used as prefix with the 'amazoncognito.com' domain 
	 * 		(e.g., 'my-project.auth.ap-southeast-2.amazoncognito.com') 
	 *
	 * (2)	A Lambda object has 2 required properties:
	 * 			- {String} name
	 * 		 	- {String} arn
	 *
	 * (3)	If email.verification.confirmType is 'code', than the message must contain '{####}'. If it is 'email', the 
	 * 		message must contain '{##Your custom hyperlink message here##}'
	 *
	 * (4)	There are 2 types of attributes:
	 * 			- Standard (i.e., used by the OIDC): e.g., given_name, family_name, address, ... (full list at https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html).
	 * 			- Custom: Non-standard attributes: e.g., hello_world. WARNING: Non-standard cannot be set to required.
	 */
	constructor(input) {
		let { 
			name,
			domain,
			recoveryMechanisms, 
			username, 
			attributes,
			autoVerifiedAttributes:_autoVer, 
			email, 
			hooks, 
			passwordPolicy, 
			groups,
			defaultApp,
			tags,
			protect,
			parent,
			dependsOn
		} = input || {}

		if (!name)
			throw new Error('Missing required \'name\' argument')

		const emailMustBeVerified = _shouldEmailBeVerified(input||{})
		if (emailMustBeVerified) {
			if (!hooks || !hooks.preSignUp) {
				if (!_autoVer || !_autoVer.some(x => x == 'email'))
					throw new Error('The email should be verified but no pre-signup lambda or auto verification (\'autoVerifiedAttributes\') has been setup.')
			}
		}

		tags = tags || {}
		const domainOn = domain && domain.name
		const domainName = domainOn ? domain.name.replace(/\/*$/,'') : null
		const options = { protect, parent, dependsOn:keepResourcesOnly(dependsOn) }

		// User pool doc: https://www.pulumi.com/docs/reference/pkg/aws/cognito/userpool/
		super(name, {
			name,
			accountRecoverySetting: _getAccountRecoverySetting(recoveryMechanisms),
			..._getUsernameConfig(username),
			autoVerifiedAttributes: _getAttributes(_autoVer),
			emailConfiguration: _getSESconfig(email),
			lambdaConfig: _getLambdaConfig(hooks),
			..._getMFAconfig(input||{}),
			passwordPolicy: _getPasswordPolicy(passwordPolicy),
			smsConfiguration: _getSmsConfiguration(input||{}),
			verificationMessageTemplate: _getVerificationMessageTemplate(input||{}),
			schemas: _getSchemas(attributes),
			tags: {
				...tags,
				Name: name
			}
		}, options)

		// ALLOWING USERPOOL TO INVOKE LAMBDA
		const permissions = _createHookPermissions(hooks, name, this.arn)

		// User pool domain doc: https://www.pulumi.com/docs/reference/pkg/aws/cognito/userpooldomain/
		const appDomain = !domainOn ? null : new aws.cognito.UserPoolDomain(`${name}-domain`, {
			domain: domainName,
			userPoolId: this.id,
			certificateArn: domain.certArn || undefined
		})

		if (domainOn)
			appDomain.endpoint = domain.certArn ? `https://${domainName}` : `https://${domainName}.auth.${REGION}.amazoncognito.com`

		// Creates User Groups. Doc: // Doc: https://www.pulumi.com/registry/packages/aws/api-docs/cognito/usergroup/
		let userGroups = []
		if (groups && groups.length) {
			userGroups = groups.map((group,idx) => {
				const t = typeof(group)
				const { name, description, roleArn } = t == 'string' ? { name:group } : t == 'object' ? group : {}
				if (!name)
					throw new Error(`Missing required 'groups[${idx}].name'.`)

				// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/cognito/usergroup/
				return new aws.cognito.UserGroup(name, {
					userPoolId: this.id,
					name,
					description,
					roleArn
				}, options)
			})
		}

		if (defaultApp) {
			const defaultAppConfig = { ...defaultApp }
			defaultAppConfig.userPool = {
				id: this.id,
				endpoint: domainOn ? appDomain.endpoint : pulumi.output(this.endpoint).apply(endpoint => `https://${endpoint}`)
			}
			if (!defaultAppConfig.name)
				defaultAppConfig.name = `app-${name}`
		
			defaultAppConfig.tags = { ...(defaultAppConfig.tags||{}), ...tags }
			defaultAppConfig.protect = protect

			this.defaultApp = new App(defaultAppConfig)
		} else
			this.defaultApp = null

		this.domain = appDomain
		this.userGroups = userGroups
		this.permissions = permissions

	}
}

class App extends aws.cognito.UserPoolClient {
	/**
	 * Creates a client App for a user pool. By default the 2 OAuth grant type flows(1) are enabled: 'password', 'refresh_token'.
	 * doc: https://www.pulumi.com/docs/reference/pkg/aws/cognito/userpoolclient/
	 *
	 * IMPORTANT:
	 * 	- By default:
	 * 		- The out-of-the-box AWS login page won't work because the 'code' grant type is not toggled. If you add the 'code' to the
	 * 		  'oauth.grantTypes' array, don't forget to also add at least one URL in the 'allowedUrls.callbacks' array.
	 * 		- The 'password' grant type is setup with the SRP protocol only (Secure Remote Password). To change this setup,
	 * 		  use the 'oauth.passwordModes' property.
	 *     	- The 'COGNITO' IdP is always on, because it does not make sense to use AWS Cognito without it.
	 *     	- The 
	 * 	- The 'client_credentials' grant type flow is not compatible with either the 'code' or 'implicit' grant type flow. 
	 * 	- To setup the 'code' or 'implicit' grant type, at least one callback URL must be set in the 'allowedUrls.callbacks' string array.
	 * 
	 * @param  {String}					name
	 * @param  {Object}					userPool								Required
	 * @param  {Output<String>}				.id									Required
	 * @param  {Output<String>}				.endpoint
	 * @param  {Object}  				oauth									Default is only 'refresh_token' and 'password'('srp' mode only) grant type flows are enabled.
	 * @param  {Boolean}  					.disable							Default false.
	 * @param  {[String]} 					.grantTypes							(1) Default [password', 'refresh_token']. Allowed values: 'code', 'implicit', 'client_credentials', 'password', 'refresh_token'	
	 * @param  {[String]} 					.scopes								(2) e.g., 'phone', 'email', 'openid', and 'profile'
	 * @param  {Boolean}  					.secret					    		Default false. When set to true, a secret is generated. Use this when for server-side authentication. WARNING: True forces the secret to be passed during the authorizaton_code flow, which is not suitable for a SPA or PWA.
	 * @param  {[String]} 					.passwordModes						Allowed values: 'srp'(default), 'standard', 'admin'
	 * @param  {Object} 				tokenDuration							Default is 1 hour for both id/access token and 30 days for refresh token.
	 * @param  {Number}						.idToken.value						Default 1.
	 * @param  {Number}						.idToken.unit						Default 'hours'. Allowed values: 'seconds', 'minutes', 'hours' (default), 'days'
	 * @param  {Number}						.accessToken.value					Default 1.
	 * @param  {Number}						.accessToken.unit					Default 'hours'. Allowed values: 'seconds', 'minutes', 'hours' (default), 'days'
	 * @param  {Number}						.refreshToken.value					Default 30.
	 * @param  {Number}						.refreshToken.unit					Default 'days'. Allowed values: 'seconds', 'minutes', 'hours', 'days' (default)			
	 * @param  {Object}					allowedUrls								Default is no allowed URLs configured, meaning 'code' and 'implicit' cannot work.
	 * @param  {[String|Object]} 			.callbacks							(3) e.g., ['https://sample.co', { url:'https://sample.com', default:true }]
	 * @param  {[String]} 					.logouts	
	 * @param  {[String]} 				idps									Allowed values: 'facebook', 'google', 'amazon', 'apple', 'oidc', 'saml'
	 * @param  {Boolean}				protect									Default false.
	 * @param  {Object}					tags
	 * 
	 * @return {Object}					app
	 * @return {Output<String>}				.id
	 * @return {Output<String>}				.name
	 * @return {Output<String>}				.arn
	 * @return {Output<String>}				.clientSecret
	 * @return {Output<Object>}				.hostedUI							URLs for the default Cognito hosted UI. Only defined if the 'code' flow is enabled and at least one 'callbackUrls' is defined.
	 * @return {Output<String>}					.loginUrl						
	 * @return {Output<String>}					.signupUrl
	 * @return {Output<String>}				.userPoolId
	 * @return {Output<String>}				.accessTokenValidity
	 * @return {Output<String>}				.allowedOauthFlows
	 * @return {Output<String>}				.allowedOauthFlowsUserPoolClient
	 * @return {Output<String>}				.allowedOauthScopes
	 * @return {Output<String>}				.analyticsConfiguration
	 * @return {Output<String>}				.callbackUrls
	 * @return {Output<String>}				.defaultRedirectUri
	 * @return {Output<String>}				.enableTokenRevocation
	 * @return {Output<String>}				.explicitAuthFlows
	 * @return {Output<String>}				.generateSecret
	 * @return {Output<String>}				.idTokenValidity
	 * @return {Output<String>}				.logoutUrls
	 * @return {Output<String>}				.preventUserExistenceErrors
	 * @return {Output<String>}				.readAttributes
	 * @return {Output<String>}				.refreshTokenValidity
	 * @return {Output<String>}				.supportedIdentityProviders
	 * @return {Output<String>}				.tokenValidityUnits
	 * @return {Output<String>}				.writeAttributes
	 *
	 * (1) OAuth 2.0 grant type flows:
	 * 		- code (official name is authorization_code)
	 * 		- implicit(deprecated in favor of the authorization code flow)
	 * 		- client_credentials
	 * 		- password
	 * 		- refresh_token
	 * 		
	 * 	   To restrict the grant type flows, explicitly set this array. Example: ['code', 'password']
	 *
	 * (2) Out-of-the-box scopes:
	 * 		- 'phone': When set, the client can request the 'phone' or 'phone_number_verified' claim IF the 'openid' scope is also request.
	 * 		- 'email': When set, the client can request the 'email' or 'email_verified' claim IF the 'openid' scope is also request.
	 * 		- 'profile': When set, the client can request any readable profile attributes IF the 'openid' scope is also request.
	 * 		- 'openid': When set, the client can request all user attributes in the ID token that are readable by the client. The ID token is not returned if the openid scope is not requested by the client.
	 * 		- 'aws.cognito.signin.user.admin': Only use this scope on apps that can perform Cognito admin ops.
	 * 		
	 * (3) If no item with the 'default' property is found, the first item is assumed to be the default one.
	 */
	constructor({ name, userPool, oauth, tokenDuration, allowedUrls, idps, protect, tags }) {
		tags = tags || {}
		const options = protect === undefined ? undefined : { protect }

		if (!name)
			throw new Error('Missing required \'name\' argument')
		if (!userPool)
			throw new Error('Missing required \'userPool\' argument')
		if (!userPool.id)
			throw new Error('Missing required \'userPool.id\' argument')

		if (oauth && oauth.grantTypes && oauth.grantTypes.length) {
			const clientCredsFlowOn = oauth.grantTypes.indexOf('client_credentials') >= 0
			const implicitFlowOn = oauth.grantTypes.indexOf('implicit') >= 0
			const codeFlowOn = oauth.grantTypes.indexOf('code') >= 0
			const noCallbackUrls = !allowedUrls || !allowedUrls.callbacks || !allowedUrls.callbacks.length
			const restrictiveFlowName = codeFlowOn ? 'code' : implicitFlowOn ? 'implicit' : null
			if (clientCredsFlowOn && restrictiveFlowName)
				throw new Error(`Incompatible OAuth flows. Cognito does not support setting both the '${restrictiveFlowName}' and 'client_credentials' grant type flows.`)
			if (noCallbackUrls && restrictiveFlowName)
				throw new Error(`Missing required argument. The '${restrictiveFlowName}' grant type flow requires at least one callback URL in the 'allowedUrls.callbacks' string array.`)
		}

		// User pool client doc: https://www.pulumi.com/docs/reference/pkg/aws/cognito/userpoolclient/
		super(name, {
			name,
			userPoolId: userPool.id,
			..._getOAuthConfig(oauth),
			..._getTokensConfig(tokenDuration),
			..._getUrlsConfig(allowedUrls),
			supportedIdentityProviders: _getSupportedIdentityProviders(idps),
			preventUserExistenceErrors: 'ENABLED',
			tags: {
				...tags,
				Name: name
			}
		}, options)

		const hostedUI = pulumi.all([userPool.endpoint, this.id, this.allowedOauthFlows, this.allowedOauthScopes, this.defaultRedirectUri]).apply(([endpoint, appId, allowedOauthFlows, allowedOauthScopes, defaultRedirectUri]) => {
			const authorizationCodeFlowOn = allowedOauthFlows 
				&& allowedOauthFlows.some 
				&& allowedOauthFlows.some(f => f == 'code')
				&& defaultRedirectUri

			if (authorizationCodeFlowOn) {
				const createUrl = type => `${endpoint || '<USERPOOL_ENDPOINT>'}/${type}?client_id=${appId}&response_type=code&scope=${allowedOauthScopes.join('+')}&redirect_uri=${encodeURIComponent(defaultRedirectUri)}`
				return {
					loginUrl: createUrl('login'),
					signupUrl: createUrl('signup')
				}
			} else
				return { loginUrl: null, signupUrl:null }
		})

		this.hostedUI = hostedUI
	}
}


/**
 * 
 * @param  {Object}		attributes								Default null
 * @param  {Object}			.[name]
 * @param  {String}				.type							Allowed values: 'string', 'number', 'boolean', 'date'
 * @param  {Boolean}			.required						Default false.
 * @param  {Boolean}			.mutable						Default true.
 * @param  {[Number]}			.range							Default null. Min, max constraints on string or number.
 * 
 * @return {[Object]}	schemas[]
 * @return {String}			.name
 * @return {String}			.attributeDataType
 * @return {Boolean}		.mutable
 * @return {Boolean}		.required
 * @return {Object}			.stringAttributeConstraints
 * @return {Number}				.minLength
 * @return {Number}				.maxLength
 * @return {Object}			.numberAttributeConstraints
 * @return {Number}				.minValue
 * @return {Number}				.maxValue
 */
const _getSchemas = attributes => {
	if (!attributes)
		return 
	const names = Object.keys(attributes)
	if (!names.length)
		return

	return names.map(name => {
		const { type, required, mutable, range } = attributes[name]
		if (!type)
			throw new Error(`Missing required 'type' property in attributes['${name}']`)

		const attributeDataType = type == 'string' ? 'String' : type == 'number' ? 'Number' : type == 'boolean' ? 'Boolean' : type == 'date' ? 'DateTime' : null
		if (!attributeDataType)
			throw new Error(`Type '${type}' is not supported. Supported typed: 'string', 'number', 'boolean', 'date'`)

		const schema = {
			name,
			attributeDataType,
			mutable: mutable === undefined || mutable === null || mutable === true,
			required: required === true
		}

		if (type == 'string')
			schema.stringAttributeConstraints = range ? { minLength:`${range[0]}`, maxLength:`${range[1]}` } : { minLength:'0', maxLength:'2048' }
		if (type == 'number')
			schema.numberAttributeConstraints = range ? { minValue:`${range[0]}`, maxValue:`${range[1]}` } : null

		return schema
	})
}

/**
 * @param  {Object}					username								Default is null, i.e., a unique immutable username must be set.
 * @param  {[String]}					.aliases							Allowed: 'email', 'phone', 'preferred_username'. When set, those mutable values can be used as username on top of the unique immutable username.
 * @param  {[String]}					.use								Allowed values: 'email', 'phone'. When set, only those immutable values can be used as username.
 * @param  {Object} 				mfa										Default null (i.e., MFA off)
 * @param  {[String]} 					.methods							Default null (i.e., MFA off). E.g., [sms', 'totp'] Valid values: 'email', 'sms', 'totp'
 * @param  {[String]}				recoveryMechanisms						Default ['email']. Supported values: 'email', 'phone'
 * 
 * @return {Boolean}
 */
const _shouldEmailBeVerified = ({ username, mfa, recoveryMechanisms }) => {
	if (username && ((username.aliases && username.aliases.some(x => x == 'email')) || (username.use && username.use.some(x => x == 'email'))))
		return true
	if (mfa && mfa.methods && mfa.methods.some(x => x == 'email'))
		return true
	if (recoveryMechanisms && recoveryMechanisms.some(x => x == 'email'))
		return true

	return false
}

const _getPasswordPolicy = passwordPolicy => {
	passwordPolicy = passwordPolicy || {}
	const policy = {
		minimumLength: 6,			
		requireLowercase: false,
		requireNumbers: false,
		requireSymbols: false,
		requireUppercase: false, 
		temporaryPasswordValidityDays: 7
	}

	if (passwordPolicy.minimumLength > 0)
		policy.minimumLength = passwordPolicy.minimumLength 
	if (passwordPolicy.temporaryPasswordValidityDays !== undefined)
		policy.temporaryPasswordValidityDays = passwordPolicy.temporaryPasswordValidityDays 
	if (passwordPolicy.requireLowercase === true || passwordPolicy.requireLowercase === false )
		policy.requireLowercase = passwordPolicy.requireLowercase 
	if (passwordPolicy.requireNumbers === true || passwordPolicy.requireNumbers === false )
		policy.requireNumbers = passwordPolicy.requireNumbers 
	if (passwordPolicy.requireSymbols === true || passwordPolicy.requireSymbols === false )
		policy.requireSymbols = passwordPolicy.requireSymbols 
	if (passwordPolicy.requireUppercase === true || passwordPolicy.requireUppercase === false )
		policy.requireUppercase = passwordPolicy.requireUppercase 

	return policy
}

/**
 * 
 * @param  {[String]} idps							Allowed values: 'facebook', 'google', 'amazon', 'apple', 'oidc', 'saml'
 * 
 * @return {[String]} supportedIdentityProviders	Valid values: 'Facebook', 'Google', 'LoginWithAmazon', 'SignInWithApple', 'OIDC', 'SAML', 'COGNITO'
 */
const _getSupportedIdentityProviders = idps => {
	const supportedIdentityProviders = ['COGNITO']
	if (!idps || !idps.length)
		return supportedIdentityProviders

	if (idps.some(i => i && i.toLowerCase().trim() == 'facebook'))
		supportedIdentityProviders.push('Facebook')
	if (idps.some(i => i && i.toLowerCase().trim() == 'google'))
		supportedIdentityProviders.push('Google')
	if (idps.some(i => i && i.toLowerCase().trim() == 'amazon'))
		supportedIdentityProviders.push('LoginWithAmazon')
	if (idps.some(i => i && i.toLowerCase().trim() == 'apple'))
		supportedIdentityProviders.push('SignInWithApple')
	if (idps.some(i => i && i.toLowerCase().trim() == 'oidc'))
		supportedIdentityProviders.push('OIDC')
	if (idps.some(i => i && i.toLowerCase().trim() == 'saml'))
		supportedIdentityProviders.push('SAML')

	if (supportedIdentityProviders.length)
		return supportedIdentityProviders
	else 
		return
}

/**
 * 
 * @param  {[String|Object]} 	allowedUrls.callbacks		(1) e.g., ['https://sample.co', { url:'https://sample.com', default:true }]
 * @param  {[String]} 			allowedUrls.logouts	
 * 
 * @return {String}   			config.defaultRedirectUri
 * @return {[String]} 			config.callbackUrls
 * @return {[String]} 			config.logoutUrls
 *
 * (1) If no item with the 'default' property is found, the first item is assumed to be the default one.
 */
const _getUrlsConfig = allowedUrls => {
	const { callbacks, logouts } = allowedUrls || {}
	const config = {}
	
	if (callbacks && callbacks.length) {
		config.callbackUrls = callbacks.filter(u => u).map(u => {
			if (typeof(u) == 'string')
				return u
			const { url, default:def } = u
			if (url) {
				if (def)
					config.defaultRedirectUri = url
				return url
			}
		})
		if (!config.defaultRedirectUri && config.callbackUrls[0])
			config.defaultRedirectUri = config.callbackUrls[0]
	}

	if (logouts && logouts.length)
		config.logoutUrls = logouts

	return config
}

/**
 * 
 * @param  {Number} tokenDuration.idToken.value				Default 1.
 * @param  {Number} tokenDuration.idToken.unit				Default 'hours'. Allowed values: 'seconds', 'minutes', 'hours' (default), 'days'
 * @param  {Number} tokenDuration.accessToken.value			Default 1.
 * @param  {Number} tokenDuration.accessToken.unit			Default 'hours'. Allowed values: 'seconds', 'minutes', 'hours' (default), 'days'
 * @param  {Number} tokenDuration.refreshToken.value		Default 30.
 * @param  {Number} tokenDuration.refreshToken.unit			Default 'days'. Allowed values: 'seconds', 'minutes', 'hours', 'days' (default)		
 * 
 * @return {Number} config.idTokenValidity					Default 1 hour
 * @return {Number} config.accessTokenValidity				Default 1 hour
 * @return {Number} config.refreshTokenValidity				Default 30 days
 * @return {Number} config.tokenValidityUnits.idToken		Default 'hours'
 * @return {Number} config.tokenValidityUnits.accessToken	Default 'hours'
 * @return {Number} config.tokenValidityUnits.refreshToken	Default 'days'
 */
const _getTokensConfig = tokenDuration => {
	let { idToken, accessToken, refreshToken } = tokenDuration || {}
	idToken = idToken || {}
	accessToken = accessToken || {}
	refreshToken = refreshToken || {}
	
	return {
		tokenValidityUnits: {
			idToken: idToken.unit || 'hours',
			accessToken: accessToken.unit || 'hours',
			refreshToken: refreshToken.unit || 'days'
		},
		idTokenValidity: idToken.value || _getDefaultHourDuration(idToken.unit || 'hours'),
		accessTokenValidity: accessToken.value || _getDefaultHourDuration(accessToken.unit || 'hours'),
		refreshTokenValidity: refreshToken.value || _getDefaultDayDuration(refreshToken.unit || 'days')
	}
}

const _getDefaultHourDuration = unit => unit == 'seconds' ? 3600 : unit == 'minutes' ? 60 : unit == 'hours' ? 1 : 1
const _getDefaultDayDuration = unit => unit == 'seconds' ? 2592000 : unit == 'minutes' ? 43200 : unit == 'hours' ? 720 : 30

/**
 * 
 * @param  {Boolean}  oauth.disable								Default false.
 * @param  {[String]} oauth.grantTypes							Default [password', 'refresh_token']. Allowed values: 'code', 'implicit', 'client_credentials', 'password', 'refresh_token'	
 * @param  {[String]} oauth.scopes								Valid values: 'phone', 'email', 'openid', and 'profile'
 * @param  {Boolean}  oauth.secret                              Default false. WARNING: True forces the secret to be passed during the authorizaton_code flow, which is not suitable for a SPA or PWA.
 * @param  {[String]} oauth.passwordModes						Allowed values: 'srp'(default), 'standard', 'admin'
 * 
 * @return {[String]} config.allowedOauthFlows					Allowed values: 'code', 'implicit', 'client_credentials'
 * @return {[String]} config.allowedOauthScopes					Valid values: 'phone', 'email', 'openid', and 'profile'
 * @return {[String]} config.explicitAuthFlows					(1) Depends on 'oauth.grantTypes' and 'oauth.passwordModes'
 * @return {Boolean}  config.generateSecret						Depends on 'oauth.secret'
 * @return {Boolean}  config.enableTokenRevocation				Always true except when 'oauth.grantTypes' exists and does not contain 'refresh_token'
 * @return {Boolean}  config.allowedOauthFlowsUserPoolClient	Depends on 'oauth.disable'	
 *
 * (1) Allowed values:
 * 		- ALLOW_ADMIN_USER_PASSWORD_AUTH
 * 		- ALLOW_CUSTOM_AUTH (i.e., Enable lambda trigger based custom authentication)
 * 		- ALLOW_USER_PASSWORD_AUTH (i.e., username and password are explicitly sent in the request. A salt is later used in the backend.)
 * 		- ALLOW_USER_SRP_AUTH (i.e., only the username is explicitly sent in the request. The password was used in the client to create a signature that is sent to the backend.)
 * 		- ALLOW_REFRESH_TOKEN_AUTH
 * 		- ADMIN_NO_SRP_AUTH (deprecated)
 * 		- CUSTOM_AUTH_FLOW_ONLY (deprecated)
 * 		- USER_PASSWORD_AUTH (deprecated)
 * 		
 *     Values without the 'ALLOW_' prefix are deprecated. Use the following replacements:
 * 		- ADMIN_NO_SRP_AUTH 	-> ALLOW_ADMIN_USER_PASSWORD_AUTH (the password is sent to Cognito in the request for admins instead of using SRP).
 * 		- CUSTOM_AUTH_FLOW_ONLY -> ALLOW_CUSTOM_AUTH
 * 		- USER_PASSWORD_AUTH	-> ALLOW_USER_PASSWORD_AUTH
 */
const _getOAuthConfig = oauth => {
	const config = {
		enableTokenRevocation: true,
		generateSecret: false
	}

	const disable = oauth && oauth.disable === true
	const grantTypes = !oauth || !oauth.grantTypes || !oauth.grantTypes.length
		? DEFAULT_GRANT_TYPES
		: oauth.grantTypes.filter(x => GRANT_TYPES.some(y => x == y))

	if (!disable) {
		if (grantTypes && grantTypes.length) { // means OAuth is enabled
			config.allowedOauthFlows = []
			config.explicitAuthFlows = ['ALLOW_CUSTOM_AUTH']
			config.allowedOauthFlowsUserPoolClient = true

			if (grantTypes.indexOf('code') >= 0)
				config.allowedOauthFlows.push('code')
			if (grantTypes.indexOf('implicit') >= 0)
				config.allowedOauthFlows.push('implicit')
			if (grantTypes.indexOf('client_credentials') >= 0)
				config.allowedOauthFlows.push('client_credentials')
			if (grantTypes.indexOf('password') >= 0) {
				const passwordModes = (oauth||{}).passwordModes||[]
				const srpOn = !passwordModes.length || passwordModes.indexOf('srp') >= 0
				const allowAdminToUseNonSrpPassword = passwordModes.indexOf('admin') >= 0
				const allowNonSrpPassword = passwordModes.indexOf('standard') >= 0
				if (srpOn)
					config.explicitAuthFlows.push('ALLOW_USER_SRP_AUTH')
				if (allowAdminToUseNonSrpPassword)
					config.explicitAuthFlows.push('ALLOW_ADMIN_USER_PASSWORD_AUTH')
				if (allowNonSrpPassword)
					config.explicitAuthFlows.push('ALLOW_USER_PASSWORD_AUTH')
			}
			if (grantTypes.indexOf('refresh_token') < 0)
				config.enableTokenRevocation = false
			else
				config.explicitAuthFlows.push('ALLOW_REFRESH_TOKEN_AUTH')
		}

		if (oauth && oauth.scopes && oauth.scopes.length)
			config.allowedOauthScopes = oauth.scopes
		else
			throw new Error('Missing required argument. When OAuth 2.0 is enabled (\'oauth.grantTypes\' is set), \'oauth.scopes\' is required.')
	} else
		config.allowedOauthFlowsUserPoolClient = false

	if (oauth && oauth.secret === true)
		config.generateSecret = true

	return config
}

/**
 * 

 * @param  {[String]} 	mfa.methods											Default null (i.e., MFA off). E.g., [sms', 'totp'] Valid values: 'email', 'sms', 'totp'
 * @param  {Boolean} 	mfa.optional										Default false. True means only for individual users who have MFA enabled.					
 * @param  {String} 	sms.mfa.message
 * 
 * @return {String}		mfaConfig.mfaConfiguration							Value is one of te following: 'OFF', 'ON', 'OPTIONAL'
 * @return {String}		mfaConfig.smsAuthenticationMessage
 * @return {Boolean}	mfaConfig.softwareTokenMfaConfiguration.enabled
 */
const _getMFAconfig = ({ mfa, sms }) => {
	if (!mfa || !mfa.methods || !mfa.methods.some(m => m == 'email' || m == 'sms' || m == 'totp'))
		return { mfaConfiguration:'OFF' }

	const smsMFA = mfa.methods.some(m => m == 'sms')
	const totpMFA = mfa.methods.some(m => m == 'totp')

	if (smsMFA && (!sms || !sms.mfa || !sms.mfa.message))
		throw new Error('Missing required \'sms.mfa.message\'. This property is required when the \'mfa.methods\' contains \'sms\'.')

	const mfaConfig = { 
		mfaConfiguration:mfa.optional ? 'OPTIONAL' : 'ON' 
	}

	if (totpMFA)
		mfaConfig.softwareTokenMfaConfiguration = { enabled:true }
	if (smsMFA)
		mfaConfig.smsAuthenticationMessage = sms.mfa.message

	return mfaConfig
}

/**
 * Gets the 'smsConfiguration' and validate.
 * 
 * @param  {String}		sms.externalId			
 * @param  {String}		sms.snsArn						
 * @param  {[String]}	mfa.methods			
 * @param  {[String]}	recoveryMechanisms
 * 
 * @return {String}		smsConfiguration.externalId		
 * @return {String}		smsConfiguration.snsCallerArn		
 */
const _getSmsConfiguration = ({ sms, mfa, recoveryMechanisms }) => {
	if (!sms)
		return

	const recoverViaSms = recoveryMechanisms && recoveryMechanisms.some(x => x == 'phone')
	const mfaViaSms = mfa && mfa.methods.some(m => m == 'sms')

	const { externalId, snsArn:snsCallerArn } = sms
	if (recoverViaSms||mfaViaSms) {
		const text = recoverViaSms ? '\'recoveryMechanisms\' contains \'sms\'' : '\'mfa.methods\' contains \'sms\''
		if (!externalId)
			throw new Error(`Missing 'sms.externalId'. This argument is required when ${text}.`)
		if (!snsCallerArn)
			throw new Error(`Missing 'sms.snsArn'. This argument is required when ${text}.`)
	}

	if (externalId && !snsCallerArn)
		throw new Error('\'sms.snsArn\' is required when \'sms.externalId\' is specified.')
	if (!externalId && snsCallerArn)
		throw new Error('\'sms.externalId\' is required when \'sms.snsArn\' is specified.')

	return externalId && snsCallerArn ? { externalId, snsCallerArn } : undefined
}

/**
 * 
 * @param  {Object}	input
 * @param  {Object}		.email
 * @param  {Object}			.verification
 * @param  {String}				.confirmType		Valid values: 'code', 'link' (default)
 * @param  {String}				.subject
 * @param  {String}				.message			(1) WARNING: The text must contain certain characters based on the 'confirmType' value.
 * @param  {Object}		.sms
 * @param  {Object}			.verification
 * @param  {String}				.message
 * 											
 * @return {object}	verificationMessageTemplate
 * @return {String}  	.defaultEmailOption			Allowed values: 'CONFIRM_WITH_CODE', 'CONFIRM_WITH_LINK'
 * @return {String}  	.emailMessage
 * @return {String}  	.emailMessageByLink
 * @return {String}  	.emailSubject
 * @return {String}  	.emailSubjectByLink
 * @return {String}  	.smsMessage
 *
 * (1)	If email.verification.confirmType is 'code', than the message must contain '{####}'. If it is 'email', the 
 * 		message must contain '{##Your custom hyperlink message here##}'
 * 
 */
const _getVerificationMessageTemplate = ({ email, sms }) => {
	const { message, subject, confirmType } = (email || {}).verification||{}
	const emailVerificationOn = message && subject
	const smsVerificationOn = sms && sms.verification && sms.verification.message
	const emailCodeConfirm = confirmType === 'code'
	const verificationMessageTemplate = {
		defaultEmailOption: emailCodeConfirm ? 'CONFIRM_WITH_CODE' : 'CONFIRM_WITH_LINK'
	}

	if (!emailVerificationOn && !smsVerificationOn)
		return verificationMessageTemplate

	if (emailVerificationOn) {
		if (emailCodeConfirm) {
			verificationMessageTemplate.emailSubject = subject
			verificationMessageTemplate.emailMessage = message
		} else {
			verificationMessageTemplate.emailSubjectByLink = subject
			verificationMessageTemplate.emailMessageByLink = message
		}
	}
	if (smsVerificationOn)
		verificationMessageTemplate.smsMessage = sms.verification.message

	return verificationMessageTemplate
}

/**
 * 
 * @param  {[String]} recoveryMechanisms		e.g., ['email', 'phone']
 * 
 * @return {[String]} accountRecoverySetting[]	e.g., [{ name:'verified_email', priority:1 }, { name:'verified_phone_number', priority:2 }]
 */
const _getAccountRecoverySetting = recoveryMechanisms => {
	const accountRecoverySetting = { recoveryMechanisms:[] }
	if (!recoveryMechanisms || !recoveryMechanisms.length)
		accountRecoverySetting.recoveryMechanisms = [{ name: 'verified_email', priority:1 }]
	else
		accountRecoverySetting.recoveryMechanisms = recoveryMechanisms
			.filter(s => s == 'email' || s == 'phone')
			.map((name,idx) => ({ name:name == 'email' ? 'verified_email' : 'verified_phone_number', priority:idx+1 }))

	if (!accountRecoverySetting.recoveryMechanisms.length)
		accountRecoverySetting.recoveryMechanisms = [{ name: 'verified_email', priority:1 }]

	return accountRecoverySetting
}

/**
 * 
 * @param  {[String]} values		e.g., ['email', 'phone']
 * @return {[String]} attributes	e.g., ['email', 'phone_number']
 */
const _getAttributes = values => values && values.some(x => x == 'email' || x == 'phone')
	? values.filter(x => x == 'email' || x == 'phone').map(x => x == 'email' ? 'email' : 'phone_number')
	: undefined

/**
 * 
 * @param  {[String]} username.aliases								Allowed values: ['email', 'phone', 'preferred_username']
 * @param  {[String]} username.use									Allowed values: ['email', 'phone']
 * @param  {Boolean}  username.caseSensitive						Default true. 
 * 
 * @return {[String]} config.aliasAttributes						Allowed values: 'email', 'phone_number', 'preferred_username'
 * @return {[String]} config.usernameAttributes						Allowed values: 'email', 'phone_number'
 * @return {Boolean}  config.usernameConfiguration.caseSensitive	
 */
const _getUsernameConfig = username => {
	if (!username)
		return {}

	const config = {}
	if (username.aliases && username.aliases.some(x => x == 'email' || x == 'phone')) {
		const aliasAttributes = []
		if (username.aliases.some(x => x == 'email'))
			aliasAttributes.push('email')
		if (username.aliases.some(x => x == 'phone'))
			aliasAttributes.push('phone_number')
		if (username.aliases.some(x => x == 'preferred_username'))
			aliasAttributes.push('preferred_username')
		
		config.aliasAttributes = aliasAttributes
	} else if (username.use && username.use.some(x => x == 'email' || x == 'phone')) {
		const usernameAttributes = []
		if (username.use.some(x => x == 'email'))
			usernameAttributes.push('email')
		if (username.use.some(x => x == 'phone'))
			usernameAttributes.push('phone_number')
		
		config.usernameAttributes = usernameAttributes
	} 

	config.usernameConfiguration = { caseSensitive: username.caseSensitive === false ? false : true }

	return config
}

/**
 * Parses the Pulumix email config to the Pulumi emailConfiguration.
 * 
 * @param  {Object}	 config.ses									Default null (i.e., Cognito sends email). Not recommended to leave it null as there are daily limits with Cognito.
 * @param  {String}	 config.ses.from 							From email
 * @param  {String}	 config.ses.replyTo 						Reply to email
 * @param  {String}	 config.ses.configurationSet 				Configuration set.
 * @param  {String}	 config.ses.arn 							SES ARN.
 * 
 * @return {String}	 emailConfiguration.fromEmailAddress	
 * @return {String}	 emailConfiguration.replyToEmailAddress	
 * @return {String}	 emailConfiguration.emailSendingAccount		Either 'COGNITO_DEFAULT' or 'DEVELOPER' (i.e., ses is true).	
 * @return {String}	 emailConfiguration.sourceArn				SES ARN.
 * @return {String}	 emailConfiguration.configurationSet		SES configuration set.
 */
const _getSESconfig = config => {
	if (!config || !config.ses)
		return

	if (!config.ses.from)
		throw new Error('Missing required \'email.ses.from\'' )
	if (!config.ses.replyTo)
		throw new Error('Missing required \'email.ses.replyTo\'' )
	if (!config.ses.arn)
		throw new Error('Missing required \'email.ses.arn\'' )

	return {
		emailSendingAccount: 'DEVELOPER',
		fromEmailAddress: config.ses.from,
		replyToEmailAddress: config.ses.replyTo,
		sourceArn: config.ses.arn,
		configurationSet: config.ses.configurationSet
	}
}

/**
 * 
 * @param  {Object}	hooks									 										
 * @param  {Object}		.preAuth							(1) Lambda object.
 * @param  {Object}		.postAuth							(1) Lambda object.
 * @param  {Object}		.postConfirmation					(1) Lambda object.
 * @param  {Object}		.preSignUp							(1) Lambda object.
 * @param  {Object}		.preTokenGeneration					(1) Lambda object.
 * @param  {Object}		.userMigration						(1) Lambda object. 
 * @param  {Object}		.verifyAuthChallengeResponse		(1) Lambda object. 
 * 
 * @return {String} lambdaConfig.preAuthentication
 * @return {String} lambdaConfig.postAuthentication
 * @return {String} lambdaConfig.postConfirmation
 * @return {String} lambdaConfig.preSignUp
 * @return {String} lambdaConfig.preTokenGeneration
 * @return {String} lambdaConfig.userMigration
 * @return {String} lambdaConfig.verifyAuthChallengeResponse
 *
 * (1) A Lambda object has 2 required properties:
 * 		- {String} name
 * 		- {String} arn
 */
const _getLambdaConfig = hooks => {
	const errMsg = 'Failed to create the lambda config'
	if (!hooks)
		return

	const lambdaConfig = {}

	if (hooks.preAuth) {
		if (!hooks.preAuth.arn)
			throw new Error(`${errMsg}. Missing required 'hooks.preAuth.arn' property.`)
		lambdaConfig.preAuthentication = hooks.preAuth.arn
	}
	if (hooks.postAuth) {
		if (!hooks.postAuth.arn)
			throw new Error(`${errMsg}. Missing required 'hooks.postAuth.arn' property.`)
		lambdaConfig.postAuthentication = hooks.postAuth.arn
	}
	if (hooks.postConfirmation) {
		if (!hooks.postConfirmation.arn)
			throw new Error(`${errMsg}. Missing required 'hooks.postConfirmation.arn' property.`)
		lambdaConfig.postConfirmation = hooks.postConfirmation.arn
	}
	if (hooks.preSignUp) {
		if (!hooks.preSignUp.arn)
			throw new Error(`${errMsg}. Missing required 'hooks.preSignUp.arn' property.`)
		lambdaConfig.preSignUp = hooks.preSignUp.arn
	}
	if (hooks.preTokenGeneration) {
		if (!hooks.preTokenGeneration.arn)
			throw new Error(`${errMsg}. Missing required 'hooks.preTokenGeneration.arn' property.`)
		lambdaConfig.preTokenGeneration = hooks.preTokenGeneration.arn
	}
	if (hooks.userMigration) {
		if (!hooks.userMigration.arn)
			throw new Error(`${errMsg}. Missing required 'hooks.userMigration.arn' property.`)
		lambdaConfig.userMigration = hooks.userMigration.arn
	}
	if (hooks.verifyAuthChallengeResponse) {
		if (!hooks.verifyAuthChallengeResponse.arn)
			throw new Error(`${errMsg}. Missing required 'hooks.verifyAuthChallengeResponse.arn' property.`)
		lambdaConfig.verifyAuthChallengeResponse = hooks.verifyAuthChallengeResponse.arn
	}

	return lambdaConfig
}

/**
 * 
 * @param  {Object}			hooks									 										
 * @param  {Object}				.preAuth							(1) Lambda object.
 * @param  {Object}				.postAuth							(1) Lambda object.
 * @param  {Object}				.postConfirmation					(1) Lambda object.
 * @param  {Object}				.preSignUp							(1) Lambda object.
 * @param  {Object}				.preTokenGeneration					(1) Lambda object.
 * @param  {Object}				.userMigration						(1) Lambda object. 
 * @param  {Object}				.verifyAuthChallengeResponse		(1) Lambda object. 
 * @param  {Output<String>}	parentName
 * @param  {Output<String>}	userPoolArn
 * 
 * @return {[Output<Permission>]}
 */
const _createHookPermissions = (hooks, parentName, userPoolArn) => {
	const errMsg = 'Failed to create lambda permissions'
	// ALLOWING USERPOOL TO INVOKE LAMBDA
	
	const permissions = []
	if (!hooks)
		return permissions

	if (!parentName)
		throw new Error(`${errMsg}. Missing required argument 'parentName'.`)
	if (!userPoolArn)
		throw new Error(`${errMsg}. Missing required argument 'userPoolArn'.`)

	if (hooks.preAuth)
		permissions.push(_createLambdaPermission(`${parentName}-pre-auth-permission`, hooks.preAuth.name, userPoolArn))
	if (hooks.postAuth)
		permissions.push(_createLambdaPermission(`${parentName}-post-auth-permission`, hooks.postAuth.name, userPoolArn))
	if (hooks.postConfirmation)
		permissions.push(_createLambdaPermission(`${parentName}-post-confirm-permission`, hooks.postConfirmation.name, userPoolArn))
	if (hooks.preSignUp)
		permissions.push(_createLambdaPermission(`${parentName}-pre-signup-permission`, hooks.preSignUp.name, userPoolArn))
	if (hooks.preTokenGeneration)
		permissions.push(_createLambdaPermission(`${parentName}-pre-token-gen-permission`, hooks.preTokenGeneration.name, userPoolArn))
	if (hooks.userMigration)
		permissions.push(_createLambdaPermission(`${parentName}-user-migration-permission`, hooks.userMigration.name, userPoolArn))
	if (hooks.verifyAuthChallengeResponse)
		permissions.push(_createLambdaPermission(`${parentName}-verify-auth-resp-permission`, hooks.verifyAuthChallengeResponse.name, userPoolArn))

	return permissions
}

const _createLambdaPermission = (name, lambdaName, userPoolArn) => {
	const errMsg = 'Failed to create lambda permission'

	if (!name)
		throw new Error(`${errMsg}. Missing required argument 'name'.`)
	if (!lambdaName)
		throw new Error(`${errMsg}. Missing required argument 'lambdaName'.`)
	if (!userPoolArn)
		throw new Error(`${errMsg}. Missing required argument 'userPoolArn'.`)

	// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/lambda/permission/	
	return new aws.lambda.Permission(name, {
		action: 'lambda:InvokeFunction',
		function: lambdaName,
		principal: 'cognito-idp.amazonaws.com',
		sourceArn: userPoolArn
	})
}

module.exports = {
	UserPool,
	App
}



