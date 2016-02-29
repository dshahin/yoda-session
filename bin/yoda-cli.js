#!/usr/bin/env node

var yoda = require('../lib/yoda-lib');

yoda.main().then(function(userInfo){
	yoda.userGreeting(userInfo);
}).catch(function(error){
	console.error('error');
});
