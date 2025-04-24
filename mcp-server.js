/**
 * Auto Tool Switcher MCP Server
 * Simple implementation of the Model Context Protocol
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const http = require('http');
const https = require('https');

// Setup logging
const LOG_PATH = path.resolve(__dirname, './auto-tool-switcher.log');

// Ensure log file exists
function ensureLogFile() {
  try {
    fs.writeFileSync(LOG_PATH, '', { encoding: 'utf8' });
    console.error(`Created log file at ${LOG_PATH}`);
    return true;
  } catch (e) {
    console.error(`Failed to create log file: ${e.message}`);
    return false;
  }
}

// Initialize log file
ensureLogFile();

// Log function with error handling
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
  
  const msg = `[${timestamp}] [AUTO-TOOL-SWITCHER] ${formattedArgs.join(' ')}`;
  
  try {
    // Also log to console for debugging
    console.error(msg);
    
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

// Global cache for tools from enabled servers
let cachedServerTools = [];

// Fetch tools from a server
async function fetchToolsFromServer(server) {
  return new Promise((resolve, reject) => {
    log(`Fetching tools from server: ${server.name} at ${server.url}`);
    
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

// Update cached tools from all enabled servers
async function updateCachedTools() {
  const config = getConfig();
  const enabledServers = config.servers.filter(s => s.enabled);
  
  log(`Updating tools from ${enabledServers.length} enabled servers`);
  cachedServerTools = [];
  
  for (const server of enabledServers) {
    try {
      const tools = await fetchToolsFromServer(server);
      cachedServerTools = cachedServerTools.concat(tools);
      log(`Added ${tools.length} tools from ${server.name}`);
    } catch (error) {
      log(`Failed to get tools from MCP server at ${server.url}:`, error);
    }
  }
  
  log(`Cached ${cachedServerTools.length} tools from enabled servers`);
  return cachedServerTools;
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
    
    handleMessage(message);
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

// Handle process exit
process.on('exit', () => {
  log('Process exiting, closing readline interface');
  rl.close();
});

// Handle message based on method
function handleMessage(message) {
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
    
    // Define our core tools
    const coreTools = [
      {
        name: 'servers_list',
        description: 'List all available MCP servers',
        parameters: {}
      },
      {
        name: 'mcp0_servers_list',
        description: 'This is a tool from the auto-tool-switcher MCP server.\nList all available MCP servers',
        parameters: {}
      },
      {
        name: 'servers_enable',
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
        name: 'mcp0_servers_enable',
        description: 'This is a tool from the auto-tool-switcher MCP server.\nEnable a specific MCP server',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'servers_disable',
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
        name: 'mcp0_servers_disable',
        description: 'This is a tool from the auto-tool-switcher MCP server.\nDisable a specific MCP server',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'refresh_tools',
        description: 'Refresh the list of tools from all enabled servers',
        parameters: {}
      },
      {
        name: 'mcp0_refresh_tools',
        description: 'This is a tool from the auto-tool-switcher MCP server.\nRefresh the list of tools from all enabled servers',
        parameters: {}
      }
    ];
    
    // Combine core tools with tools from enabled servers
    const allTools = [...coreTools, ...cachedServerTools];
    
    log(`Returning ${allTools.length} tools (${coreTools.length} core + ${cachedServerTools.length} from servers)`);
    
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
    
    if (toolName === 'servers_list' || toolName === 'mcp0_servers_list') {
      const config = getConfig();
      
      // Format the output to be more clear
      const formattedServers = config.servers.map(server => ({
        name: server.name,
        url: server.url,
        status: server.enabled ? 'ENABLED' : 'DISABLED',
        tools_count: server.enabled ? 'fetching...' : 'N/A'
      }));
      
      // Get tool counts for enabled servers (async, but we'll return immediately)
      updateCachedTools().then(() => {
        log(`Updated tool cache with ${cachedServerTools.length} tools`);
      }).catch(err => {
        log('Error updating tool cache:', err);
      });
      
      return sendResponse({
        jsonrpc: '2.0',
        result: {
          data: {
            tool_limit: config.tool_limit,
            enabled_count: getEnabledCount(config),
            servers: formattedServers,
            available_tools: cachedServerTools.length + 8 // 8 core tools
          }
        },
        id: message.id
      });
    }
    
    if (toolName === 'servers_enable' || toolName === 'mcp0_servers_enable') {
      // For mcp0_ prefixed tools, use a default server if name is not provided
      const serverName = toolParams.name || (toolName.startsWith('mcp0_') ? 'MCP Beta' : undefined);
      
      if (!serverName) {
        return sendResponse({
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Missing required parameter: name`
          },
          id: message.id
        });
      }
      
      const config = getConfig();
      const server = config.servers.find(s => s.name === serverName);
      
      if (!server) {
        return sendResponse({
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Server '${serverName}' not found`
          },
          id: message.id
        });
      }
      
      if (server.enabled) {
        return sendResponse({
          jsonrpc: '2.0',
          result: {
            data: { success: true, message: `Server '${serverName}' is already enabled` }
          },
          id: message.id
        });
      }
      
      const enabledCount = getEnabledCount(config);
      if (enabledCount >= config.tool_limit) {
        return sendResponse({
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Tool limit (${config.tool_limit}) reached. Disable another server first.`
          },
          id: message.id
        });
      }
      
      server.enabled = true;
      saveConfig(config);
      
      // Update the tool cache with tools from the newly enabled server
      updateCachedTools().then(() => {
        log(`Updated tool cache after enabling ${serverName}. Now have ${cachedServerTools.length} tools.`);
      }).catch(err => {
        log(`Error updating tool cache after enabling ${serverName}:`, err);
      });
      
      return sendResponse({
        jsonrpc: '2.0',
        result: {
          data: { 
            success: true, 
            message: `Server '${serverName}' enabled. Fetching tools from server...`,
            server: {
              name: server.name,
              url: server.url,
              status: 'ENABLED'
            }
          }
        },
        id: message.id
      });
    }
    
    if (toolName === 'servers_disable' || toolName === 'mcp0_servers_disable') {
      // For mcp0_ prefixed tools, use a default server if name is not provided
      const serverName = toolParams.name || (toolName.startsWith('mcp0_') ? 'MCP Alpha' : undefined);
      
      if (!serverName) {
        return sendResponse({
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Missing required parameter: name`
          },
          id: message.id
        });
      }
      
      const config = getConfig();
      const server = config.servers.find(s => s.name === serverName);
      
      if (!server) {
        return sendResponse({
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Server '${serverName}' not found`
          },
          id: message.id
        });
      }
      
      if (!server.enabled) {
        return sendResponse({
          jsonrpc: '2.0',
          result: {
            data: { success: true, message: `Server '${serverName}' is already disabled` }
          },
          id: message.id
        });
      }
      
      // Get the server prefix to remove its tools
      const serverPrefix = server.name.toLowerCase().replace(/\s+/g, '_');
      
      server.enabled = false;
      saveConfig(config);
      
      // Remove tools from this server from the cache
      const previousToolCount = cachedServerTools.length;
      cachedServerTools = cachedServerTools.filter(tool => !tool.name.startsWith(`${serverPrefix}_`));
      const removedCount = previousToolCount - cachedServerTools.length;
      
      log(`Removed ${removedCount} tools from ${serverName} after disabling`);
      
      return sendResponse({
        jsonrpc: '2.0',
        result: {
          data: { 
            success: true, 
            message: `Server '${serverName}' disabled. Removed ${removedCount} tools.`,
            server: {
              name: server.name,
              url: server.url,
              status: 'DISABLED'
            },
            removed_tools: removedCount
          }
        },
        id: message.id
      });
    }
    
    // Handle refresh_tools
    if (toolName === 'refresh_tools' || toolName === 'mcp0_refresh_tools') {
      log('Handling refresh_tools request');
      
      // Update the tool cache
      updateCachedTools().then(() => {
        log(`Refreshed tool cache. Now have ${cachedServerTools.length} tools.`);
      }).catch(err => {
        log('Error refreshing tool cache:', err);
      });
      
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
    const serverTool = cachedServerTools.find(tool => tool.name === toolName);
    if (serverTool) {
      log(`Handling request for server tool: ${toolName}`);
      // Extract the server prefix from the tool name
      const serverPrefix = toolName.split('_')[0];
      const actualToolName = toolName.substring(serverPrefix.length + 1);
      
      // Find the server by prefix
      const config = getConfig();
      const server = config.servers.find(s => 
        s.name.toLowerCase().replace(/\s+/g, '_') === serverPrefix && s.enabled
      );
      
      if (!server) {
        return sendResponse({
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Server for tool '${toolName}' not found or disabled`
          },
          id: message.id
        });
      }
      
      log(`Forwarding tool call to ${server.name} at ${server.url}: ${actualToolName}`);
      
      // Forward the request to the actual server
      // This would be implemented to forward the request and return the response
      // For now, just return a placeholder
      return sendResponse({
        jsonrpc: '2.0',
        result: {
          data: { 
            success: true, 
            message: `Tool call would be forwarded to ${server.name} for tool ${actualToolName}`,
            server: server.name,
            tool: actualToolName,
            params: toolParams
          }
        },
        id: message.id
      });
    }
    
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
  // Use process.stdout.write to avoid adding newlines
  process.stdout.write(JSON.stringify(response) + '\n');
}

// Log startup
log('MCP server started');
log('Node version:', process.version);
log('Process arguments:', process.argv);
log('Environment variables:', JSON.stringify({
  MCP_STDIO: process.env.MCP_STDIO,
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT
}));
log('Current working directory:', process.cwd());

// Initialize the tool cache on startup
updateCachedTools().then(() => {
  log(`Initialized tool cache with ${cachedServerTools.length} tools from enabled servers`);
}).catch(err => {
  log('Error initializing tool cache:', err);
});

log('Waiting for client messages...');

// Send an initial notification to stdout to help with debugging
process.stdout.write(JSON.stringify({
  jsonrpc: '2.0',
  method: 'notification',
  params: {
    message: 'MCP server ready for connection'
  }
}) + '\n');
