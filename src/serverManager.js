const fs = require('fs');
const path = require('path');
const { log } = require('./logger');
const mcpClient = require('./mcpClient');

const CONFIG_PATH = path.join(__dirname, '../servers.json');

// Map of server names to child processes
const serverProcesses = {};

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
  
  // Start the MCP server if it's defined in the MCP configuration
  const mcpConfig = mcpClient.readMcpConfig();
  if (mcpConfig.mcpServers && mcpConfig.mcpServers[name]) {
    log(`[MCP] Starting MCP server "${name}"`);
    const process = mcpClient.startMcpServer(name);
    if (process) {
      serverProcesses[name] = process;
      log(`[MCP] MCP server "${name}" started successfully`);
    } else {
      log(`[ERROR] Failed to start MCP server "${name}"`);
    }
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
  
  // Stop the MCP server if it's running
  if (serverProcesses[name]) {
    log(`[MCP] Stopping MCP server "${name}"`);
    mcpClient.stopMcpServer(serverProcesses[name]);
    delete serverProcesses[name];
    log(`[MCP] MCP server "${name}" stopped`);
  }
  
  server.enabled = false;
  writeConfig(config);
  res.json({ message: 'Server disabled', servers: config.servers });
}

/**
 * Initialize all enabled MCP servers
 */
function initializeEnabledServers() {
  const config = readConfig();
  const enabledServers = config.servers.filter(s => s.enabled);
  
  log(`[MCP] Initializing ${enabledServers.length} enabled MCP servers`);
  
  enabledServers.forEach(server => {
    const mcpConfig = mcpClient.readMcpConfig();
    if (mcpConfig.mcpServers && mcpConfig.mcpServers[server.name]) {
      log(`[MCP] Starting MCP server "${server.name}"`);
      const process = mcpClient.startMcpServer(server.name);
      if (process) {
        serverProcesses[server.name] = process;
        log(`[MCP] MCP server "${server.name}" started successfully`);
      } else {
        log(`[ERROR] Failed to start MCP server "${server.name}"`);
      }
    }
  });
}

/**
 * Shutdown all running MCP servers
 */
function shutdownAllServers() {
  log(`[MCP] Shutting down all MCP servers`);
  Object.entries(serverProcesses).forEach(([name, process]) => {
    log(`[MCP] Stopping MCP server "${name}"`);
    mcpClient.stopMcpServer(process);
    log(`[MCP] MCP server "${name}" stopped`);
  });
}

module.exports = { 
  listServers, 
  enableServer, 
  disableServer,
  initializeEnabledServers,
  shutdownAllServers
};
