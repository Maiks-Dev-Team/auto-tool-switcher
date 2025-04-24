/**
 * Cascade MCP Server for Auto Tool Switcher
 * 
 * This implementation follows the exact naming conventions expected by Cascade
 * and implements the MCP protocol correctly.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const http = require('http');
const https = require('https');
const { URL } = require('url');

// Setup logging
const LOG_PATH = path.resolve(__dirname, './cascade-mcp-server.log');
fs.writeFileSync(LOG_PATH, '', { encoding: 'utf8' });

// Log function
function log(...args) {
  const timestamp = new Date().toISOString();
  const formattedArgs = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return '[Object]';
      }
    }
    return arg;
  });
  
  const msg = `[${timestamp}] ${formattedArgs.join(' ')}`;
  
  try {
    // Write to log file
    fs.appendFileSync(LOG_PATH, msg + '\n', { encoding: 'utf8' });
  } catch (e) {
    console.error(`Failed to write to log file: ${e.message}`);
  }
}

// Read server configuration
function getConfig() {
  try {
    const configPath = path.resolve(__dirname, './servers.json');
    log('Reading config from:', configPath);
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    log('Error reading servers config:', e);
    return { tool_limit: 60, servers: [] };
  }
}

// Fetch tools from a server
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

// Fetch tools from an HTTP/HTTPS server
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
                name: `${server.name.toLowerCase().replace(/\s+/g, '_')}_${tool.name}`,
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

// Fetch tools using a child process
async function fetchToolsViaChildProcess(server) {
  return new Promise((resolve, reject) => {
    log(`Fetching tools via child process from: ${server.name}`);
    
    try {
      // Get the server configuration from mcp-config.json
      const mcpConfigPath = path.resolve(__dirname, './mcp-config.json');
      let mcpConfig;
      
      try {
        const mcpConfigData = fs.readFileSync(mcpConfigPath, 'utf-8');
        mcpConfig = JSON.parse(mcpConfigData);
      } catch (e) {
        log(`Error reading MCP config: ${e.message}`);
        mcpConfig = { mcpServers: {} };
      }
      
      const serverConfig = mcpConfig.mcpServers[server.name];
      
      if (!serverConfig) {
        return reject(new Error(`Server ${server.name} not found in MCP config`));
      }
      
      // Spawn the child process
      const { spawn } = require('child_process');
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
              name: `${server.name.toLowerCase().replace(/\s+/g, '_')}_${tool.name}`,
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

// Forward a tool call to the appropriate server
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

// Forward a tool call via HTTP
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

// Forward a tool call via child process
async function forwardToolCallViaChildProcess(server, toolName, toolParams, messageId) {
  return new Promise((resolve, reject) => {
    log(`Forwarding tool call via child process to ${server.name}: ${toolName}`);
    
    try {
      // Get the server configuration from mcp-config.json
      const mcpConfigPath = path.resolve(__dirname, './mcp-config.json');
      let mcpConfig;
      
      try {
        const mcpConfigData = fs.readFileSync(mcpConfigPath, 'utf-8');
        mcpConfig = JSON.parse(mcpConfigData);
      } catch (e) {
        log(`Error reading MCP config: ${e.message}`);
        mcpConfig = { mcpServers: {} };
      }
      
      const serverConfig = mcpConfig.mcpServers[server.name];
      
      if (!serverConfig) {
        return reject(new Error(`Server ${server.name} not found in MCP config`));
      }
      
      // Spawn the child process
      const { spawn } = require('child_process');
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

// Save configuration to file
function saveConfig(config) {
  try {
    const configPath = path.resolve(__dirname, './servers.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (e) {
    log('Error writing servers config:', e);
    return false;
  }
}

// Count enabled servers
function getEnabledCount(config) {
  return config.servers.filter(s => s.enabled).length;
}

// Initialize readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Handle incoming messages
rl.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    log('Received message:', message);
    
    // Process the message
    processMessage(message);
  } catch (error) {
    log('Error processing message:', error);
    sendResponse({
      jsonrpc: '2.0',
      error: {
        code: -32700,
        message: 'Parse error'
      },
      id: null
    });
  }
});

// Process incoming messages
function processMessage(message) {
  if (!message.jsonrpc || message.jsonrpc !== '2.0') {
    return sendResponse({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request'
      },
      id: message.id || null
    });
  }
  
  // Handle initialization
  if (message.method === 'initialize') {
    log('Handling initialize request');
    return sendResponse({
      jsonrpc: '2.0',
      result: {
        serverInfo: {
          name: 'Auto Tool Switcher',
          version: '1.0.0'
        },
        capabilities: {
          tools: {
            supported: true
          }
        }
      },
      id: message.id
    });
  }
  
  // Handle tools/list
  if (message.method === 'tools/list') {
    log('Handling tools/list request');
    
    // Define our core tools with the correct naming convention
    const coreTools = [
      {
        name: 'mcp0_servers_list',
        description: 'List all available MCP servers',
        parameters: {}
      },
      {
        name: 'mcp0_servers_enable',
        description: 'Enable a specific MCP server',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the server to enable'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'mcp0_servers_disable',
        description: 'Disable a specific MCP server',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the server to disable'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'mcp0_refresh_tools',
        description: 'Refresh the list of tools from all enabled servers',
        parameters: {}
      }
    ];
    
    // Get tools from enabled servers
    const config = getConfig();
    const enabledServers = config.servers.filter(s => s.enabled);
    let serverTools = [];
    
    // For each enabled server, try to fetch its tools
    const fetchPromises = enabledServers.map(async server => {
      try {
        const tools = await fetchToolsFromServer(server);
        return tools;
      } catch (error) {
        log(`Error fetching tools from ${server.name}:`, error);
        return [];
      }
    });
    
    // Wait for all fetches to complete
    Promise.all(fetchPromises)
      .then(results => {
        // Flatten the array of arrays
        serverTools = results.flat();
        log(`Fetched ${serverTools.length} tools from ${enabledServers.length} enabled servers`);
        
        // Send update/tools notification
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          method: 'update/tools',
          params: {
            message: `Updated tool list with ${serverTools.length} tools from enabled servers`
          }
        }) + '\n');
      })
      .catch(error => {
        log('Error fetching tools from servers:', error);
      });
    
    // Combine core tools with any server tools we might already have
    const allTools = [...coreTools, ...serverTools];
    log(`Returning ${allTools.length} tools (${coreTools.length} core + ${serverTools.length} from servers)`);
    
    return sendResponse({
      jsonrpc: '2.0',
      result: {
        tools: allTools
      },
      id: message.id
    });
  }
  
  // Handle tools/call
  if (message.method === 'tools/call') {
    log('Handling tools/call request');
    const toolName = message.params?.name;
    const toolParams = message.params?.parameters || {};
    
    log(`Processing tool call for: ${toolName} with params:`, toolParams);
    
    if (toolName === 'mcp0_servers_list') {
      const config = getConfig();
      
      // Format the output to be more clear
      const formattedServers = config.servers.map(server => ({
        name: server.name,
        url: server.url,
        status: server.enabled ? 'ENABLED' : 'DISABLED'
      }));
      
      log('Formatted servers:', formattedServers);
      
      // Send update/tools notification to inform clients about available tools
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        method: 'update/tools',
        params: {
          message: `Refreshed server list. Found ${formattedServers.length} servers.`
        }
      }) + '\n');
      log('Sent update/tools notification after listing servers');
      
      // Return a more detailed and formatted response
      const response = {
        jsonrpc: '2.0',
        result: {
          data: {
            tool_limit: config.tool_limit,
            enabled_count: getEnabledCount(config),
            servers: formattedServers,
            message: `Found ${formattedServers.length} servers. ${getEnabledCount(config)} enabled out of limit ${config.tool_limit}.`
          }
        },
        id: message.id
      };
      
      log('Sending servers_list response:', response);
      return sendResponse(response);
    }
    
    if (toolName === 'mcp0_servers_enable') {
      const config = getConfig();
      const serverName = toolParams.name || 'MCP Alpha';
      
      log(`Enabling server: ${serverName}`);
      
      const server = config.servers.find(s => s.name === serverName);
      
      if (!server) {
        const errorResponse = {
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Server '${serverName}' not found`
          },
          id: message.id
        };
        log('Server not found, sending error:', errorResponse);
        return sendResponse(errorResponse);
      }
      
      if (server.enabled) {
        const alreadyEnabledResponse = {
          jsonrpc: '2.0',
          result: {
            data: { 
              success: true, 
              message: `Server '${serverName}' is already enabled`,
              server: {
                name: server.name,
                url: server.url,
                status: 'ENABLED'
              }
            }
          },
          id: message.id
        };
        log('Server already enabled, sending response:', alreadyEnabledResponse);
        return sendResponse(alreadyEnabledResponse);
      }
      
      const enabledCount = getEnabledCount(config);
      if (enabledCount >= config.tool_limit) {
        const limitResponse = {
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Tool limit (${config.tool_limit}) reached. Disable another server first.`
          },
          id: message.id
        };
        log('Tool limit reached, sending error:', limitResponse);
        return sendResponse(limitResponse);
      }
      
      server.enabled = true;
      saveConfig(config);
      
      // Send update/tools notification to inform clients about the change
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        method: 'update/tools',
        params: {
          message: `Server '${serverName}' enabled`
        }
      }) + '\n');
      log('Sent update/tools notification after enabling server');
      
      const successResponse = {
        jsonrpc: '2.0',
        result: {
          data: { 
            success: true, 
            message: `Server '${serverName}' enabled`,
            server: {
              name: server.name,
              url: server.url,
              status: 'ENABLED'
            }
          }
        },
        id: message.id
      };
      log('Server enabled successfully, sending response:', successResponse);
      return sendResponse(successResponse);
    }
    
    if (toolName === 'mcp0_servers_disable') {
      const config = getConfig();
      const serverName = toolParams.name || 'MCP Beta';
      
      log(`Disabling server: ${serverName}`);
      
      const server = config.servers.find(s => s.name === serverName);
      
      if (!server) {
        const errorResponse = {
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Server '${serverName}' not found`
          },
          id: message.id
        };
        log('Server not found, sending error:', errorResponse);
        return sendResponse(errorResponse);
      }
      
      if (!server.enabled) {
        const alreadyDisabledResponse = {
          jsonrpc: '2.0',
          result: {
            data: { 
              success: true, 
              message: `Server '${serverName}' is already disabled`,
              server: {
                name: server.name,
                url: server.url,
                status: 'DISABLED'
              }
            }
          },
          id: message.id
        };
        log('Server already disabled, sending response:', alreadyDisabledResponse);
        return sendResponse(alreadyDisabledResponse);
      }
      
      server.enabled = false;
      saveConfig(config);
      
      // Send update/tools notification to inform clients about the change
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        method: 'update/tools',
        params: {
          message: `Server '${serverName}' disabled`
        }
      }) + '\n');
      log('Sent update/tools notification after disabling server');
      
      const successResponse = {
        jsonrpc: '2.0',
        result: {
          data: { 
            success: true, 
            message: `Server '${serverName}' disabled`,
            server: {
              name: server.name,
              url: server.url,
              status: 'DISABLED'
            }
          }
        },
        id: message.id
      };
      log('Server disabled successfully, sending response:', successResponse);
      return sendResponse(successResponse);
    }
    
    // Handle refresh_tools
    if (toolName === 'mcp0_refresh_tools') {
      log('Handling refresh_tools request');
      
      // Send update/tools notification to inform clients about refreshed tools
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        method: 'update/tools',
        params: {
          message: `Refreshed tool cache. Checking for tools from all enabled servers.`
        }
      }) + '\n');
      log('Sent update/tools notification for refresh_tools');
      
      return sendResponse({
        jsonrpc: '2.0',
        result: {
          data: { 
            success: true, 
            message: `Refreshing tools from all enabled servers...`,
            enabled_servers: getEnabledCount(getConfig())
          }
        },
        id: message.id
      });
    }
    
    // Check if this is a tool from an enabled server
    // Extract the server prefix and actual tool name
    const parts = toolName.split('_');
    if (parts.length >= 2) {
      const serverPrefix = parts[0];
      const actualToolName = parts.slice(1).join('_');
      
      // Find the server by prefix
      const config = getConfig();
      const server = config.servers.find(s => 
        s.name.toLowerCase().replace(/\s+/g, '_') === serverPrefix && s.enabled
      );
      
      if (server) {
        log(`Detected server tool: ${toolName} -> ${server.name} / ${actualToolName}`);
        
        // Forward the request to the actual server
        forwardToolCall(server, actualToolName, toolParams, message.id)
          .then(response => {
            log(`Received response from ${server.name} for tool ${actualToolName}:`, response);
            sendResponse(response);
          })
          .catch(error => {
            log(`Error forwarding tool call to ${server.name}:`, error);
            sendResponse({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: `Error forwarding request to ${server.name}: ${error.message}`
              },
              id: message.id
            });
          });
        
        // Return here to prevent the default response
        return;
      }
    }
    
    // Default response for unknown tools
    return sendResponse({
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: 'Method not found'
      },
      id: message.id
    });
  }
  
  // Default response for unhandled methods
  log('Unhandled method:', message.method);
  sendResponse({
    jsonrpc: '2.0',
    error: {
      code: -32601,
      message: 'Method not found'
    },
    id: message.id || null
  });
}

// Send response to stdout
function sendResponse(response) {
  log('Sending response:', response);
  try {
    // Use process.stdout.write to avoid adding newlines
    process.stdout.write(JSON.stringify(response) + '\n');
  } catch (error) {
    log('Error sending response:', error);
  }
}

// Handle process exit
process.on('exit', () => {
  log('Process exiting, closing readline interface');
  rl.close();
});

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  log('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  log('Unhandled rejection at:', promise, 'reason:', reason);
});

// Log startup
log('Cascade MCP server started');
log('Node version:', process.version);
log('Process arguments:', process.argv);
log('Current working directory:', process.cwd());
log('Waiting for client messages...');

// Send an initial notification to stdout to help with debugging
process.stdout.write(JSON.stringify({
  jsonrpc: '2.0',
  method: 'notification',
  params: {
    message: 'Cascade MCP server ready for connection'
  }
}) + '\n');
