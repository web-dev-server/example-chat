var WebDevServer = require("web-dev-server");

WebDevServer.Server.CreateNew()
	.SetDocumentRoot(__dirname) // required
	.SetPort(8000)              // optional, 8000 by default
	// .SetDomain('localhost')  // optional, 127.0.0.1 by default
	// .SetDevelopment(false)   // optional, true by default to display Errors and directory content
	.Run();