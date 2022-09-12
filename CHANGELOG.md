# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.12.0](https://github.com/cloudlesslabs/pulumix/compare/v0.11.1...v0.12.0) (2022-09-12)


### Features

* AppSync - Add support for serializing the selectionSetList and selectionSetGraphQL in the payload ([f9b8d24](https://github.com/cloudlesslabs/pulumix/commit/f9b8d2478ca4ceb9711057414754c3ce9cc0b6dc))

### [0.11.1](https://github.com/cloudlesslabs/pulumix/compare/v0.11.0...v0.11.1) (2022-08-19)


### Features

* S3 website - Add support for CloudFront custom error redirection ([3ff9ca0](https://github.com/cloudlesslabs/pulumix/commit/3ff9ca0fbb03973ee1087e77080b645b746be230))

## [0.11.0](https://github.com/cloudlesslabs/pulumix/compare/v0.10.3...v0.11.0) (2022-08-18)


### Features

* Add support for creating new DNS records in Route 53 when configuring a custom domain on an S3 bucket connected to CloudFront ([aae97c4](https://github.com/cloudlesslabs/pulumix/commit/aae97c46b63f18367fba2a8d9f9072f8a560c35d))

### [0.10.3](https://github.com/cloudlesslabs/pulumix/compare/v0.10.2...v0.10.3) (2022-08-18)


### Bug Fixes

* Typo ([8fb7965](https://github.com/cloudlesslabs/pulumix/commit/8fb7965e341619889348ca5ef8659e8c0094c85a))

### [0.10.2](https://github.com/cloudlesslabs/pulumix/compare/v0.10.1...v0.10.2) (2022-08-18)


### Bug Fixes

* ACM SSL certs for CloudFront can only be provisionned in 'us-east-1' ([a63b49c](https://github.com/cloudlesslabs/pulumix/commit/a63b49c8acbfaea9980a777284cffd8f21b9441a))

### [0.10.1](https://github.com/cloudlesslabs/pulumix/compare/v0.10.0...v0.10.1) (2022-08-18)

## [0.10.0](https://github.com/cloudlesslabs/pulumix/compare/v0.9.10...v0.10.0) (2022-08-18)


### Features

* Add support for automatic SSL cert provisionning for S3 website when custom domains are configured ([676e818](https://github.com/cloudlesslabs/pulumix/commit/676e81827c424be2b2f1b776f079a7e846d516d2))

### [0.9.10](https://github.com/cloudlesslabs/pulumix/compare/v0.9.9...v0.9.10) (2022-08-15)


### Bug Fixes

* CloudFront fails with 'Member must satisfy enum value set: [static-ip, sni-only, vip]' ([c672a00](https://github.com/cloudlesslabs/pulumix/commit/c672a009da9044419cd9c63577eb1927d0dcfb88))

### [0.9.9](https://github.com/cloudlesslabs/pulumix/compare/v0.9.8...v0.9.9) (2022-08-15)


### Bug Fixes

* CloudFront cannot be configured with custom domains without an ACM cert ([2ad8061](https://github.com/cloudlesslabs/pulumix/commit/2ad806171643e58637c1bdab1c0f25e07685e7ed))

### [0.9.8](https://github.com/cloudlesslabs/pulumix/compare/v0.9.7...v0.9.8) (2022-07-17)


### Bug Fixes

* The redrive policy of the SQS and SNS resource is always updating because of tabs ([ea0f0fc](https://github.com/cloudlesslabs/pulumix/commit/ea0f0fc21fad141898e1d14420115a081cc7017f))

### [0.9.7](https://github.com/cloudlesslabs/pulumix/compare/v0.9.6...v0.9.7) (2022-07-17)


### Bug Fixes

* The redrive policy of the SQS and SNS resource is always updating because of tabs ([442243b](https://github.com/cloudlesslabs/pulumix/commit/442243b2d763ff4cd497b375036cf4b2fe92045d))

### [0.9.6](https://github.com/cloudlesslabs/pulumix/compare/v0.9.5...v0.9.6) (2022-07-03)


### Features

* 'createResourceName' add support for 'prefix' option ([570aca0](https://github.com/cloudlesslabs/pulumix/commit/570aca00df34567b33ffec2e3cc1c2fe45dd17e9))

### [0.9.5](https://github.com/cloudlesslabs/pulumix/compare/v0.9.4...v0.9.5) (2022-06-29)


### Bug Fixes

* API Gateway - Setting query strings or headers as required does nothing because the validator is not set ([3770830](https://github.com/cloudlesslabs/pulumix/commit/3770830a19f6bb2311409da6d4ed713fe0a665a1))

### [0.9.4](https://github.com/cloudlesslabs/pulumix/compare/v0.9.3...v0.9.4) (2022-06-29)


### Features

* API Gateway - Add support for required headers and query strings ([c5717d5](https://github.com/cloudlesslabs/pulumix/commit/c5717d5ba1ad04c41927edc0a3d4eaa3a1bfa906))

### [0.9.3](https://github.com/cloudlesslabs/pulumix/compare/v0.9.2...v0.9.3) (2022-06-24)


### Bug Fixes

* Adding a DLQ to an SQS throw an 'waiting for SQS Queue' error ([119e159](https://github.com/cloudlesslabs/pulumix/commit/119e159c2f02e98d266813f9c9e62c4268ad4f16))

### [0.9.2](https://github.com/cloudlesslabs/pulumix/compare/v0.9.1...v0.9.2) (2022-06-24)


### Features

* Adds support for dead-letter queue on SNS and SQS ([eb7ca82](https://github.com/cloudlesslabs/pulumix/commit/eb7ca825134639ab7439e9510a1dbe7a79058578))

### [0.9.1](https://github.com/cloudlesslabs/pulumix/compare/v0.9.0...v0.9.1) (2022-06-23)

## [0.9.0](https://github.com/cloudlesslabs/pulumix/compare/v0.8.4...v0.9.0) (2022-06-23)


### Bug Fixes

* The Lambda failed to be created when using SQS event source mapping ([5dd39cb](https://github.com/cloudlesslabs/pulumix/commit/5dd39cb29e7be8977ba94079f0d1af60a383833a))

### [0.8.4](https://github.com/cloudlesslabs/pulumix/compare/v0.8.3...v0.8.4) (2022-06-23)


### Features

* Add support for SQS, dead-letter queue on both SQS and SNS topic subscriptions ([8c2530b](https://github.com/cloudlesslabs/pulumix/commit/8c2530b68ced222be7dd339403bb0bc924123f83))

### [0.8.3](https://github.com/cloudlesslabs/pulumix/compare/v0.8.2...v0.8.3) (2022-06-22)


### Features

* SNS - Add support for SQS subscriptions ([d154b02](https://github.com/cloudlesslabs/pulumix/commit/d154b02646f4f558e9ed5fd38334ddd1bf47ed04))

### [0.8.2](https://github.com/cloudlesslabs/pulumix/compare/v0.8.1...v0.8.2) (2022-06-17)


### Features

* Add support for API Gateway passthrough config ([cd7fb71](https://github.com/cloudlesslabs/pulumix/commit/cd7fb711b924e31d1aba104d71e6b3011723f7ab))

### [0.8.1](https://github.com/cloudlesslabs/pulumix/compare/v0.8.0...v0.8.1) (2022-06-17)


### Bug Fixes

* The sns.Topic class cannot be created ([29826e2](https://github.com/cloudlesslabs/pulumix/commit/29826e233f1062647ffecc2e3a64e42d7c255b15))

## [0.8.0](https://github.com/cloudlesslabs/pulumix/compare/v0.7.5...v0.8.0) (2022-06-17)


### Features

* Add support for SNS ([ba64534](https://github.com/cloudlesslabs/pulumix/commit/ba64534c0a220f272f24e57f48a62ce55ca6b9e1))

### [0.7.5](https://github.com/cloudlesslabs/pulumix/compare/v0.7.4...v0.7.5) (2022-06-17)


### Features

* Add support for configurable content-types on the API Gateway integration ([7d4941a](https://github.com/cloudlesslabs/pulumix/commit/7d4941aef108a2f31362988393d455567a1a47ea))

### [0.7.4](https://github.com/cloudlesslabs/pulumix/compare/v0.7.3...v0.7.4) (2022-06-16)


### Bug Fixes

* the createResourceName API does not manage empty input ([430104e](https://github.com/cloudlesslabs/pulumix/commit/430104e0e7c912d6cb1308982128bf406cb57d26))

### [0.7.3](https://github.com/cloudlesslabs/pulumix/compare/v0.7.2...v0.7.3) (2022-06-16)


### Bug Fixes

* The name should be passed to the enableCloudwatch API ([5b007a1](https://github.com/cloudlesslabs/pulumix/commit/5b007a1d5fb14e238c73f8a2a2d64d66eee93b89))

### [0.7.2](https://github.com/cloudlesslabs/pulumix/compare/v0.7.1...v0.7.2) (2022-06-15)


### Bug Fixes

* Cannot read properties of undefined (reading 'delay') ([6337bfd](https://github.com/cloudlesslabs/pulumix/commit/6337bfd78aae05275af5a30a16f871bd0cccd339))

### [0.7.1](https://github.com/cloudlesslabs/pulumix/compare/v0.7.0...v0.7.1) (2022-06-15)


### Features

* API gateway - Add support for custom domain ([d44ea8c](https://github.com/cloudlesslabs/pulumix/commit/d44ea8cb5ad881f32746ac9bfe5e1d3499feac3a))

## [0.7.0](https://github.com/cloudlesslabs/pulumix/compare/v0.6.7...v0.7.0) (2022-06-15)


### Features

* Add support for API Gateway ([b0bc2e3](https://github.com/cloudlesslabs/pulumix/commit/b0bc2e32340b8b8818577e0b65f9d3f95adec642))

### [0.6.7](https://github.com/cloudlesslabs/pulumix/compare/v0.6.6...v0.6.7) (2022-06-08)


### Bug Fixes

* The entry point is incorrect ([4b2aa77](https://github.com/cloudlesslabs/pulumix/commit/4b2aa7747df5e21a0d18dd2d110eb6210008cdea))

### [0.6.6](https://github.com/cloudlesslabs/pulumix/compare/v0.6.5...v0.6.6) (2022-06-08)


### Bug Fixes

* unable to validate AWS AccessKeyID and/or SecretAccessKey ([5bc8bd4](https://github.com/cloudlesslabs/pulumix/commit/5bc8bd4168a7bebf973109e6b54d06a96f9d9f7e))

### [0.6.5](https://github.com/cloudlesslabs/pulumix/compare/v0.6.4...v0.6.5) (2022-06-08)


### Bug Fixes

* The ./aws/index.js file is missing ([f1c2fad](https://github.com/cloudlesslabs/pulumix/commit/f1c2fadcf6110955b776bddd6189baa17d1be9a1))

### [0.6.4](https://github.com/cloudlesslabs/pulumix/compare/v0.6.3...v0.6.4) (2022-06-08)

### [0.6.3](https://github.com/cloudlesslabs/pulumix/compare/v0.6.2...v0.6.3) (2022-06-07)

### [0.6.2](https://github.com/cloudlesslabs/pulumix/compare/v0.6.1...v0.6.2) (2022-06-07)


### Features

* core API - Add support for 'createResourceName' function ([cf3a003](https://github.com/cloudlesslabs/pulumix/commit/cf3a00308e18110ad1e8e19bac4e437c16a64f5a))

### [0.6.1](https://github.com/cloudlesslabs/pulumix/compare/v0.6.0...v0.6.1) (2022-06-07)


### Bug Fixes

* 1 high severity vulnerability: node_modules/protobufjs ([f2904ff](https://github.com/cloudlesslabs/pulumix/commit/f2904ff00fef00401de8a7ef3ceebc5b7b0e8492))

## [0.6.0](https://github.com/cloudlesslabs/pulumix/compare/v0.5.11...v0.6.0) (2022-06-01)

### [0.5.11](https://github.com/cloudlesslabs/pulumix/compare/v0.5.10...v0.5.11) (2022-05-30)


### Bug Fixes

* keepResourcesOnly is not a function in aurora.js ([afa9768](https://github.com/cloudlesslabs/pulumix/commit/afa9768214d2d0624cf9ad293fa7f4b3310b369c))

### [0.5.10](https://github.com/cloudlesslabs/pulumix/compare/v0.5.9...v0.5.10) (2022-05-27)


### Bug Fixes

* Lambda constructor does not accept Output policies ([bd730fa](https://github.com/cloudlesslabs/pulumix/commit/bd730fa65aefb63b24593131165aa6f461026bc5))

### [0.5.9](https://github.com/cloudlesslabs/pulumix/compare/v0.5.8...v0.5.9) (2022-05-27)

### [0.5.8](https://github.com/cloudlesslabs/pulumix/compare/v0.5.7...v0.5.8) (2022-05-25)


### Bug Fixes

* Including non-resource objects in the dependsOn break constructors ([ca06102](https://github.com/cloudlesslabs/pulumix/commit/ca061028d02fdd41818697343582d7087d01b483))

### [0.5.7](https://github.com/cloudlesslabs/pulumix/compare/v0.5.6...v0.5.7) (2022-05-25)


### Bug Fixes

* Lambda - The 'vpcConfig.subnets' resources are not added in the lambda's dependsOn list ([c3c1fa6](https://github.com/cloudlesslabs/pulumix/commit/c3c1fa6aca8e8da894abdaf5f9ab449a4b6cac5e))

### [0.5.6](https://github.com/cloudlesslabs/pulumix/compare/v0.5.5...v0.5.6) (2022-05-24)


### Bug Fixes

* Aurora API is not respecting the dependency order forcing the user to deploy the stack multiple times to make it work. Use the 'dependsOn' property to explicitly define the dependency tree ([d110f28](https://github.com/cloudlesslabs/pulumix/commit/d110f28f2c22c409f2a13004c524e72aa45ade53))
* Filter dependencies that are not of type pulumi.Resource or pulumi.CustomResource in the Lambda constructor ([5c897ed](https://github.com/cloudlesslabs/pulumix/commit/5c897ed0462ecdc70e70ad9df46ff2c8d718349e))
* The Aurora constructor does not return any instance ([c493892](https://github.com/cloudlesslabs/pulumix/commit/c493892cfcf331a59f18c1c66965701edeb6d40d))

### [0.5.5](https://github.com/cloudlesslabs/pulumix/compare/v0.5.4...v0.5.5) (2022-05-24)

### [0.5.4](https://github.com/cloudlesslabs/pulumix/compare/v0.5.2...v0.5.4) (2022-05-24)


### Bug Fixes

* Lambda is not working at all ([e5cf554](https://github.com/cloudlesslabs/pulumix/commit/e5cf5540e26794b0b2107c7bae77cc6ce946ded1))

### [0.5.2](https://github.com/cloudlesslabs/pulumix/compare/v0.5.1...v0.5.2) (2022-05-23)


### Features

* Add support for configuring Lambda VPC config from subnet resources on top of the usual subnet IDs ([fd1058d](https://github.com/cloudlesslabs/pulumix/commit/fd1058db9b85832186cd68a15091790975597609))

### [0.5.1](https://github.com/cloudlesslabs/pulumix/compare/v0.5.0...v0.5.1) (2022-05-23)


### Bug Fixes

* Incorrect security group name ([ba16de5](https://github.com/cloudlesslabs/pulumix/commit/ba16de54c3e8e6ab7f765952f0f54eda6f7a2f0b))

## [0.5.0](https://github.com/cloudlesslabs/pulumix/compare/v0.4.2...v0.5.0) (2022-05-23)

### [0.4.2](https://github.com/cloudlesslabs/pulumix/compare/v0.4.1...v0.4.2) (2022-05-20)


### Bug Fixes

* Attaching a policy to a lambda via the 'attachPolicy' method does not support policy output type ([6ab58d9](https://github.com/cloudlesslabs/pulumix/commit/6ab58d9efed08b595a38771e04d6928313a2e22f))

### [0.4.1](https://github.com/cloudlesslabs/pulumix/compare/v0.4.0...v0.4.1) (2022-05-20)


### Features

* Add support for attaching a policy to a lambda based on the policy definition only ([ed797f7](https://github.com/cloudlesslabs/pulumix/commit/ed797f7e2530091bdcf1acfd90a3d85dc169ab32))

## [0.4.0](https://github.com/cloudlesslabs/pulumix/compare/v0.3.3...v0.4.0) (2022-05-20)


### Features

* Add support for attaching a new policy on a Lambda ([f00c130](https://github.com/cloudlesslabs/pulumix/commit/f00c13018a1122c40944090f061177b30ae76970))

### [0.3.3](https://github.com/cloudlesslabs/pulumix/compare/v0.3.2...v0.3.3) (2022-05-19)


### Features

* Add a new 'hostedUI' property in the Cognito App object ([4439022](https://github.com/cloudlesslabs/pulumix/commit/44390226128fdea120d8ff39c481e961993b775e))

### [0.3.2](https://github.com/cloudlesslabs/pulumix/compare/v0.3.1...v0.3.2) (2022-05-15)

### [0.3.1](https://github.com/cloudlesslabs/pulumix/compare/v0.3.0...v0.3.1) (2022-05-15)


### Features

* Add new helpers to universally get a consistent project, stack and stack reference regardless of the backend type ([1a4b6ab](https://github.com/cloudlesslabs/pulumix/commit/1a4b6ab996b344e9d261935a93288d065d94f5d8))

## [0.3.0](https://github.com/cloudlesslabs/pulumix/compare/v0.2.1...v0.3.0) (2022-05-11)


### Features

* Rename s3.bucket to s3.Website ([61edd92](https://github.com/cloudlesslabs/pulumix/commit/61edd9282ca319a18ecc499f449d66cc1479e903))

### [0.2.1](https://github.com/cloudlesslabs/pulumix/compare/v0.2.0...v0.2.1) (2022-05-11)


### Features

* Add support for Output as property values for the appSync.Api object ([3b62137](https://github.com/cloudlesslabs/pulumix/commit/3b621374b0485cf3d4b77e97c9383f515e0bdd50))

## [0.2.0](https://github.com/cloudlesslabs/pulumix/compare/v0.1.4...v0.2.0) (2022-05-10)


### Features

* Add support for Cognito ([a822c78](https://github.com/cloudlesslabs/pulumix/commit/a822c78f2a45ff5c4a89d5a793097781f29ffdf7))

### [0.1.4](https://github.com/cloudlesslabs/pulumix/compare/v0.1.3...v0.1.4) (2022-05-06)


### Bug Fixes

* The docker.buildAndPushImage output is incorrectly parsed from a string to an array of characters ([466dd35](https://github.com/cloudlesslabs/pulumix/commit/466dd35d3c5dae6037384e30ddd53fb2352e8737))

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
