/**
 * MCP Client module for the Cascade MCP Server
 * Handles communication with other MCP servers
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { log } = require('./logger');
const { getMcpConfig } = require('./config');

/**
 * Fetch tools from a server
 * @param {Object} server - Server configuration
 * @returns {Promise<Array>} List of tools
 */
async function fetchToolsFromServer(server) {
  return new Promise((resolve, reject) => {
    log(`Fetching tools from server: ${server.name} at ${server.url}`);
    
    // Check if we need to start a child process or use HTTP
    if (server.url.startsWith('http://') || server.url.startsWith('https://')) {
      // HTTP/HTTPS server - use REST API
      fetchToolsViaHttp(server).then(resolve).catch(reject);
    } else {
      // Local server - use child process
      fetchToolsViaChildProcess(server).then(resolve).catch(reject);
    }
  });
}

/**
 * Fetch tools from an HTTP/HTTPS server
 * @param {Object} server - Server configuration
 * @returns {Promise<Array>} List of tools
 */
async function fetchToolsViaHttp(server) {
  return new Promise((resolve, reject) => {
    log(`Fetching tools via HTTP from: ${server.name} at ${server.url}`);
    
    // Create a simple request to the server's tools/list endpoint
    const requestData = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/list',
      params: {}
    });
    
    // Parse the URL to determine protocol
    const serverUrl = new URL(server.url);
    const options = {
      hostname: serverUrl.hostname,
      port: serverUrl.port,
      path: '/mcp',  // Standard MCP endpoint
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };
    
    // Choose http or https based on protocol
    const requester = serverUrl.protocol === 'https:' ? https : http;
    
    const req = requester.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.result && response.result.tools) {
            // Add server name prefix to each tool
            const tools = response.result.tools.map(tool => {
              // Create a prefixed version of the tool
              return {
                ...tool,
                name: `${server.name.toLowerCase().replace(/\\s+/g, '_')}_${tool.name}`,
                description: `[From ${server.name}] ${tool.description || ''}`
              };
            });
            resolve(tools);
          } else {
            reject(new Error(`Invalid response from server: ${data}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      log(`Error fetching tools from ${server.name}:`, error);
      reject(error);
    });
    
    // Set a timeout
    req.setTimeout(5000, () => {
      req.abort();
      reject(new Error(`Request to ${server.name} timed out`));
    });
    
    req.write(requestData);
    req.end();
  });
}

/**
 * Fetch tools using a child process
 * @param {Object} server - Server configuration
 * @returns {Promise<Array>} List of tools
 */
async function fetchToolsViaChildProcess(server) {
  return new Promise((resolve, reject) => {
    log(`Fetching tools via child process from: ${server.name}`);
    
    try {
      // Get the server configuration from mcp-config.json
      const mcpConfig = getMcpConfig();
      const serverConfig = mcpConfig.mcpServers[server.name];
      
      if (!serverConfig) {
        return reject(new Error(`Server ${server.name} not found in MCP config`));
      }
      
      // Spawn the child process
      const childProcess = spawn(
        serverConfig.command,
        serverConfig.args || [],
        {
          cwd: serverConfig.cwd || process.cwd(),
          env: { ...process.env, ...(serverConfig.env || {}) },
          stdio: ['pipe', 'pipe', 'pipe']
        }
      );
      
      // Set up readline to parse JSON-RPC messages
      const readline = require('readline');
      const rl = readline.createInterface({
        input: childProcess.stdout,
        terminal: false
      });
      
      // Send initialize request
      const initRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      }) + '\n';
      
      childProcess.stdin.write(initRequest);
      
      // Send tools/list request after initialization
      const toolsRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      }) + '\n';
      
      let initialized = false;
      let tools = [];
      
      // Process responses
      rl.on('line', (line) => {
        try {
          const response = JSON.parse(line);
          
          // Handle initialization response
          if (response.id === 1 && response.result) {
            log(`Server ${server.name} initialized successfully`);
            initialized = true;
            childProcess.stdin.write(toolsRequest);
          }
          
          // Handle tools/list response
          if (response.id === 2 && response.result && response.result.tools) {
            // Add server name prefix to each tool
            tools = response.result.tools.map(tool => ({
              ...tool,
              name: `${server.name.toLowerCase().replace(/\\s+/g, '_')}_${tool.name}`,
              description: `[From ${server.name}] ${tool.description || ''}`
            }));
            
            log(`Received ${tools.length} tools from ${server.name}`);
            
            // Clean up and resolve
            childProcess.kill();
            rl.close();
            resolve(tools);
          }
        } catch (e) {
          log(`Error parsing response from ${server.name}: ${e.message}`);
          log(`Raw response: ${line}`);
        }
      });
      
      // Handle errors
      childProcess.on('error', (err) => {
        log(`Error with child process for ${server.name}: ${err.message}`);
        reject(err);
      });
      
      // Handle process exit
      childProcess.on('exit', (code) => {
        if (code !== 0 && tools.length === 0) {
          reject(new Error(`Server ${server.name} exited with code ${code}`));
        }
      });
      
      // Set a timeout
      setTimeout(() => {
        if (tools.length === 0) {
          childProcess.kill();
          rl.close();
          reject(new Error(`Timeout waiting for response from ${server.name}`));
        }
      }, 5000);
    } catch (e) {
      log(`Error fetching tools via child process: ${e.message}`);
      reject(e);
    }
  });
}

/**
 * Forward a tool call to the appropriate server
 * @param {Object} server - Server configuration
 * @param {string} toolName - Name of the tool to call
 * @param {Object} toolParams - Tool parameters
 * @param {number} messageId - Message ID
 * @returns {Promise<Object>} Tool call response
 */
async function forwardToolCall(server, toolName, toolParams, messageId) {
  return new Promise((resolve, reject) => {
    log(`Forwarding tool call to ${server.name} at ${server.url}: ${toolName}`);
    
    // Check if we need to use HTTP or child process
    if (server.url.startsWith('http://') || server.url.startsWith('https://')) {
      // HTTP/HTTPS server
      forwardToolCallViaHttp(server, toolName, toolParams, messageId).then(resolve).catch(reject);
    } else {
      // Local server - use child process
      forwardToolCallViaChildProcess(server, toolName, toolParams, messageId).then(resolve).catch(reject);
    }
  });
}

/**
 * Forward a tool call via HTTP
 * @param {Object} server - Server configuration
 * @param {string} toolName - Name of the tool to call
 * @param {Object} toolParams - Tool parameters
 * @param {number} messageId - Message ID
 * @returns {Promise<Object>} Tool call response
 */
async function forwardToolCallViaHttp(server, toolName, toolParams, messageId) {
  return new Promise((resolve, reject) => {
    log(`Forwarding tool call via HTTP to ${server.name} at ${server.url}: ${toolName}`);
    
    // Create the request to forward to the server
    const requestData = JSON.stringify({
      jsonrpc: '2.0',
      id: messageId,
      method: 'tools/call',
      params: {
        name: toolName,
        parameters: toolParams
      }
    });
    
    // Parse the URL to determine protocol
    const serverUrl = new URL(server.url);
    const options = {
      hostname: serverUrl.hostname,
      port: serverUrl.port,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };
    
    // Choose http or https based on protocol
    const requester = serverUrl.protocol === 'https:' ? https : http;
    
    const req = requester.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      log(`Error forwarding tool call to ${server.name}:`, error);
      reject(error);
    });
    
    // Set a timeout
    req.setTimeout(5000, () => {
      req.abort();
      reject(new Error(`Request to ${server.name} timed out`));
    });
    
    req.write(requestData);
    req.end();
  });
}

/**
 * Forward a tool call via child process
 * @param {Object} server - Server configuration
 * @param {string} toolName - Name of the tool to call
 * @param {Object} toolParams - Tool parameters
 * @param {number} messageId - Message ID
 * @returns {Promise<Object>} Tool call response
 */
async function forwardToolCallViaChildProcess(server, toolName, toolParams, messageId) {
  return new Promise((resolve, reject) => {
    log(`Forwarding tool call via child process to ${server.name}: ${toolName}`);
    
    try {
      // Get the server configuration from mcp-config.json
      const mcpConfig = getMcpConfig();
      const serverConfig = mcpConfig.mcpServers[server.name];
      
      if (!serverConfig) {
        return reject(new Error(`Server ${server.name} not found in MCP config`));
      }
      
      // Spawn the child process
      const childProcess = spawn(
        serverConfig.command,
        serverConfig.args || [],
        {
          cwd: serverConfig.cwd || process.cwd(),
          env: { ...process.env, ...(serverConfig.env || {}) },
          stdio: ['pipe', 'pipe', 'pipe']
        }
      );
      
      // Set up readline to parse JSON-RPC messages
      const readline = require('readline');
      const rl = readline.createInterface({
        input: childProcess.stdout,
        terminal: false
      });
      
      // Send initialize request
      const initRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      }) + '\n';
      
      childProcess.stdin.write(initRequest);
      
      let initialized = false;
      let responseReceived = false;
      
      // Process responses
      rl.on('line', (line) => {
        try {
          const response = JSON.parse(line);
          
          // Handle initialization response
          if (response.id === 1 && response.result) {
            log(`Server ${server.name} initialized successfully`);
            initialized = true;
            
            // Send the actual tool call
            const toolCallRequest = JSON.stringify({
              jsonrpc: '2.0',
              id: messageId,
              method: 'tools/call',
              params: {
                name: toolName,
                parameters: toolParams
              }
            }) + '\n';
            
            childProcess.stdin.write(toolCallRequest);
          }
          
          // Handle tool call response
          if (response.id === messageId) {
            log(`Received response from ${server.name} for tool ${toolName}`);
            responseReceived = true;
            
            // Clean up and resolve
            childProcess.kill();
            rl.close();
            resolve(response);
          }
        } catch (e) {
          log(`Error parsing response from ${server.name}: ${e.message}`);
          log(`Raw response: ${line}`);
        }
      });
      
      // Handle errors
      childProcess.on('error', (err) => {
        log(`Error with child process for ${server.name}: ${err.message}`);
        reject(err);
      });
      
      // Handle process exit
      childProcess.on('exit', (code) => {
        if (code !== 0 && !responseReceived) {
          reject(new Error(`Server ${server.name} exited with code ${code}`));
        }
      });
      
      // Set a timeout
      setTimeout(() => {
        if (!responseReceived) {
          childProcess.kill();
          rl.close();
          reject(new Error(`Timeout waiting for response from ${server.name}`));
        }
      }, 5000);
    } catch (e) {
      log(`Error forwarding tool call via child process: ${e.message}`);
      reject(e);
    }
  });
}

/**
 * Start all enabled MCP servers
 * @param {Array} servers - List of server configurations
 * @returns {Promise<Array>} List of started servers
 */
async function startEnabledServers(servers) {
  log('Starting all enabled MCP servers...');
  
  const enabledServers = servers.filter(server => server.enabled);
  log(`Found ${enabledServers.length} enabled servers`);
  
  const startPromises = enabledServers.map(async server => {
    try {
      log(`Starting server: ${server.name}`);
      
      // Skip if the server is HTTP/HTTPS (assumed to be running externally)
      if (server.url.startsWith('http://') || server.url.startsWith('https://')) {
        log(`Server ${server.name} is HTTP/HTTPS, assuming it's already running`);
        return { name: server.name, success: true, message: 'HTTP/HTTPS server, assumed running' };
      }
      
      // Get the server configuration from mcp-config.json
      const mcpConfig = getMcpConfig();
      const serverConfig = mcpConfig.mcpServers[server.name];
      
      if (!serverConfig) {
        log(`Server ${server.name} not found in MCP config`);
        return { name: server.name, success: false, message: 'Not found in MCP config' };
      }
      
      // Spawn the child process
      const childProcess = spawn(
        serverConfig.command,
        serverConfig.args || [],
        {
          cwd: serverConfig.cwd || process.cwd(),
          env: { ...process.env, ...(serverConfig.env || {}) },
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: true  // Allow the process to run independently
        }
      );
      
      // Set up error handling
      childProcess.on('error', (err) => {
        log(`Error starting ${server.name}: ${err.message}`);
      });
      
      // Log stdout and stderr
      childProcess.stdout.on('data', (data) => {
        log(`[${server.name}] stdout: ${data.toString().trim()}`);
      });
      
      childProcess.stderr.on('data', (data) => {
        log(`[${server.name}] stderr: ${data.toString().trim()}`);
      });
      
      // Unref the child process to allow the parent to exit independently
      childProcess.unref();
      
      log(`Server ${server.name} started successfully`);
      return { name: server.name, success: true, message: 'Started successfully' };
    } catch (error) {
      log(`Error starting server ${server.name}: ${error.message}`);
      return { name: server.name, success: false, message: error.message };
    }
  });
  
  return Promise.all(startPromises);
}

module.exports = {
  fetchToolsFromServer,
  forwardToolCall,
  startEnabledServers
};
