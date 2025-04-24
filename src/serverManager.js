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
  if (res) {
    res.json({
      tool_limit: config.tool_limit,
      servers: config.servers
    });
  }
  return {
    tool_limit: config.tool_limit,
    servers: config.servers
  };
}

function enableServer(nameOrReq, res) {
  // Handle both direct function calls and HTTP requests
  const name = typeof nameOrReq === 'string' ? nameOrReq : nameOrReq.body.name;
  
  const config = readConfig();
  const enabledCount = getEnabledCount(config);
  const server = config.servers.find(s => s.name === name);
  
  if (!server) {
    const error = { error: `Server '${name}' not found` };
    if (res) res.status(404).json(error);
    throw new Error(error.error);
  }
  
  if (server.enabled) {
    const result = { message: `Server '${name}' is already enabled` };
    if (res) res.json(result);
    return result;
  }
  
  if (enabledCount >= config.tool_limit) {
    const error = { error: `Tool limit (${config.tool_limit}) reached. Disable another server first.` };
    if (res) res.status(400).json(error);
    throw new Error(error.error);
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
  
  const result = { message: `Server '${name}' enabled`, servers: config.servers };
  if (res) res.json(result);
  return result;
}

function disableServer(nameOrReq, res) {
  // Handle both direct function calls and HTTP requests
  const name = typeof nameOrReq === 'string' ? nameOrReq : nameOrReq.body.name;
  
  const config = readConfig();
  const server = config.servers.find(s => s.name === name);
  
  if (!server) {
    const error = { error: `Server '${name}' not found` };
    if (res) res.status(404).json(error);
    throw new Error(error.error);
  }
  
  if (!server.enabled) {
    const result = { message: `Server '${name}' is already disabled` };
    if (res) res.json(result);
    return result;
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
  
  const result = { message: `Server '${name}' disabled`, servers: config.servers };
  if (res) res.json(result);
  return result;
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
