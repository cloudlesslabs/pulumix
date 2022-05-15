# PULUMIX - PULUMI RECIPES

```
npm i @cloudlessopenlabs/pulumix
```

This NodeJS package exposes a series of wrappers around the Pulumi APIs to help facilitate the provisionning of common Cloud resources. Examples:

### AWS Security Group incl. its rules

```js
const { aws: { SecurityGroup } } = require('@cloudlessopenlabs/pulumix')

const sg = new SecurityGroup({
	name: `my-special-sg`, 
	description: `Controls something special.`, 
	vpcId: 'vpc-1234', 
	egress: [{  
		protocol: '-1',  
		fromPort:0, toPort:65535, cidrBlocks: ['0.0.0.0/0'],  
		ipv6CidrBlocks: ['::/0'],  
		description:'Allow all traffic' 
	}], 
	tags: {
		Project: 'demo'
	}
})

console.log(sg)
// {
// 	id: Output<String>,
// 	arn: : Output<String>,
// 	name: : Output<String>,
// 	description: : Output<String>,
// 	rules: : Output<[SecurityGroupRule]>
// }
```


The full documentation for this package is located in the project's wiki: https://github.com/cloudlesslabs/pulumix/wiki/

This wiki contains the following sections:

- [0. CORE APIs](https://github.com/cloudlesslabs/pulumix/wiki/0.-CORE-APIs): Core APIs applicable to any Cloud provider.
- [A. AWS](https://github.com/cloudlesslabs/pulumix/wiki/A.-AWS): AWS modules
- [B. GCP](https://github.com/cloudlesslabs/pulumix/wiki/B.-GCP): GCP modules
- [W. Docker](https://github.com/cloudlesslabs/pulumix/wiki/W.-Docker): Docker modules
- [X. Annexes](https://github.com/cloudlesslabs/pulumix/wiki/X.-Annexes): Pulumi related information:
	- [Common Pulumi code snippets](https://github.com/cloudlesslabs/pulumix/wiki/X.-Annexes#common-pulumi-code-snippets)
	- [NPM package.json scripts](https://github.com/cloudlesslabs/pulumix/wiki/X.-Annexes#npm-packagejson-scripts): Commonly used NPM scripts to automate Pulumi operations.
	- [Automation API](https://github.com/cloudlesslabs/pulumix/wiki/X.-Annexes#automation-api): That's the Pulumi API used to provision infrastructure on-the-fly.