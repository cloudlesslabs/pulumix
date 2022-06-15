/*
Copyright (c) 2019-2021, Cloudless Consulting Lty Ltd
All rights reserved.

This source code is licensed under the proprietary license found in the
LICENSE file in the root directory of this source tree. 
*/

module.exports = {
	apiGateway: require('./apiGateway'),
	appSync: require('./appSync'),
	cognito: require('./cognito'),
	...require('./ec2'),
	ecr: require('./ecr'),
	efs: require('./efs'),
	...require('./lambda'),
	rds: require('./rds'),
	s3: require('./s3'),
	...require('./secret'),
	...require('./securityGroup'),
	ssm: require('./ssm'),
	stepFunction: require('./stepFunction'),
	...require('./vpc')
}