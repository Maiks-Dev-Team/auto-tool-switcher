/**
 * Cascade MCP Server for Auto Tool Switcher
 * 
 * This implementation follows the exact naming conventions expected by Cascade
 * and implements the MCP protocol correctly.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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
    
    // Define our tools with the correct naming convention
    const tools = [
      {
        name: 'mcp0_servers_list',
        description: 'List all available MCP servers',
        parameters: {}
      },
      {
        name: 'mcp0_servers_enable',
        description: 'Enable a specific MCP server',
        parameters: {}
      },
      {
        name: 'mcp0_servers_disable',
        description: 'Disable a specific MCP server',
        parameters: {}
      }
    ];
    
    log('Returning tools list:', tools);
    
    return sendResponse({
      jsonrpc: '2.0',
      result: {
        tools: tools
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
      const serverName = toolParams.name || 'MCP Beta';
      
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
      const serverName = toolParams.name || 'MCP Alpha';
      
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
