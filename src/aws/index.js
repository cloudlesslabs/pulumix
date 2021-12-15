/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

module.exports = {
	appSync: require('./appSync'),
	ec2: require('./ec2'),
	ecr: require('./ecr'),
	efs: require('./efs'),
	lambda: require('./lambda'),
	rds: require('./rds'),
	s3: require('./s3'),
	secret: require('./secret'),
	securityGroup: require('./securityGroup'),
	ssm: require('./ssm'),
	stepFunction: require('./stepFunction'),
	vpc: require('./vpc')
}