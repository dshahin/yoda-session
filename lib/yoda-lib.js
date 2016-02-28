(function() {

var jsforce = require('jsforce');
var commandLineArgs = require('command-line-args');
var inquirer = require("inquirer");
var keychain = require('keychain');
var fs = require('fs');

var auth_token_file = './.yoda_session.json';

var auth = {},
	user = {};

var conn = new jsforce.Connection();


var saveJSON = function(path, data){
	fs.writeFile(path, JSON.stringify(data));
};

var saveAuth = function(auth){
	saveJSON(auth_token_file, auth);
};

var cli = commandLineArgs([
  { name: 'silent', alias: 's', type: Boolean, defaultOption :false},
  { name: 'user', alias: 'u', type: String},
  { name: 'fail', alias: 'f', type: Boolean} //add garbage to session id
]);

try{
	console.log('cwd',process.cwd());

	var authText = fs.readFileSync(auth_token_file, 'utf8');
	if(authText){
		auth = JSON.parse(authText );
	}
}catch(exception){
	console.log('no auth_token_file found:', auth_token_file);
}


var options = cli.parse();

if(auth.accessToken){
	var creds = { 
		accessToken: auth.accessToken ,
		serverUrl: auth.serverUrl
	};
	if(options.fail){
		//force a bad token attempt
		creds.accessToken += 'foobar';
	}
	conn = new jsforce.Connection(creds);
	
}


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
	return new Promise(function (resolve, reject) {
		conn.login(answers.username, answers.password, function(err, userInfo) {
				
			if (err) { 
				console.log(err);
				reject(err); 
			}

	  		auth.accessToken = conn.accessToken;
	  		auth.serverUrl = conn.instanceUrl ;
	  		auth.username = answers.username ;

	  		saveAuth(auth);
	  		resolve(auth);
	  		
		});
	});
};

var promptLogin = function(){
	getAnswers().then(function(answers){		
		return login(answers);
	}).then(null, function(err){
		console.error('error', err);
	});
};

var userGreeting = function(user){
	if(!options.silent){
		console.log('Hello', user.display_name  ,' [', user.username, '] uid:', user.user_id, '@ oid:', user.organization_id );
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
		
		var account = options.user || auth.username || process.env.SFDC_USERNAME;

		if(!account){
			return console.error('please provide a username');
		}
		//silent mode 
		getPass(account).then(function(pass){
			if(options.fail){
				pass = 'foobar';
			}
			conn.login(account, pass, function(err, userInfo) {
				if (err) { return handleConnectionError(err); }
			 	user = userInfo;
			  	userGreeting(userInfo);
			});
		});
		
	}
};
 
// Allows us to call this function from outside of the library file.
// Without this, the function would be private to this file.


exports.main = main;
exports.auth = auth;
exports.conn = conn;
exports.user = user;

})();
