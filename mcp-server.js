/**
 * Auto Tool Switcher MCP Server
 * Simple implementation of the Model Context Protocol
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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
    return sendResponse({
      jsonrpc: '2.0',
      result: {
        tools: [
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
          }
        ]
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
      return sendResponse({
        jsonrpc: '2.0',
        result: {
          data: {
            tool_limit: config.tool_limit,
            servers: config.servers
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
      
      return sendResponse({
        jsonrpc: '2.0',
        result: {
          data: { success: true, message: `Server '${serverName}' enabled` }
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
      
      server.enabled = false;
      saveConfig(config);
      
      return sendResponse({
        jsonrpc: '2.0',
        result: {
          data: { success: true, message: `Server '${serverName}' disabled` }
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
log('Waiting for client messages...');

// Send an initial notification to stdout to help with debugging
process.stdout.write(JSON.stringify({
  jsonrpc: '2.0',
  method: 'notification',
  params: {
    message: 'MCP server ready for connection'
  }
}) + '\n');
