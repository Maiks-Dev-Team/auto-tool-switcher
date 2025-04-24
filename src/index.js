const express = require('express');
const bodyParser = require('body-parser');
const { listServers, enableServer, disableServer } = require('./serverManager');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

app.get('/servers', listServers);
app.post('/servers/enable', enableServer);
app.post('/servers/disable', disableServer);

app.listen(PORT, () => {
  console.log(`MCP Auto Tool Switcher server running on port ${PORT}`);
});
