/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

const pulumi = require('@pulumi/pulumi')
const aws = require('@pulumi/aws')

// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/sqs/queue/
class Queue extends aws.sqs.Queue {
	/**
	 * 
	 * @param	{String}		name	
	 * @param	{String}		description	
	 * @param	{Boolean}		fifo					Default false. When true, the 'name' is automatically suffixed with '.fifo', if that suffix is not set yet.
	 * @param	{Object}		redrivePolicy
	 * @param	{Object}			.deadLetterQueue	(1) This can be a boolean, an object or an Output<Queue>
	 * @param	{Number}			.maxReceiveCount	Default 10
	 * @param	{Object}		tags	
	 * @param	{[Resource]}	dependsOn	
	 * 
	 * @return	{Output<Queue>}	queue
	 *
	 * (1) 'deadLetterQueue' values:
	 * 		- true: This means create a new Queue on the fly and use it for the DLQ
	 * 		- Object: It must contain an 'arn' field
	 * 		- Output<Queue>: Self-explanatory
	 */
	constructor(input) {
		const { fifo, redrivePolicy, tags, protect, dependsOn, ...nativeInput } = input
		if (!nativeInput.name)
			throw new Error('Missing required argument \'name\'.')

		if (fifo) {
			nativeInput.fifoQueue = true
			if (!/\.fifo$/.test(nativeInput.name))
				nativeInput.name = `${nativeInput.name}.fifo`
		}

		const _input = { 
			...nativeInput,
			tags: {
				...(tags||{}),
				Name: nativeInput.name
			}
		}

		// Configures the DLQ (potentially create one one-the-fly)
		if (redrivePolicy) {
			if (!redrivePolicy.deadLetterQueue)
				_input.redrivePolicy = `{
					"maxReceiveCount": "${redrivePolicy.maxReceiveCount||10}"
				}`
			else {
				const dlqName = `ddl-for-${nativeInput.name}`
				// doc: https://www.pulumi.com/registry/packages/aws/api-docs/sqs/queue/
				const deadLetterQueue = redrivePolicy.deadLetterQueue === true ? new aws.sqs.Queue(dlqName, {
					dlqName,
					fifoQueue: fifo ? true : false,
					description: `Dead-letter queue for SQS queue ${nativeInput.name}`,
					tags: {
						...(tags||{}),
						Name: dlqName
					}
				}, { protect }) : redrivePolicy.deadLetterQueue
				
				if (!deadLetterQueue.arn)
					throw new Error('Missing required \'redrivePolicy.deadLetterQueue.arn\'. When \'redrivePolicy.deadLetterQueue\' is specified and is an object, its \'arn\' property is required.')

				_input.redrivePolicy = pulumi.interpolate `{
					"deadLetterTargetArn": "${deadLetterQueue.arn}",
					"maxReceiveCount": "${redrivePolicy.maxReceiveCount||10}"
				}`
			}
		}

		// Doc: https://www.pulumi.com/registry/packages/aws/api-docs/sqs/queue/
		super(nativeInput.name, _input, {  
			protect,
			dependsOn
		})
	}
}

module.exports = {
	Queue
}


