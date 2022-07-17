/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')
const { keepResourcesOnly } = require('../utils')

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
	 * @param  {Object}							.filterPolicy
	 * @param  {Object}							.deliveryPolicy 
	 * @param  {Object}							.tags
	 * @param  {Boolean}						.protect
	 * @param  {[Object]}						.dependsOn
	 * 
	 * @return {Output<TopicSubscription>}	subscription
	 *
	 * (1) 'deadLetterQueue' values:
	 * 		- true: This means create a new Queue on the fly and use it for the DLQ
	 * 		- Object: It must contain an 'arn' and 'id' field
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
 * @param  {Object}							.filterPolicy
 * @param  {Object}							.deliveryPolicy 
 * @param  {Object}							.tags
 * @param  {Boolean}						.protect
 * @param  {[Object]}						.dependsOn
 * 
 * @return {Output<TopicSubscription>}	subscription
 *
 * (1) 'deadLetterQueue' values:
 * 		- true: This means create a new Queue on the fly and use it for the DLQ
 * 		- Object: It must contain an 'arn' and 'id' field
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
	const rest = { deliveryPolicy:_convertToString(deliveryPolicy), endpointAutoConfirms, filterPolicy:_convertToString(filterPolicy), rawMessageDelivery, redrivePolicy, subscriptionRoleArn }
	const _dependsOn = dependsOn || []

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
		const dlq = deadLetterQueue === true ? new aws.sqs.Queue(dlqName, {
			dlqName,
			description: `Dead-letter queue for SNS subscription ${subscriber.name}`,
			tags: {
				...(tags||{}),
				Name: dlqName
			}
		}, { protect }) : deadLetterQueue
		
		if (!dlq.arn)
			throw new Error('Missing required \'deadLetterQueue.arn\'. When \'deadLetterQueue\' is specified as an object, its \'arn\' property is required.')
		if (!dlq.id)
			throw new Error('Missing required \'deadLetterQueue.id\'. When \'deadLetterQueue\' is specified as an object, its \'id\' property is required.')

		_input.redrivePolicy = pulumi.interpolate `{"deadLetterTargetArn":"${dlq.arn}"}`

		// Adds a policy on the dead-letter queue so SNS can send messages (sqs:SendMessage) to it
		_dependsOn.push(_createQueuePolicyToEnableSNSToSendMessages(dlqName, dlq, topic, tags, protect))
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
			dependsOn: keepResourcesOnly(_dependsOn)
		})

		// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/sns/topicsubscription/
		return new aws.sns.TopicSubscription(subscriber.name, {
			..._input,
			endpoint: subscriber[protocol].arn
		}, {
			protect,
			dependsOn: keepResourcesOnly([snsLambdaInvokePermission, ...(_dependsOn||[])])
		})
	} else if (protocol == 'http' || protocol == 'https') {
		// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/sns/topicsubscription/
		return new aws.sns.TopicSubscription(subscriber.name, {
			..._input,
			endpoint: subscriber[protocol],
			confirmationTimeoutInMinutes: subscriber.confirmationTimeoutInMinutes||30, // You have 30 minutes to confirm
		}, {
			protect,
			dependsOn: keepResourcesOnly(_dependsOn)
		})
	} else if (protocol == 'sqs') {
		// Adds a policy on the queue so SNS can send messages (sqs:SendMessage) to it
		_dependsOn.push(_createQueuePolicyToEnableSNSToSendMessages(`push-msg-for-${subscriber.name}`, subscriber[type], topic, tags, protect))
		// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/sns/topicsubscription/
		return new aws.sns.TopicSubscription(subscriber.name, {
			..._input,
			endpoint: subscriber[type].arn,
		}, {
			protect,
			dependsOn: keepResourcesOnly(_dependsOn)
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

/**
 * Creates a new Queue policy. Doc: https://www.pulumi.com/registry/packages/aws/api-docs/sqs/queuepolicy/
 * 
 * @param  {String}					name			
 * @param  {Object}					queue
 * @param  {Output<String>}				.id
 * @param  {Output<String>}				.arn
 * @param  {Object}					topic
 * @param  {Output<String>}				.arn
 * @param  {Object}					tags			
 * @param  {Boolean}				protect		
 * 
 * @return {Output<QueuePolicy>}	queue
 */
const _createQueuePolicyToEnableSNSToSendMessages = (name, queue, topic, tags, protect) => new aws.sqs.QueuePolicy(name, {
	queueUrl: queue.id,
	policy: pulumi.all([queue.arn, topic.arn]).apply(([dlqArn, topicArn]) => JSON.stringify({
		Version: '2012-10-17',
		Id: 'sqspolicy',
		Statement: [{
			Effect: 'Allow',
			Principal: {
				Service: 'sns.amazonaws.com'
			},
			Action: 'sqs:SendMessage',
			Resource: dlqArn,
			Condition: {
				ArnEquals: {
					'aws:SourceArn': topicArn
				}
			}
		}]
	})),
	tags: {
		...(tags||{}),
		Name: name
	}
}, {
	protect
})

const _convertToString = o => {
	if (!o)
		return o
	if (typeof(o) == 'object')
		return JSON.stringify(o)
	else
		return `${o}`
}

module.exports = {
	Topic
}


