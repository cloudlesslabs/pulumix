/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

const aws = require('@pulumi/aws')

const SUBSCRIBER_TYPES = ['sqs', 'sms', 'lambda', 'firehose', 'application', 'email', 'email-json', 'http', 'https']

class Topic extends aws.sns.Topic {
	constructor(input) {
		const { fifo, tags, protect, dependsOn, ...nativeInput } = input
		if (!nativeInput.name)
			throw new Error('Missing required argument \'name\'.')

		if (fifo) {
			nativeInput.fifoTopic = fifo
			if (!/\.fifo$/.test(nativeInput.name))
				nativeInput.name = `${nativeInput.name}.fifo`
		}

		super(nativeInput.name, { 
			...nativeInput,
			tags: {
				...(tags||{}),
				Name: nativeInput.name
			}
		}, {  
			protect,
			dependsOn
		})
	}

	static createTopicSubscription(topic, subscriber) { 
		if (!topic)
			throw new Error('Missing required argument \'topic\'')
		if (!topic.arn)
			throw new Error('Missing required argument \'topic.arn\'')

		if (!subscriber)
			return sub => _createTopicSubscription(topic, sub)
		else
			return _createTopicSubscription(topic, subscriber)
	}
}

/**
 * Creates a new SNS TopicSubscription
 * 
 * @param  {Output<Topic>}	topic
 * @param  {Object}			subscriber
 * @param  {String}				.name
 * @param  {String}				.[type]		Valid values: 'sqs', 'sms', 'lambda', 'firehose', 'application', 'email', 'email-json', 'http', 'https'
 * @param  {Object}				.tags
 * @param  {Boolean}			.protect
 * @param  {[Object]}			.dependsOn
 * 
 * @return {[type]}            [description]
 */
const _createTopicSubscription = (topic, subscriber) => {
	if (!topic)
		throw new Error('Missing required argument \'topic\'')
	if (!topic.arn)
		throw new Error('Missing required argument \'topic.arn\'')
	if (!subscriber)
		throw new Error('Missing required argument \'subscriber\'')
	if (!subscriber.name)
		throw new Error('Missing required argument \'subscriber.name\'')

	const protocol = _getSubscriberType(subscriber)
	const { tags, protect, dependsOn, deliveryPolicy, endpointAutoConfirms, filterPolicy, rawMessageDelivery, redrivePolicy, subscriptionRoleArn } = subscriber
	const rest = { deliveryPolicy, endpointAutoConfirms, filterPolicy, rawMessageDelivery, redrivePolicy, subscriptionRoleArn }

	if (protocol == 'lambda') {
		// Allows SNS to invoke the Lambda
		const permName = `perm-for-${subscriber.name}`
		const snsLambdaInvokePermission = new aws.lambda.Permission(permName, {
			name: permName,
			action: 'lambda:InvokeFunction',
			function: subscriber[protocol].name,
			principal: 'sns.amazonaws.com',
			sourceArn: topic.arn,
			tags: {
				...(tags||{}),
				Name: permName
			}
		}, {
			protect,
			dependsOn
		})

		// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/sns/topicsubscription/
		return new aws.sns.TopicSubscription(subscriber.name, {
			name: subscriber.name,
			endpoint: subscriber[protocol].arn,
			protocol,
			topic: topic.arn,
			...rest,
			tags: {
				...(tags||{}),
				Name: subscriber.name
			}
		}, {
			protect,
			dependsOn:[snsLambdaInvokePermission, ...(dependsOn||[])]
		})
	} else if (protocol == 'http' || protocol == 'https') {
		// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/sns/topicsubscription/
		return new aws.sns.TopicSubscription(subscriber.name, {
			name: subscriber.name,
			endpoint: subscriber[protocol],
			protocol,
			confirmationTimeoutInMinutes: 30, // You have 30 minutes to confirm
			topic: topic.arn,
			...rest,
			tags: {
				...(tags||{}),
				Name: subscriber.name
			}
		}, {
			protect,
			dependsOn
		})
	} else 
		throw new Error(`Type '${protocol}' is supported but Pulumix has not yet had time to implement it. Coming soon...`)

}

const _getSubscriberType = sub => {
	const type = Object.keys(sub||{}).find(key => SUBSCRIBER_TYPES.indexOf(key) >= 0)
	if (!type)
		throw new Error(`Subscriber's type not supported. Supported types: ${SUBSCRIBER_TYPES}.`)
	return type
}

module.exports = {
	Topic
}


