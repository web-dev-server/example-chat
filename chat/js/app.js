var app = angular.module('App', ['ui.router']);

if (!location.hash.length) location.hash += '/';

app.config(['$stateProvider', function ($router) {
	$router
		.state('login', {
			url: '/',
			controller: 'Login',
			templateUrl: 'js/views/login.html'
		})
		.state('chat', {
			url: '/chat',
			controller: 'Chat',
			templateUrl: 'js/views/chat.html'
		});
}]);

app.run(['$rootScope', function($rootScope) {
	var currentFullPath = '//' + location.host + location.pathname;
	$rootScope.LOGIN_URL = location.protocol + currentFullPath + 'data/';
	$rootScope.WEBSOCKET_URL = 'ws:' + currentFullPath + 'data/';
	$rootScope.LS_USERNAME_KEY = 'username';
	$rootScope.username = localStorage[$rootScope.LS_USERNAME_KEY] || '' ;
}]);