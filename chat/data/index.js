var WebSocketServer = require('ws').Server;
var WebDevServer = require("web-dev-server");
//var WebDevServer = require("../../../web-dev-server/build/lib/Server");


var App = function () {
	this.wsServer = null;
	this.onlineUsers = {};
	this.onlineUsersCount = 0;
	this.allMessages = [];
};
App.prototype = {
	Start (server, firstRequest, firstResponse) {
		console.log("Initializing websocket serverving:");
		this.wsServer = new WebSocketServer({ server: server.GetHttpServer() });
		this.wsServer.on('connection', function (ws, req) {
			this.wsHandleConnection(ws, req)
		}.bind(this));
	},
	Stop (server) {
		console.log("Closing websocket serverving:");
		this.wsServer.close(function () {
			server.Stop();
		}.bind(this));
	},
	wsHandleConnection: function (ws, req) {
		WebDevServer.Session.Start(req).then(function (session) {
			var sessionId = session.GetId();
			var sessionNamespace = session.GetNamespace("chat");
				
			if (!sessionNamespace.authenticated) {
				console.log("Connected not authorized user with session id: " + sessionId);
				ws.close(4000, 'Not authorized session.');
				return;
			}

			console.log("Connected authorized user with session id: " + sessionId);

			this.sendToCurrentClient('connection', {
				message: 'Welcome, you are connected.'
			}, ws);
			
			ws.on('message', function (str, bufferCont) {
				try {
					this.webSocketOnMessage(str, bufferCont, sessionId, ws);
				} catch (e) {
					console.log(e, e.stack);
				}
			}.bind(this));
			
			ws.on('close', function () {
				try {
					this.webSocketOnClose(sessionId);
				} catch (e) {
					console.log(e, e.stack);
				}
			}.bind(this));
			
		}.bind(this));
	},
	webSocketOnMessage: function (str, bufferCont, sessionId, ws) {
		
		var sendedData = null;
		try {
			sendedData = JSON.parse(str);
		} catch (e) {
			console.log(e);
			ws.send('{"eventName":"error","message":"Bad user input: ' + e.message.replace(/"/g, "&quot;") + '"}');
			return;
		}
		
		var eventName = sendedData.eventName,
			data = sendedData.data,
			userId = data.userId,
			username = data.username;
		
		if (eventName == 'login') {
			this.webSocketOnMessageEventLogin(data, userId, username, sessionId, ws);
		} else if (eventName == 'chatting') {
			this.webSocketOnMessageEventChatting(data, userId, username, sessionId, ws);
		}
	},
	webSocketOnMessageEventLogin: function (data, userId, username, sessionId, ws) {
		if (typeof(this.onlineUsers[userId]) == 'undefined') {
			this.onlineUsers[userId] = {
				sessionId: sessionId,
				username: username,
				ws: ws
			};
			this.updateOnlineUsersCount();
		}
		
		this.sendToAllClients('login', {
			users: this.completeOnlineUsersForClient(), 
			recepients: this.completeRecepientsForClient(),
			usersCount: this.onlineUsersCount, 
			userId: userId,
			username: username,
			messages: this.allMessages
		});
		
		var joinMessage = {
			type: 'notify',
			content: username + ' joined the chat room',
			userId: userId,
			username: username,
			recepient: 'all',
			id: this.allMessages.length
		}
		this.allMessages.push(joinMessage);
		this.sendToAllClients('chatting', joinMessage);
		
		console.log(username + ' joined the chat room');
	},
	webSocketOnMessageEventChatting: function (data, userId, username, sessionId, ws) {
		var recepient = typeof(data.recepient) != 'undefined' 
			? data.recepient 
			: 'all';
			
		// add unique message id:
		data.type = 'content';
		data.id = this.allMessages.length;
		this.allMessages.push(data);
		
		if (recepient == 'all') {
			this.sendToAllClients('chatting', data);
		} else {
			if (typeof(this.onlineUsers[recepient]) != 'undefined')
				this.sendToSingleClient('chatting', data, this.onlineUsers[recepient].sessionId);
			this.sendToCurrentClient('chatting', data, ws);
		}
		console.log(data.username + ': ' + data.content);
	},
	webSocketOnClose: function (sessionId) {
		// session id authorization boolean to false after user is disconnected
		
		var onlineUser = {}, 
			userToDelete = {}, 
			uidToDelete = '';
		for (var uid in this.onlineUsers) {
			onlineUser = this.onlineUsers[uid];
			if (sessionId != onlineUser.sessionId) continue;
			userToDelete = onlineUser;
			uidToDelete = uid;
			break;
		}
		
		delete this.onlineUsers[uidToDelete];
		this.updateOnlineUsersCount();
		
		this.sendToAllClients('logout', {
			users: this.completeOnlineUsersForClient(), 
			recepients: this.completeRecepientsForClient(),
			usersCount: this.onlineUsersCount, 
			userId: userToDelete.userId,
			username: userToDelete.username,
			messages: this.allMessages
		});
		
		var leaveMessage = {
			type: 'notify',
			content: userToDelete.username + ' leave the chat room',
			userId: userToDelete.userId,
			username: userToDelete.username,
			recepient: 'all',
			id: this.allMessages.length
		}
		this.allMessages.push(leaveMessage);
		this.sendToAllClients('chatting', leaveMessage);
		
		console.log(onlineUser.username + ' exited the chat room');
	},
	sendToAllClients: function (eventName, data) {
		var responseStr = JSON.stringify({
			eventName: eventName,
			data: data
		});
		var onlineUser = {};
		for (var userId in this.onlineUsers) {
			onlineUser = this.onlineUsers[userId];
			if (onlineUser.ws) 
				onlineUser.ws.send(responseStr);
		}
	},
	sendToSingleClient: function (eventName, data, targetSessionId) {
		var responseStr = JSON.stringify({
			eventName: eventName,
			data: data
		});
		var onlineUser = {};
		for (var userId in this.onlineUsers) {
			onlineUser = this.onlineUsers[userId];
			if (onlineUser.sessionId === targetSessionId) {
				if (onlineUser.ws) 
					onlineUser.ws.send(responseStr);
				break;
			}
		}
	},
	sendToCurrentClient: function (eventName, data, ws) {
		var responseStr = JSON.stringify({
			eventName: eventName,
			data: data
		});
		ws.send(responseStr);
	},
	HttpHandle: function (request, response) {
		return new Promise(function (resolve, reject) {
			if (request.IsCompleted()) {
				this.authorizeHttpRequest(request, response, resolve, reject);
			} else {
				request.GetBody().then(function (body) {
					this.authorizeHttpRequest(request, response, resolve, reject);
				}.bind(this));
			}
		}.bind(this));
	},
	authorizeHttpRequest: function (request, response, resolve, reject) {
		var userId = String((+new Date) + Math.random()).replace('.','');
		var passwordStr = request.GetParam('password', false);
		
		
		
		
		// HERE IS PERFECT PLACE TO GET ANY CREDENTIALS FROM DATABASE:
		
		
		
		
		
		if (passwordStr == '1234') {
			// after session is authorized - set session id authorization boolean to true:
			WebDevServer.Session.Start(request, response).then(function(session) {
				var sessionNamespace = session.GetNamespace("chat");

				sessionNamespace.userId = userId
				sessionNamespace.authenticated = true;
				
				response.SetBody(
					'{"success":true,"message":"Password is correct.","userId":"' + userId + '"}'
				).Send();
				resolve();
			}.bind(this));
		} else {
			response.SetBody('{"success":false,"message":"Wrong password."}').Send();
			resolve();
		}
	},
	updateOnlineUsersCount: function () {
		var i = 0;
		for (var key in this.onlineUsers) {
			if (
				typeof(this.onlineUsers[key]) != 'undefined' && 
				typeof(this.onlineUsers[key].username) != 'undefined'
			) i++;
		}
		this._onlineUsersCount = i;
	},
	completeRecepientsForClient: function () {
		var result = [], onlineUser = {};
		for (var uid in this.onlineUsers) {
			onlineUser = this.onlineUsers[uid];
			result.push({
				userId: uid,
				username: onlineUser.username
			});
		};
		return result;
	},
	completeOnlineUsersForClient: function () {
		var result = [];
		for (var uid in this.onlineUsers) {
			result.push(this.onlineUsers[uid].username);
		}
		return result;
	}
};

module.exports = App;