app.controller('Base', [
	'$scope', '$state', '$rootScope',
	function ($, $state, $rootScope) {
		$.go = $state.go;
	}
]);