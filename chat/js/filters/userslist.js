app.filter('userslist',[function(){
    return function (onlineUsers){
        return onlineUsers.join(', ');
    }
}]);