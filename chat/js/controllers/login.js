app.controller('Login', [
	'$scope', '$controller', '$http', '$rootScope', 
	function($, $controller, $http, $rootScope) {
	
	// převezmutí funkcí z Base ctrl
	angular.extend(this, $controller('Base', {$scope: $}));
	
	$.loginHandler = function () {
		localStorage[$rootScope.LS_USERNAME_KEY] = $.username;
		$rootScope.username = $.username;
		
		$.go('chat');
	};
	
}]);