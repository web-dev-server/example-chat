var SocketWrapper = Class({
	Static: {
		RECONNECT_TIMEOUT: 1000, // 1s
		GetInstance: function (url) {
			if (typeof(this._instances[url]) == 'undefined') new this.self(url);
			return this._instances[url];
		},
		_instances: {}
	},
	Constructor: function (url) {
		this._url = url;
		this._socket = null;
		this._opened = false;
		this._sendQueue = [];
		this._callbacks = {};
		
		this.self._instances[url] = this;
		
		if (this._connect()) {
			this._socket.addEventListener('open', this._onOpenHandler.bind(this));
			this._socket.addEventListener('error', this._onErrorHandler.bind(this));
			this._socket.addEventListener('close', this._onCloseHandler.bind(this));
			this._socket.addEventListener('message', this._onMessageHandler.bind(this));
		}
	},
	_connect: function () {
		var r = true;
		try {
			this._socket = new WebSocket(this._url);
		} catch (e) {
			console.log(e);
			r = false;
		}
		return r;
	},
	_onOpenHandler: function (event) {
    	var eventName = 'open', callbacks = [];
    	this._opened = true;
	    if (typeof(this._callbacks[eventName]) != 'undefined') {
	    	this._processCallbacks(this._callbacks[eventName], [event]);
	    }
	    if (this._sendQueue.length) {
	    	for (var i = 0, l = this._sendQueue.length; i < l; i++) {
	    		this._socket.send(this._sendQueue[i]);
	    	}
		    this._sendQueue = [];
	    }
	},
	_onErrorHandler: function (event) {
		var eventName = 'error', callbacks = [], intId = 0;
    	this._opened = false;
	    if (typeof(this._callbacks[eventName]) != 'undefined') {
	    	this._processCallbacks(this._callbacks[eventName], [event]);
	    }
	    intId = setInterval(function(){
	    	if (this._connect()) {
	    		clearInterval(intId);
	    	};
	    }.bind(this), this.self.RECONNECT_TIMEOUT);
	},
	_onCloseHandler: function (event) {
    	var eventName = 'close', callbacks = [];
    	this._opened = false;
	    if (typeof(this._callbacks[eventName]) != 'undefined') {
	    	this._processCallbacks(this._callbacks[eventName], [event]);
	    }
	},
	_onMessageHandler: function (event) {
	    var result = [],
	    	eventName = '',
	    	data = null,
	    	callbacks = [];
		try {
			result = JSON.parse(event.data);
			eventName = result.eventName;
			data = result.data;
		} catch (e) {
			console.log(e, e.stack);
		}
		if (!eventName) {
			console.log("Server data should be in JS array formated like: ['eventName', {any:'data',as:'object'}]");
		} else if (typeof(this._callbacks[eventName]) != 'undefined') {
	    	this._processCallbacks(this._callbacks[eventName], [data]);
	    } else {
	    	console.log("No callback found for socket event: '" + eventName + "', url: '" + this._url + "'.", data);
	    }
	},
	_processCallbacks: function (callbacks, args) {
		var cb = function () {};
		for (var i = 0, l = callbacks.length; i < l; i++) {
			cb = callbacks[i];
			cb.apply(null, args);
		}
	},
	send: function (eventName, data) {
		var str = JSON.stringify({eventName: eventName, data: data});
		if (this._opened) {
			this._socket.send(str);
		} else {
			this._sendQueue.push(str);
		};
		return this;
	},
	close: function (code, reason) {
		this._socket.close(code, reason);
		this._sendQueue = [];
	},
	bind: function (eventName, callback) {
		if (typeof(this._callbacks[eventName]) == 'undefined') {
			this._callbacks[eventName] = [];
		}
		this._callbacks[eventName].push(callback);
		return this;
	},
	unbind: function (eventName, callback) {
		if (typeof(this._callbacks[eventName]) == 'undefined') {
			this._callbacks[eventName] = [];
		}
		var callbacks = this._callbacks[eventName], cb = function () {};
		for (var i = 0, l = callbacks.length; i < l; i++) {
			cb = callbacks[i];
			if (cb == callback) {
				delete this._callbacks[eventName][i];
				break;
			}
		}
		if (this._callbacks[eventName].length == 0) {
			delete this._callbacks[eventName];
		};
		return this;
	}
});