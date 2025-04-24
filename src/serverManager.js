const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../servers.json');

function readConfig() {
  const data = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(data);
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getEnabledCount(config) {
  return config.servers.filter(s => s.enabled).length;
}

function listServers(req, res) {
  const config = readConfig();
  res.json({
    tool_limit: config.tool_limit,
    servers: config.servers
  });
}

function enableServer(req, res) {
  const { name } = req.body;
  const config = readConfig();
  const enabledCount = getEnabledCount(config);
  const server = config.servers.find(s => s.name === name);
  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }
  if (server.enabled) {
    return res.json({ message: 'Server already enabled' });
  }
  if (enabledCount >= config.tool_limit) {
    return res.status(400).json({ error: 'Tool limit reached. Disable another server first.' });
  }
  server.enabled = true;
  writeConfig(config);
  res.json({ message: 'Server enabled', servers: config.servers });
}

function disableServer(req, res) {
  const { name } = req.body;
  const config = readConfig();
  const server = config.servers.find(s => s.name === name);
  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }
  if (!server.enabled) {
    return res.json({ message: 'Server already disabled' });
  }
  server.enabled = false;
  writeConfig(config);
  res.json({ message: 'Server disabled', servers: config.servers });
}

module.exports = { listServers, enableServer, disableServer };
