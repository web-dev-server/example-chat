var WebDevServer = require("web-dev-server");

var devServer = (new WebDevServer())
	.SetDocumentRoot(__dirname)
	.SetPort(8888)
	.Run();