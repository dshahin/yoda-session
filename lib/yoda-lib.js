(function() {

var jsforce = require('jsforce');
var commandLineArgs = require('command-line-args');
var inquirer = require("inquirer");
var keychain = require('keychain');
var fs = require('fs');

var auth = {};

var conn = new jsforce.Connection();


var saveJSON = function(path, data){
	fs.writeFile(path, JSON.stringify(data));
};

var saveAuth = function(auth){
	saveJSON('./auth.json', auth);
};

var cli = commandLineArgs([
  { name: 'silent', alias: 's', type: Boolean, defaultOption :false},
  { name: 'user', alias: 'u', type: String}
]);

try{
	console.log('cwd',process.cwd());
	var pathToConfig ='auth.json';
	var authText = fs.readFileSync(pathToConfig, 'utf8');
	if(authText){
		auth = JSON.parse(authText );
	}
}catch(exception){
	console.log('no auth.json found:', pathToConfig);
}

if(auth.accessToken){
	conn = new jsforce.Connection({ 
		accessToken: auth.accessToken,
		serverUrl: auth.serverUrl
	});
}

var options = cli.parse();


var questions = [
	{
	  type: 'input',
	  name: 'username',
	  message: 'Enter your SFDC username',
	  default: process.env.SFDC_USERNAME || '(no env default set)'
	},
	{
	  type: 'password',
	  name: 'password',
	  message: 'Enter your SFDC password',
	  default: process.env.SFDC_PASSWORD
	}

];


var getAnswers = function(){
	return new Promise(function (resolve, reject) {
	  	inquirer.prompt(questions, function( answers ) {

		    if(typeof answers == 'object'){
		    	process.env.SFDC_USERNAME = answers.username;
		    	process.env.SFDC_PASSWORD = answers.password;

		    	keychain.setPassword({ account: answers.username, service: 'SFDC', password: answers.password }, function(err) {
		    		if(err) console.error('error', err);
		    	});
		    	resolve(answers);
		    }else{
		    	reject(answers);
		    }
		});

	});
};

var login = function(answers){
	conn.login(answers.username, answers.password, function(err, userInfo) {
			
		if (err) { 
			return console.error(err); 
		}

  		auth.accessToken = conn.accessToken;
  		auth.serverUrl = conn.instanceUrl ;

  		saveAuth(auth);

  		
	});
};

var promptLogin = function(){
	getAnswers().then(function(answers){		
		login(answers);
	}).then(null, function(err){
		console.error('error', err);
	});
};

var userGreeting = function(user){
	if(!options.silent){
		console.log('Hello', user.display_name  ,' [', user.username, '] ', user.user_id, '@', user.organization_id );
  	}
};

var handleConnectionError = function(err){
	console.log('there was an error', err);
	if(err.errorCode === 'INVALID_SESSION_ID'){
		console.log('Invalid or expired Session Id. Login again please.');
		promptLogin();
	}
};

var getPass = function(account){
	return new Promise(function (resolve, reject) {
	  	keychain.getPassword({ account:  account, service: 'SFDC' }, function(keychainError, pass) {
	  		if (keychainError){
	  			reject(keychainError);
	  		}else{
	  			resolve(pass);
	  		}

	  	});

	});
};

var main = function(){
	if(!options.silent){

		if(!auth.accessToken){

			console.log('no auth token found. please login');
			
			promptLogin();

		}else{
			console.log('using auth token');
			conn.identity().then(function(userInfo){
		  		userGreeting(userInfo);
		  	},handleConnectionError);
		}

	}else{
		
		var account = options.user || process.env.SFDC_USERNAME;
		//silent mode 
		var password = getPass(account).then(function(pass){
			conn.login(account, pass, function(err, res) {
				if (err) { return handleConnectionError(err); }
			 
			  	conn.identity().then(function(idInfo){
			  		console.log('idInfo', idInfo);
			  	},handleConnectionError);
			});
		});
		
	}
};
 
// Allows us to call this function from outside of the library file.
// Without this, the function would be private to this file.


exports.main = main;
exports.auth = auth;
exports.conn = conn;

})();