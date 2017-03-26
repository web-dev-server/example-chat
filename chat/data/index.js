var WebSocketServer = require('ws').Server;

var App = function (httpServer, expressServer, sessionParser, request, response) {
	this._init(httpServer, expressServer, sessionParser, request, response);
};
App.prototype = {
	_allowedSessionIds: {},
	_httpServer: null,
	_expressServer: null,
	_wss: null,
	_sessionParser: null,
	_onlineUsers: {},
	_onlineUsersCount: 0,
	_allMessages: [],
	_init: function (httpServer, expressServer, sessionParser, request, response) {
		this._httpServer = httpServer;
		this._expressServer = expressServer;
		this._sessionParser = sessionParser;
		console.log("Initializing websocket serverving:");
		this._wss = new WebSocketServer({ server: httpServer });
		this._wss.on('connection', function (ws) {
			this._sessionParser(
				ws.upgradeReq, {}, this._webSocketConnectionHandler.bind(this, ws)
			);
		}.bind(this));
	},
	_webSocketConnectionHandler: function (ws) {
		var sessionId = ws.upgradeReq.session.id;
		if (typeof(this._allowedSessionIds[sessionId]) == 'undefined') {
			console.log("Connected not authorized user with session id: " + sessionId);
			ws.close(4000, 'Not authorized session.');
			
		} else if (this._allowedSessionIds[sessionId]){
			console.log("Connected authorized user with session id: " + sessionId);
			
			this._sendToCurrentClient('connection', {
				message: 'Welcome, you are connected.'
			}, ws);
			
			ws.on('message', function (str, bufferCont) {
				try {
					this._webSocketOnMessage(str, bufferCont, sessionId, ws);
				} catch (e) {
					console.log(e, e.stack);
				}
			}.bind(this));
			
			ws.on('close', function () {
				try {
					this._webSocketOnClose(sessionId);
				} catch (e) {
					console.log(e, e.stack);
				}
			}.bind(this));
		}
	},
	_webSocketOnMessage: function (str, bufferCont, sessionId, ws) {
		
		var sendedData = null;
		try {
			sendedData = JSON.parse(str);
		} catch (e) {
			console.log(e);
			ws.send('{"eventName":"error","message":"Bad user input: ' + e.message.replace(/"/g, "&quot;") + '"}');
			return;
		}
		
		var eventName = sendedData.eventName;
		var data = sendedData.data;
		var userid = data.userid;
		var username = data.username;
		
		if (eventName == 'login') {
			this._webSocketOnMessageEventLogin(data, userid, username, sessionId, ws);
		} else if (eventName == 'chatting') {
			this._webSocketOnMessageEventChatting(data, userid, username, sessionId, ws);
		}
	},
	_webSocketOnMessageEventLogin: function (data, userid, username, sessionId, ws) {
		if (typeof(this._onlineUsers[userid]) == 'undefined') {
			this._onlineUsers[userid] = {
				sessionId: sessionId,
				username: username
			};
			this._updateOnlineUsersCount();
		}
		
		this._sendToAllClients('login', {
			users: this._completeOnlineUsersForClient(), 
			recepients: this._completeRecepientsForClient(),
			usersCount: this._onlineUsersCount, 
			userid: userid,
			username: username,
			messages: this._allMessages
		});
		
		var joinMessage = {
			type: 'notify',
			content: username + ' joined the chat room',
			userid: userid,
			username: username,
			recepient: 'all',
			id: this._allMessages.length
		}
		this._allMessages.push(joinMessage);
		this._sendToAllClients('chatting', joinMessage);
		
		console.log(username + ' joined the chat room');
	},
	_webSocketOnMessageEventChatting: function (data, userid, username, sessionId, ws) {
		var recepient = typeof(data.recepient) != 'undefined' ? data.recepient : 'all';
			
		// add unique message id:
		data.type = 'content';
		data.id = this._allMessages.length;
		this._allMessages.push(data);
		
		if (recepient == 'all') {
			this._sendToAllClients('chatting', data);
		} else {
			var targetSessionId = typeof(this._onlineUsers[recepient]) != 'undefined' ? this._onlineUsers[recepient].sessionId : '';
			this._sendToSingleClient('chatting', data, targetSessionId);
			this._sendToCurrentClient('chatting', data, ws);
		}
		console.log(data.username + ': ' + data.content);
	},
	_webSocketOnClose: function (sessionId) {
		// session id authorization boolean to false after user is disconnected
		this._allowedSessionIds[sessionId] = false;
		
		var onlineUser = {}, userToDelete = {}, uidToDelete = '';
		for (var uid in this._onlineUsers) {
			onlineUser = this._onlineUsers[uid];
			if (sessionId != onlineUser.sessionId) continue;
			userToDelete = onlineUser;
			uidToDelete = uid;
			break;
		}
		
		delete this._onlineUsers[uidToDelete];
		this._updateOnlineUsersCount();
		
		this._sendToAllClients('logout', {
			users: this._completeOnlineUsersForClient(), 
			recepients: this._completeRecepientsForClient(),
			usersCount: this._onlineUsersCount, 
			userid: userToDelete.userid,
			username: userToDelete.username,
			messages: this._allMessages
		});
		
		var leaveMessage = {
			type: 'notify',
			content: userToDelete.username + ' leave the chat room',
			userid: userToDelete.userid,
			username: userToDelete.username,
			recepient: 'all',
			id: this._allMessages.length
		}
		this._allMessages.push(leaveMessage);
		this._sendToAllClients('chatting', leaveMessage);
		
		console.log(onlineUser.username + ' exited the chat room');
	},
	_sendToAllClients: function (eventName, data) {
		var responseStr = JSON.stringify({
			eventName: eventName,
			data: data
		});
		this._wss.clients.forEach(function (client) {
			client.send(responseStr);
		}.bind(this));
	},
	_sendToSingleClient: function (eventName, data, targetSessionId) {
		var responseStr = JSON.stringify({
			eventName: eventName,
			data: data
		});
		var client;
		for (var i = 0, l = this._wss.clients.length; i < l; i += 1) {
			client = this._wss.clients[i];
			if (client.upgradeReq.sessionID == targetSessionId) {
				client.send(responseStr);
				break;
			}
		}
	},
	_sendToCurrentClient: function (eventName, data, ws) {
		var responseStr = JSON.stringify({
			eventName: eventName,
			data: data
		});
		ws.send(responseStr);
	},
	httpRequestHandler: function (request, response, callback) {
		this._completeWholeRequestInfo(request, function (requestInfo) {
			this._authorizeHttpRequest(requestInfo, response, callback);
		}.bind(this));
	},
	_authorizeHttpRequest: function (requestInfo, response, callback) {
		var request = requestInfo.request;
		var postData = null;
		try {
			postData = JSON.parse(requestInfo.textBody);
		} catch (e) {
			response.send('{"success":false,"message":"Bad user input: ' + e.message.replace(/"/g, "&quot;") + '"}');
			callback();
			return;
		}
		
		// HERE IS PERFECT PLACE TO GET ANY CREDENTIALS FROM DATABASE:
		
		
		
		
		
		
		
		
		if (postData.password == '1234') {
			// after session is authorized - set session id authorization boolean to true:
			this._allowedSessionIds[request.session.id] = true;
			request.session.userid = String((+new Date) + Math.random()).replace('.','');
			request.session.save();
			response.send('{"success":true,"message":"Password is correct.","userid":"' + request.session.userid + '"}');
		} else {
			response.send('{"success":false,"message":"Wrong password."}');
		}
		
		callback();
	},
	_completeWholeRequestInfo: function (request, callback) {
        var reqInfo = {
            url: request.url,
            method: request.method,
            headers: request.headers,
            statusCode: request.statusCode,
            textBody: ''
        };
        var bodyArr = [];
        request.on('error', function (err) {
            console.error(err);
        }).on('data', function (chunk) {
            bodyArr.push(chunk);
        }).on('end', function () {
            reqInfo.textBody = Buffer.concat(bodyArr).toString();
            reqInfo.request = request;
            callback(reqInfo);
        }.bind(this));
    },
	_updateOnlineUsersCount: function () {
		var i = 0;
		for (var key in this._onlineUsers) {
			if (typeof(this._onlineUsers[key]) != 'undefined' && typeof(this._onlineUsers[key].username) != 'undefined') i++;
		}
		this._onlineUsersCount = i;
	},
	_completeRecepientsForClient: function () {
		var result = [], onlineUser = {};
		for (var uid in this._onlineUsers) {
			onlineUser = this._onlineUsers[uid];
			result.push({
				userid: uid,
				username: onlineUser.username
			});
		};
		return result;
	},
	_completeOnlineUsersForClient: function () {
		var result = [];
		for (var uid in this._onlineUsers) {
			result.push(this._onlineUsers[uid].username);
		}
		return result;
	}
};

module.exports = App;