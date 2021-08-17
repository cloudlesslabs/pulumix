// /**
//  * Copyright (c) 2019-2021, Cloudless Consulting Pty Ltd.
//  * All rights reserved.
//  * 
//  * This source code is licensed under the BSD-style license found in the
//  * LICENSE file in the root directory of this source tree.
// */

// // To skip a test, either use 'xit' instead of 'it', or 'describe.skip' instead of 'describe'.
// // To only run a test, use 'it.only' instead of 'it'.

// const { assert } = require('chai')
// const { formatStates, resolveActivitiesArns } = require('../src/aws/stepFunction')

// describe.skip('formatStates', () => {
// 	it(`Should format the states to valid AWS Step-function states.`, () => {
// 		const states = formatStates([{
// 			name: 'inventory-check-free-threshold',
// 			activityArn: 'inventoryCheckFreeThreshold.lambda.arn',
// 			next: 'decide-if-inventory-must-be-updated'
// 		},{
// 			name: 'decide-if-inventory-must-be-updated',
// 			choices:[{
// 				Variable: '$.warm_inventory_sufficient',
// 				BooleanEquals: true,
// 				Next: 'inventory-check-finish'
// 			}],
// 			default: 'update-inventory-in-parallel'
// 		},{
// 			name: 'update-inventory-in-parallel',
// 			parallel: {
// 				states:[{
// 					name: 'update-efs-inventory',
// 					choices:[{
// 						Variable: '$.efs_project_folders.sufficient',
// 						BooleanEquals: true,
// 						Next: 'inventory-check-finish'
// 					}],
// 					default: 'project-create-efs-git'
// 				},{
// 					name: 'update-s3-inventory',
// 					choices:[{
// 						Variable: '$.s3_project_folders.sufficient',
// 						BooleanEquals: true,
// 						Next: 'inventory-check-finish'
// 					}],
// 					default: 'project-create-s3'
// 				},{
// 					name: 'update-cloudfront-inventory',
// 					choices:[{
// 						Variable: '$.cloudfront_distros.sufficient',
// 						BooleanEquals: true,
// 						Next: 'inventory-check-finish'
// 					}],
// 					default: 'website-create-cloudfront'
// 				}]
// 			},
// 			next: 'inventory-check-finish'
// 		}, {
// 			name: 'project-create-efs-git',
// 			map:{
// 				inputPath: '$.efs_project_folders',
// 				itemsPath: '$.adjust_items',
// 				maxConcurrency: 5,
// 				states:[{
// 					name:'create-efs',
// 					activityArn: 'projectCreateEfsGit.lambda.arn',
// 					end: true
// 				}]
// 			},
// 			end: true
// 		}, {
// 			name: 'project-create-s3',
// 			map:{
// 				inputPath: '$.s3_project_folders',
// 				itemsPath: '$.adjust_items',
// 				maxConcurrency: 5,
// 				states:[{
// 					name:'create-s3-folder',
// 					activityArn: 'projectCreateS3.lambda.arn',
// 					end: true
// 				}]
// 			},
// 			end: true
// 		}, {
// 			name: 'website-create-cloudfront',
// 			map:{
// 				inputPath: '$.cloudfront_distros',
// 				itemsPath: '$.adjust_items',
// 				maxConcurrency: 5,
// 				states:[{
// 					name:'create-cloudfront',
// 					activityArn: 'websiteCreateCloudfront.lambda.arn',
// 					end: true
// 				}]
// 			},
// 			end: true
// 		}, {
// 			name:'inventory-check-finish',
// 			success: true
// 		}])

// 		console.log(JSON.stringify(states, null, '	'))

// 		assert.isOk(states)
// 	})
// 	it(`Should fail when a 'choice' is missing its required 'Next' property.`, () => {
// 		assert.throws(() => formatStates([{
// 			name: 'inventory-check-free-threshold',
// 			activityArn: 'inventoryCheckFreeThreshold.lambda.arn',
// 			next: 'decide-if-inventory-must-be-updated'
// 		},{
// 			name: 'decide-if-inventory-must-be-updated',
// 			choices:[{
// 				Variable: '$.warm_inventory_sufficient',
// 				BooleanEquals: true,
// 				End: true
// 			}],
// 			default: 'update-inventory-in-parallel'
// 		}]), /Choices must contain a \'Next\' property/)
// 	})
// 	it(`Should fail when a step reference a 'Next' step that does not exist.`, () => {
// 		assert.throws(() => formatStates([{
// 			name: 'inventory-check-free-threshold',
// 			activityArn: 'inventoryCheckFreeThreshold.lambda.arn',
// 			next: 'decide-if-inventory-must-be-updated'
// 		},{
// 			name: 'decide-if-inventory-must-be-updated',
// 			choices:[{
// 				Variable: '$.warm_inventory_sufficient',
// 				BooleanEquals: true,
// 				Next: 'inventory-check-finish'
// 			}]
// 		}]), /Next step \'inventory-check-finish\' not found/)

// 		assert.throws(() => formatStates([{
// 			name: 'inventory-check-free-threshold',
// 			activityArn: 'inventoryCheckFreeThreshold.lambda.arn',
// 			next: 'decide-if-inventory-must-be-updated'
// 		},{
// 			name: 'decide-if-inventory-must-be-updated',
// 			choices:[{
// 				Variable: '$.warm_inventory_sufficient',
// 				BooleanEquals: true,
// 				Next: 'inventory-check-finish'
// 			}],
// 			default: 'update-inventory-in-parallel'
// 		}, {
// 			name:'inventory-check-finish',
// 			success: true
// 		}]), /Next step \'update-inventory-in-parallel\' not found/)
// 	})
// })

// describe('resolveActivitiesArns', () => {
// 	it(`Should format the states to valid AWS Step-function states.`, async () => {
// 		const states = await resolveActivitiesArns([{
// 			name: 'inventory-check-free-threshold',
// 			activityArn: 'inventoryCheckFreeThreshold.lambda.arn',
// 			next: 'decide-if-inventory-must-be-updated'
// 		},{
// 			name: 'decide-if-inventory-must-be-updated',
// 			choices:[{
// 				Variable: '$.warm_inventory_sufficient',
// 				BooleanEquals: true,
// 				Next: 'inventory-check-finish'
// 			}],
// 			default: 'update-inventory-in-parallel'
// 		},{
// 			name: 'update-inventory-in-parallel',
// 			parallel: {
// 				states:[{
// 					name: 'update-efs-inventory',
// 					choices:[{
// 						Variable: '$.efs_project_folders.sufficient',
// 						BooleanEquals: true,
// 						Next: 'inventory-check-finish'
// 					}],
// 					default: 'project-create-efs-git'
// 				},{
// 					name: 'update-s3-inventory',
// 					choices:[{
// 						Variable: '$.s3_project_folders.sufficient',
// 						BooleanEquals: true,
// 						Next: 'inventory-check-finish'
// 					}],
// 					default: 'project-create-s3'
// 				},{
// 					name: 'update-cloudfront-inventory',
// 					choices:[{
// 						Variable: '$.cloudfront_distros.sufficient',
// 						BooleanEquals: true,
// 						Next: 'inventory-check-finish'
// 					}],
// 					default: 'website-create-cloudfront'
// 				}]
// 			},
// 			next: 'inventory-check-finish'
// 		}, {
// 			name: 'project-create-efs-git',
// 			map:{
// 				inputPath: '$.efs_project_folders',
// 				itemsPath: '$.adjust_items',
// 				maxConcurrency: 5,
// 				states:[{
// 					name:'create-efs',
// 					activityArn: 'projectCreateEfsGit.lambda.arn',
// 					end: true
// 				}]
// 			},
// 			end: true
// 		}, {
// 			name: 'project-create-s3',
// 			map:{
// 				inputPath: '$.s3_project_folders',
// 				itemsPath: '$.adjust_items',
// 				maxConcurrency: 5,
// 				states:[{
// 					name:'create-s3-folder',
// 					activityArn: 'projectCreateS3.lambda.arn',
// 					end: true
// 				}]
// 			},
// 			end: true
// 		}, {
// 			name: 'website-create-cloudfront',
// 			map:{
// 				inputPath: '$.cloudfront_distros',
// 				itemsPath: '$.adjust_items',
// 				maxConcurrency: 5,
// 				states:[{
// 					name:'create-cloudfront',
// 					activityArn: 'websiteCreateCloudfront.lambda.arn',
// 					end: true
// 				}]
// 			},
// 			end: true
// 		}, {
// 			name:'inventory-check-finish',
// 			success: true
// 		}])

// 		console.log(JSON.stringify(states, null, '	'))

// 		// assert.isOk(states)
// 	})
// })









