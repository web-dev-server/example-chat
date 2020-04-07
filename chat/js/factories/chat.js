var ChatService = function () {
	//this.open();
};
ChatService.prototype = {
	isOpened: false,
	_url: '',
	_loginCallback: null,
	_chattingCallback: null,
	_logoutCallback: null,
	open: function (url) {
		this._url = url || this._url;
		this.webSocket = null;
		this.webSocket = new SocketWrapper(this._url);
		// expecting events from server side:
		this.webSocket.bind('login', function (data) {
			this._loginCallback(data);
		}.bind(this));
		this.webSocket.bind('chatting', function (data) {
			this._chattingCallback(data);
		}.bind(this));
		this.webSocket.bind('logout', function (data) {
			this._logoutCallback(data);
		}.bind(this));
		this.isOpened = true;
		return this;
	},
	onLogin: function (cb) {
		this._loginCallback = cb;
		return this;
	},
	onChatting: function (cb) {
		this._chattingCallback = cb;
		return this;
	},
	onLogout: function (cb) {
		this._logoutCallback = cb;
		return this;
	},
	login: function (userId, username) {
		if (!this.isOpened) this.open();
		this.webSocket.send('login', {
			userId: userId,
			username: username
		});
		return this;
	},
	chatting: function (data) {
		if (!this.isOpened) this.open();
		this.webSocket.send('chatting', data);
		return this;
	},
	logout: function (userId, username) {
		this.webSocket.close(4000, 'Logout');
		this.isOpened = false;
		return this;
	}
};
app.factory('chatService', function() {
	return new ChatService();
})