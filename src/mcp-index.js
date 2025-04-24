/**
 * Auto Tool Switcher MCP Server
 * Pure MCP stdio implementation without HTTP server
 */
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { log, ensureLogFile } = require('./logger');
const mcpClient = require('./mcpClient');
const { getServersConfig } = require('./utils');

// Ensure log file exists
ensureLogFile();

// Log startup information
log('[MCP] Starting MCP stdio server...');
log('[MCP] Node version:', process.version);
log('[MCP] Current working directory:', process.cwd());
log('[MCP] Process arguments:', process.argv);
log('[MCP] Environment:', process.env.NODE_ENV || 'development');

// Log file system access
const LOG_PATH = path.resolve(__dirname, '../auto-tool-switcher.log');
try {
  const stat = fs.statSync(LOG_PATH);
  log('[MCP] Log file exists:', LOG_PATH);
  log('[MCP] Log file size:', stat.size, 'bytes');
} catch (e) {
  log('[MCP] Creating new log file:', LOG_PATH);
  fs.writeFileSync(LOG_PATH, '');
}

// Log required files
const requiredFiles = ['package.json', 'servers.json'];
requiredFiles.forEach(file => {
  try {
    const filePath = path.resolve(__dirname, '../', file);
    fs.accessSync(filePath);
    log('[MCP] Found required file:', filePath);
  } catch (e) {
    log('[ERROR] Missing required file:', file);
  }
});

// Cache for tools from each server
let toolsCache = {
  builtIn: [
    {
      name: 'servers_list',
      description: 'List all available MCP servers',
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
    }
  ],
  servers: {} // Will store tools for each server by server name
};

// Set up readline interface for reading from stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Handle incoming messages
rl.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    log('[MCP] Received message:', message);
    
    handleMcpMessage(message, (response) => {
      sendResponse(response);
    });
  } catch (error) {
    log('[ERROR] Error processing message:', error);
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
  log('[MCP] Process exiting, closing readline interface');
  rl.close();
});

// Send response to stdout
function sendResponse(response) {
  log('[MCP] Sending response:', response);
  // Use process.stdout.write to avoid adding newlines
  process.stdout.write(JSON.stringify(response) + '\n');
}

// MCP message handler function
function handleMcpMessage(message, callback) {
  if (!message.jsonrpc || message.jsonrpc !== '2.0') {
    return callback({
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
    log('[MCP] Handling initialize request');
    return callback({
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
    log('[MCP] Handling tools/list request');
    
    // Get all enabled servers
    const { getEnabledServers } = require('./utils');
    const enabledServers = getEnabledServers();
    log(`[MCP] Found ${enabledServers.length} enabled servers`);
    
    // Update the tools cache if needed
    updateToolsCache(enabledServers).then(() => {
      // Get all tools from the cache
      const allTools = getAllCachedTools();
      
      // Send the combined tools list
      callback({
        jsonrpc: '2.0',
        result: {
          tools: allTools
        },
        id: message.id
      });
    }).catch(error => {
      log(`[ERROR] Failed to update tools cache:`, error);
      // Fall back to just our built-in tools if there was an error
      callback({
        jsonrpc: '2.0',
        result: {
          tools: toolsCache.builtIn
        },
        id: message.id
      });
    });
    
    // Return undefined to prevent immediate response
    // The response will be sent by the Promise chain above
    return undefined;
  }
  
  // Handle tools/call
  if (message.method === 'tools/call') {
    log('[MCP] Handling tools/call request');
    const toolName = message.params?.name;
    const toolParams = message.params?.parameters || {};
    
    // Handle the request asynchronously
    handleToolCall(toolName, toolParams, message.id, callback);
    
    // Return undefined to prevent immediate response
    // The response will be sent by the handleToolCall function
    return undefined;
  }
}

/**
 * Handle a tool call asynchronously
 * @param {string} toolName - Name of the tool to call
 * @param {Object} toolParams - Tool parameters
 * @param {string|number} messageId - ID of the original message
 * @param {Function} callback - Function to call with the response
 */
async function handleToolCall(toolName, toolParams, messageId, callback) {
  try {
    
    // Handle our built-in tools
    if (toolName === 'servers_list') {
      const config = getServersConfig();
      callback({
        jsonrpc: '2.0',
        result: {
          data: config
        },
        id: messageId
      });
      return;
    }
    
    if (toolName === 'servers_enable' && toolParams.name) {
      const { enableServer } = require('./serverManager');
      try {
        const result = enableServer(toolParams.name);
        callback({
          jsonrpc: '2.0',
          result: {
            data: result
          },
          id: messageId
        });
        return;
      } catch (error) {
        callback({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error.message || 'Internal error'
          },
          id: messageId
        });
        return;
      }
    }
    
    if (toolName === 'servers_disable' && toolParams.name) {
      const { disableServer } = require('./serverManager');
      try {
        const result = disableServer(toolParams.name);
        callback({
          jsonrpc: '2.0',
          result: {
            data: result
          },
          id: messageId
        });
        return;
      } catch (error) {
        callback({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error.message || 'Internal error'
          },
          id: messageId
        });
        return;
      }
    }
    
    // Handle passthrough tools from other servers
    // Parse the tool name to extract server and actual tool name
    const match = toolName.match(/^([a-z0-9_]+)_(.+)$/);
    if (match) {
      const serverPrefix = match[1];
      const actualToolName = match[2];
      
      // Find the server with this prefix
      const { getEnabledServers } = require('./utils');
      const enabledServers = getEnabledServers();
      const server = enabledServers.find(s => 
        s.name.toLowerCase().replace(/\s+/g, '_') === serverPrefix);
      
      if (server) {
        log(`[MCP] Passing through tool call to server ${server.name}: ${actualToolName}`);
        const mcpClient = require('./mcpClient');
        
        try {
          // Call the tool on the target server
          const result = await mcpClient.callTool(server.url, actualToolName, toolParams);
          
          callback({
            jsonrpc: '2.0',
            result: {
              data: result
            },
            id: messageId
          });
          return;
        } catch (error) {
          log(`[ERROR] Error calling tool on server ${server.name}:`, error);
          callback({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: `Error calling tool on server ${server.name}: ${error.message}`
            },
            id: messageId
          });
          return;
        }
      }
    }
    
    // If we get here, the tool wasn't found
    callback({
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: 'Method not found'
      },
      id: messageId
    });
  } catch (error) {
    log('[ERROR] Unexpected error handling tool call:', error);
    callback({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: `Internal error: ${error.message}`
      },
      id: messageId
    });
  }
  
  // Handle update/tools notification
  if (message.method === 'update/tools' && !message.id) {
    log('[MCP] Received update/tools notification');
    // This is a notification, so we don't need to send a response
    // Just update our tools cache
    const { getEnabledServers } = require('./utils');
    const enabledServers = getEnabledServers();
    updateToolsCache(enabledServers);
    return undefined;
  }
  
  // Default response for unhandled methods
  log('[MCP] Unhandled method:', message.method);
  callback({
    jsonrpc: '2.0',
    error: {
      code: -32601,
      message: 'Method not found'
    },
    id: message.id || null
  });
}

// Log all uncaught errors and promise rejections
process.on('uncaughtException', err => {
  log('[ERROR] Uncaught exception:', err.stack || err);
});
process.on('unhandledRejection', err => {
  log('[ERROR] Unhandled rejection:', err && err.stack || err);
});

// Log process exit
process.on('exit', code => {
  log('[MCP] Process exiting with code:', code);
});

/**
 * Update the tools cache for all enabled servers
 * @param {Array} enabledServers - List of enabled servers
 * @returns {Promise} Promise that resolves when all tools are fetched
 */
async function updateToolsCache(enabledServers) {
  const mcpClient = require('./mcpClient');
  
  // Use Promise.all to fetch tools from all enabled servers in parallel
  const toolArrays = await Promise.all(enabledServers.map(async (server) => {
    try {
      log(`[MCP] Fetching tools from server: ${server.name} at ${server.url}`);
      const tools = await mcpClient.getToolsList(server.url);
      
      // Prefix tool names with server name to avoid conflicts
      const serverTools = tools.map(tool => ({
        ...tool,
        name: `${server.name.toLowerCase().replace(/\s+/g, '_')}_${tool.name}`,
        description: `[${server.name}] ${tool.description}`
      }));
      
      // Update the cache for this server
      toolsCache.servers[server.name] = serverTools;
      
      return serverTools;
    } catch (error) {
      log(`[ERROR] Failed to fetch tools from server ${server.name}:`, error);
      // If we already have tools for this server in the cache, keep them
      return toolsCache.servers[server.name] || [];
    }
  }));
  
  // Flatten the array of arrays into a single array of tools
  const allServerTools = toolArrays.flat();
  log(`[MCP] Cached ${allServerTools.length} tools from enabled servers`);
  
  return allServerTools;
}

/**
 * Get all tools from the cache
 * @returns {Array} Combined list of built-in and server tools
 */
function getAllCachedTools() {
  // Get all server tools from the cache
  const serverTools = Object.values(toolsCache.servers).flat();
  
  // Combine built-in tools with server tools
  return [...toolsCache.builtIn, ...serverTools];
}

// Log process signals
process.on('SIGINT', () => {
  log('[MCP] Received SIGINT signal');
  process.exit(0);
});
process.on('SIGTERM', () => {
  log('[MCP] Received SIGTERM signal');
  process.exit(0);
});

// Log memory usage periodically
setInterval(() => {
  const mem = process.memoryUsage();
  log('[MCP] Memory usage:', {
    rss: (mem.rss / 1024 / 1024).toFixed(2) + ' MB',
    heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
    heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2) + ' MB'
  });
}, 30000); // Log every 30 seconds

// Send an initial notification to stdout to help with debugging
process.stdout.write(JSON.stringify({
  jsonrpc: '2.0',
  method: 'notification',
  params: {
    message: 'MCP server ready for connection'
  }
}) + '\n');

log('[MCP] Waiting for client messages...');
