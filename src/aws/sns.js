/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')

const SUBSCRIBER_TYPES = ['queue', 'sms', 'lambda', 'firehose', 'application', 'email', 'email-json', 'http', 'https']

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

	/**
	 * Creates a new SNS TopicSubscription
	 * 
	 * @param  {Output<Topic>}				topic
	 * @param  {Object}						subscriber
	 * @param  {String}							.name
	 * @param  {Object}							.deadLetterQueue	(1) This can be a boolean, an object or an Output<Queue>
	 * @param  {Output<Resource>}				.[type]				Valid values: 'sqs', 'sqsArn', 'sms', 'lambda', 'firehose', 'application', 'email', 'email-json', 'http', 'https'
	 * @param  {Object}							.tags
	 * @param  {Boolean}						.protect
	 * @param  {[Object]}						.dependsOn
	 * 
	 * @return {Output<TopicSubscription>}	subscription
	 *
	 * (1) 'deadLetterQueue' values:
	 * 		- true: This means create a new Queue on the fly and use it for the DLQ
	 * 		- Object: It must contain an 'arn' field
	 * 		- Output<Queue>: Self-explanatory
	 */
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
 * @param  {Output<Topic>}				topic
 * @param  {Object}						subscriber
 * @param  {String}							.name
 * @param  {Object}							.deadLetterQueue				(1) This can be a boolean, an object or an Output<Queue>
 * @param  {Output<Resource>}				.[type]							Valid values: 'sqs', 'sqsArn', 'sms', 'lambda', 'firehose', 'application', 'email', 'email-json', 'http', 'https'
 * @param  {Number}							.confirmationTimeoutInMinutes	Only valid for 'http' or 'https'.
 * @param  {Object}							.tags
 * @param  {Boolean}						.protect
 * @param  {[Object]}						.dependsOn
 * 
 * @return {Output<TopicSubscription>}	subscription
 *
 * (1) 'deadLetterQueue' values:
 * 		- true: This means create a new Queue on the fly and use it for the DLQ
 * 		- Object: It must contain an 'arn' field
 * 		- Output<Queue>: Self-explanatory
 * 
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

	const { protocol, type } = _getSubscriberProtocol(subscriber)
	const { deadLetterQueue, tags, protect, dependsOn, deliveryPolicy, endpointAutoConfirms, filterPolicy, rawMessageDelivery, redrivePolicy, subscriptionRoleArn } = subscriber
	const rest = { deliveryPolicy, endpointAutoConfirms, filterPolicy, rawMessageDelivery, redrivePolicy, subscriptionRoleArn }

	const _input = {
		name: subscriber.name,
		protocol,
		topic: topic.arn,
		...rest,
		tags: {
			...(tags||{}),
			Name: subscriber.name
		}
	}

	// Configures the DLQ (potentially create one one-the-fly)
	if (deadLetterQueue) {
		const dlqName = `ddl-for-sns-sub-${subscriber.name}`
		// doc: https://www.pulumi.com/registry/packages/aws/api-docs/sqs/queue/
		const deadLetterQueue = deadLetterQueue === true ? new aws.sqs.Queue(dlqName, {
			dlqName,
			description: `Dead-letter queue for SNS subscription ${subscriber.name}`,
			tags: {
				...(tags||{}),
				Name: dlqName
			}
		}, { protect }) : deadLetterQueue
		
		if (!deadLetterQueue.arn)
			throw new Error('Missing required \'deadLetterQueue.arn\'. When \'deadLetterQueue\' is specified and is an object, its \'arn\' property is required.')

		_input.redrivePolicy = pulumi.interpolate `{
			"deadLetterTargetArn": "${deadLetterQueue.arn}"
		}`
	}

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
			..._input,
			endpoint: subscriber[protocol].arn
		}, {
			protect,
			dependsOn:[snsLambdaInvokePermission, ...(dependsOn||[])]
		})
	} else if (protocol == 'http' || protocol == 'https') {
		// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/sns/topicsubscription/
		return new aws.sns.TopicSubscription(subscriber.name, {
			..._input,
			endpoint: subscriber[protocol],
			confirmationTimeoutInMinutes: subscriber.confirmationTimeoutInMinutes||30, // You have 30 minutes to confirm
		}, {
			protect,
			dependsOn
		})
	} else if (protocol == 'sqs') {
		// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/sns/topicsubscription/
		return new aws.sns.TopicSubscription(subscriber.name, {
			..._input,
			endpoint: subscriber[type].arn,
		}, {
			protect,
			dependsOn
		})
	} else 
		throw new Error(`Type '${protocol}' is supported but Pulumix has not yet had time to implement it. Coming soon...`)

}

const _getSubscriberProtocol = sub => {
	const type = Object.keys(sub||{}).find(key => SUBSCRIBER_TYPES.indexOf(key) >= 0)
	if (!type)
		throw new Error(`Subscriber's type not supported. Supported types: ${SUBSCRIBER_TYPES}.`)

	return { 
		protocol: type == 'queue' ? 'sqs' : type, 
		type 
	}
}

module.exports = {
	Topic
}


