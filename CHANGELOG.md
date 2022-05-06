# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.1.3](https://github.com/cloudlesslabs/pulumix/compare/v0.1.2...v0.1.3) (2022-05-06)


### Bug Fixes

* .appy is not a function ([930163d](https://github.com/cloudlesslabs/pulumix/commit/930163d13c7e3fde89fff7acce6f4000daac638c))

### [0.1.2](https://github.com/cloudlesslabs/pulumix/compare/v0.1.1...v0.1.2) (2022-05-05)

### [0.1.1](https://github.com/cloudlesslabs/pulumix/compare/v0.1.0...v0.1.1) (2022-04-29)


### Features

* add support for Aurora's cluster 'allowMajorVersionUpgrade' and 'applyImmediately' properties ([053013b](https://github.com/cloudlesslabs/pulumix/commit/053013bd86597f93340df50dfff624108fcdde86))

## [0.1.0](https://github.com/cloudlesslabs/pulumix/compare/v0.0.6...v0.1.0) (2022-04-29)


### Features

* Add explicit DB engine version set up on the Aurora object ([ce5b0d9](https://github.com/cloudlesslabs/pulumix/commit/ce5b0d903ca1737d6bdac86df72e49c3d3f024c2))

### [0.0.6](https://github.com/cloudlesslabs/pulumix/compare/v0.0.5...v0.0.6) (2022-04-14)

### [0.0.5](https://github.com/cloudlesslabs/pulumix/compare/v0.0.4...v0.0.5) (2022-04-14)


### Bug Fixes

* VPC fails ([9dda2bd](https://github.com/cloudlesslabs/pulumix/commit/9dda2bd03f20736b2579caa30971362df6be9ad8))

### [0.0.4](https://github.com/cloudlesslabs/pulumix/compare/v0.0.3...v0.0.4) (2022-04-14)


### Features

* Add more subnet details in the VPC object ([8ab0d5f](https://github.com/cloudlesslabs/pulumix/commit/8ab0d5f20ed952bb758afabc70667cfbb4fb4357))

### [0.0.3](https://github.com/cloudlesslabs/pulumix/compare/v0.0.2...v0.0.3) (2022-04-14)

### 0.0.2 (2022-04-13)


### Features

* Add info and request in the payload in AppSync ([b92cd20](https://github.com/cloudlesslabs/pulumix/commit/b92cd20fe0c665640156c092483353896b1f770b))
* Add more config for the EFS ([2dc808e](https://github.com/cloudlesslabs/pulumix/commit/2dc808ed6277c1c14ce62e915b76e2dfb77d84d7))
* Add support for a lot of AWS services ([fc19778](https://github.com/cloudlesslabs/pulumix/commit/fc19778cc8a85e8e27f967baf5d99f942d44743b))
* Add support for adding a cloudfront distro on a bucket ([7607c5f](https://github.com/cloudlesslabs/pulumix/commit/7607c5fff4d8bcfb423c3be0952c73e8b6d6f7ef))
* Add support for AppSync ([d7dd177](https://github.com/cloudlesslabs/pulumix/commit/d7dd1772309f2bee95b6e4fe317817a96aa82090))
* Add support for ARM architecture on Lambdas ([088bacc](https://github.com/cloudlesslabs/pulumix/commit/088bacce9e84f6905fd4cb670e3cc16a1d0a3253))
* Add support for automatic S3 files synching and cloudfront invalidation ([be81564](https://github.com/cloudlesslabs/pulumix/commit/be8156460bab56162b545053c651717f26b79ca0))
* Add support for AWS services access to Lambda ([775cff7](https://github.com/cloudlesslabs/pulumix/commit/775cff70aa0e8336d1a656985ff6fad765852553))
* Add support for configuring a new lambda with AWS services that can invoke it ([a778a9f](https://github.com/cloudlesslabs/pulumix/commit/a778a9ff623e98d2952d411f998e77aa1b48aa11))
* Add support for creating/overwriting AWS Parameter Store without using Pulumi ([2e064e3](https://github.com/cloudlesslabs/pulumix/commit/2e064e3c82cc2e26ed5d14c150ff3a194b611e71))
* Add support for ECR images with tagging ([19479bf](https://github.com/cloudlesslabs/pulumix/commit/19479bf60fbc57837dfba1835bec9a5caf2c7fff))
* Add support for getting secrets ([06f9a5e](https://github.com/cloudlesslabs/pulumix/commit/06f9a5e7a158d06e114536468a62320e58e31af1))
* Add support for invalidating a cloudfront distribution upon S3 content changes ([040a343](https://github.com/cloudlesslabs/pulumix/commit/040a343c8a766002c85d5b6189cabf585560ee71))
* Add support for Lambda layers ([6a7b873](https://github.com/cloudlesslabs/pulumix/commit/6a7b8733423f02eec6468cba8aa19b2ac02853c0))
* Add support for new 'lambdaResolvers' and 'dataSource' methods in the appSync API ([e924621](https://github.com/cloudlesslabs/pulumix/commit/e92462152289964ee13e9e1eaf855d5b3797efa3))
* Add support for passing a payload to the schedule Lambda ([3dc9f05](https://github.com/cloudlesslabs/pulumix/commit/3dc9f05b13eaccc73549cd0700e83888b2370413))
* Add support for publishing a lambda to a version ([3c4bf92](https://github.com/cloudlesslabs/pulumix/commit/3c4bf925f56ceea091224718d224babbba4760cc))
* Add support for S3 + more doc about the Automation API ([4cf4d3c](https://github.com/cloudlesslabs/pulumix/commit/4cf4d3cab43558bbec61a415f632777de9cd4568))
* Add support for schedule lambdas ([f8e51b3](https://github.com/cloudlesslabs/pulumix/commit/f8e51b3423060faafd39935643da0aa40407d384))
* Add support for secret rotation lambda ([7aa1046](https://github.com/cloudlesslabs/pulumix/commit/7aa1046790d13e30ad272e3a003ad00a5252406b))
* Add support for SSM Parameter Store ([1e818b7](https://github.com/cloudlesslabs/pulumix/commit/1e818b7b62f5f4b7b2ec993a1d2249b2bad39dde))
* Add support for syncing local files to an S3 bucket ([985d36b](https://github.com/cloudlesslabs/pulumix/commit/985d36b5dfb6ef3233f9e1bb3902686c75e43341))
* Add support for the automation API ([a461253](https://github.com/cloudlesslabs/pulumix/commit/a4612530f449fa0e9341eb1e49a0c7febfbb9abb))
* Add support for the Automation API ([af8780c](https://github.com/cloudlesslabs/pulumix/commit/af8780cbdebcc1ddd3cf4626e43350d47025dc09))
* Expose the 'resolve' API ([224d440](https://github.com/cloudlesslabs/pulumix/commit/224d44032f468fc6e2be3e178dfbfaad8284a699))
* Update lambda ([e0fe2b4](https://github.com/cloudlesslabs/pulumix/commit/e0fe2b49774305cd1fae21a8c878ed00e9cdc11a))


### Bug Fixes

* AppSync does fails when the Cognito Auth is missing its 'defaultAction' ([0e85127](https://github.com/cloudlesslabs/pulumix/commit/0e85127239d768e3c30dafc29734fb3d79d44d62))
* aurora module not found ([49bf9b2](https://github.com/cloudlesslabs/pulumix/commit/49bf9b2c9ca46c737cd1d6588e5461ba139656a5))
* content is not a supported bucket website property ([184fc95](https://github.com/cloudlesslabs/pulumix/commit/184fc95478db6699b79e4b4b31934f87f3ee669a))
* Missing region config in the AWS SDK config in the SSM module ([7431252](https://github.com/cloudlesslabs/pulumix/commit/7431252d7f386b04108a0bcc69cc80f097bba00c))
* Remove 'defaultAction' from userPoolConfig cause this option is broken ([d18901a](https://github.com/cloudlesslabs/pulumix/commit/d18901a7a271063d176c81fe31719c6be2a560ac))
* ssm.parameterStore.get function fails when the parameter is not found. It should return NULL instead ([0471c70](https://github.com/cloudlesslabs/pulumix/commit/0471c7032c04889cbeaa1d313c385b5e9a1ca8c2))
* The AppSync 'authConfig' is not working ([aa67222](https://github.com/cloudlesslabs/pulumix/commit/aa672226ed2cc85d0337fecd64ec27bc3d2b2f98))
* The appSync with Cognito is not supporting the required 'defaultAction' ([558ea89](https://github.com/cloudlesslabs/pulumix/commit/558ea89343a1dbcf58d8655806a4871a9132cf2a))
* The schedule lambda fails ([4500b35](https://github.com/cloudlesslabs/pulumix/commit/4500b3547e6dc3d9f8b8bd66ce3ec8d6ef2f8c1d))
* The step-function name is suffixed with a random ID ([41f0900](https://github.com/cloudlesslabs/pulumix/commit/41f09005629bddc32559bc7679e728e785de063c))

### [0.0.2](https://github.com/cloudlesslabs/pulumix/compare/v0.0.1...v0.0.2) (2022-04-13)

### [0.0.1](https://github.com/cloudlesslabs/pulumix/compare/v0.0.0...v0.0.1) (2022-04-13)
