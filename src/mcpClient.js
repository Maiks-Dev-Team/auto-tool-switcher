/**
 * MCP Client Implementation
 * Handles communication with other MCP servers
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { log } = require('./logger');

// Path to the MCP configuration file
const MCP_CONFIG_PATH = path.resolve(__dirname, '../mcp-config.json');

/**
 * Read the MCP configuration file
 * @returns {Object} MCP configuration object
 */
function readMcpConfig() {
  try {
    if (fs.existsSync(MCP_CONFIG_PATH)) {
      const data = fs.readFileSync(MCP_CONFIG_PATH, 'utf-8');
      return JSON.parse(data);
    }
    // If the file doesn't exist, create a default configuration
    const defaultConfig = {
      mcpServers: {}
    };
    fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    return defaultConfig;
  } catch (e) {
    log('[ERROR] Failed to read MCP configuration:', e);
    return { mcpServers: {} };
  }
}

/**
 * Write the MCP configuration to file
 * @param {Object} config - MCP configuration object
 */
function writeMcpConfig(config) {
  try {
    fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    log('[ERROR] Failed to write MCP configuration:', e);
  }
}

/**
 * Start an MCP server process
 * @param {string} serverName - Name of the server to start
 * @returns {Object|null} The spawned child process or null if failed
 */
function startMcpServer(serverName) {
  const config = readMcpConfig();
  const serverConfig = config.mcpServers[serverName];
  
  if (!serverConfig) {
    log(`[ERROR] Server "${serverName}" not found in MCP configuration`);
    return null;
  }
  
  try {
    log(`[MCP] Starting server "${serverName}"`);
    
    const childProcess = spawn(
      serverConfig.command,
      serverConfig.args || [],
      {
        cwd: serverConfig.cwd || process.cwd(),
        env: { ...process.env, ...(serverConfig.env || {}) },
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );
    
    // Set up a readline interface to parse JSON-RPC messages from stdout
    const readline = require('readline');
    const rl = readline.createInterface({
      input: childProcess.stdout,
      terminal: false
    });
    
    // Listen for JSON-RPC messages from the server
    rl.on('line', (line) => {
      try {
        const message = JSON.parse(line);
        
        // Handle update/tools notifications
        if (message.jsonrpc === '2.0' && message.method === 'update/tools' && !message.id) {
          log(`[${serverName}] Received update/tools notification`);
          // Forward this notification to our clients
          process.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            method: 'update/tools',
            params: message.params
          }) + '\n');
        }
      } catch (e) {
        // Not a valid JSON-RPC message, just log it
        log(`[${serverName}] [STDOUT] ${line}`);
      }
    });
    
    // Also log raw stderr
    childProcess.stderr.on('data', (data) => {
      log(`[${serverName}] [STDERR] ${data.toString().trim()}`);
    });
    
    // Handle process exit
    childProcess.on('exit', (code) => {
      log(`[MCP] Server "${serverName}" exited with code ${code}`);
      rl.close();
    });
    
    // Handle errors
    childProcess.on('error', (err) => {
      log(`[ERROR] Failed to start server "${serverName}":`, err);
      rl.close();
    });
    
    return childProcess;
  } catch (e) {
    log(`[ERROR] Failed to start server "${serverName}":`, e);
    return null;
  }
}

/**
 * Stop an MCP server process
 * @param {Object} process - The child process to stop
 */
function stopMcpServer(process) {
  if (process && !process.killed) {
    process.kill();
  }
}

/**
 * Send a JSON-RPC request to an MCP server
 * @param {string} url - URL of the MCP server
 * @param {string} method - JSON-RPC method
 * @param {Object} params - JSON-RPC parameters
 * @returns {Promise<Object>} Response from the server
 */
function sendJsonRpcRequest(url, method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now()
    });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };
    
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });
    
    req.on('error', (e) => {
      reject(new Error(`Request failed: ${e.message}`));
    });
    
    req.write(requestData);
    req.end();
  });
}

/**
 * Initialize an MCP server connection
 * @param {string} url - URL of the MCP server
 * @returns {Promise<Object>} Server information and capabilities
 */
async function initializeMcpServer(url) {
  try {
    const result = await sendJsonRpcRequest(url, 'initialize');
    log(`[MCP] Initialized server at ${url}:`, result);
    return result;
  } catch (e) {
    log(`[ERROR] Failed to initialize MCP server at ${url}:`, e);
    throw e;
  }
}

/**
 * Get the list of tools from an MCP server
 * @param {string} url - URL of the MCP server
 * @returns {Promise<Array>} List of tools
 */
async function getToolsList(url) {
  try {
    const result = await sendJsonRpcRequest(url, 'tools/list');
    log(`[MCP] Retrieved tools from ${url}:`, result.tools.length);
    return result.tools || [];
  } catch (e) {
    log(`[ERROR] Failed to get tools from MCP server at ${url}:`, e);
    return [];
  }
}

/**
 * Call a tool on an MCP server
 * @param {string} url - URL of the MCP server
 * @param {string} toolName - Name of the tool to call
 * @param {Object} parameters - Tool parameters
 * @returns {Promise<Object>} Tool result
 */
async function callTool(url, toolName, parameters = {}) {
  try {
    const result = await sendJsonRpcRequest(url, 'tools/call', {
      name: toolName,
      parameters
    });
    log(`[MCP] Called tool "${toolName}" on ${url}`);
    return result.data;
  } catch (e) {
    log(`[ERROR] Failed to call tool "${toolName}" on MCP server at ${url}:`, e);
    throw e;
  }
}

/**
 * Load all MCP servers from configuration and start them
 * @returns {Object} Map of server names to child processes
 */
function loadMcpServers() {
  const config = readMcpConfig();
  const serverProcesses = {};
  
  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    log(`[MCP] Loading server "${serverName}"`);
    const process = startMcpServer(serverName);
    if (process) {
      serverProcesses[serverName] = process;
    }
  }
  
  return serverProcesses;
}

/**
 * Stop all running MCP server processes
 * @param {Object} serverProcesses - Map of server names to child processes
 */
function stopAllMcpServers(serverProcesses) {
  for (const [serverName, process] of Object.entries(serverProcesses)) {
    log(`[MCP] Stopping server "${serverName}"`);
    stopMcpServer(process);
  }
}

module.exports = {
  readMcpConfig,
  writeMcpConfig,
  startMcpServer,
  stopMcpServer,
  initializeMcpServer,
  getToolsList,
  callTool,
  loadMcpServers,
  stopAllMcpServers
};
