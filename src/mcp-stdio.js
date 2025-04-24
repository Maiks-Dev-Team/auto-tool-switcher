/**
 * Simple MCP server implementation using stdio transport
 * This follows the Model Context Protocol specification
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Setup logging
const LOG_PATH = path.resolve(__dirname, '../auto-tool-switcher.log');

// Ensure log file exists
function ensureLogFile() {
  try {
    if (!fs.existsSync(LOG_PATH)) {
      fs.writeFileSync(LOG_PATH, '', { encoding: 'utf8' });
      console.error(`Created log file at ${LOG_PATH}`);
    }
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
  
  const msg = `[${timestamp}] [MCP-STDIO] ${formattedArgs.join(' ')}`;
  
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
function getServersConfig() {
  try {
    const configPath = path.resolve(__dirname, '../servers.json');
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data).servers || [];
  } catch (e) {
    log('Error reading servers config:', e);
    return [];
  }
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
            name: 'servers/list',
            description: 'List all available MCP servers',
            parameters: {}
          },
          {
            name: 'servers/enable',
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
            name: 'servers/disable',
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
    
    if (toolName === 'servers/list') {
      const config = getServersConfig();
      return sendResponse({
        jsonrpc: '2.0',
        result: {
          data: config
        },
        id: message.id
      });
    }
    
    if (toolName === 'servers/enable' && toolParams.name) {
      return sendResponse({
        jsonrpc: '2.0',
        result: {
          data: { success: true, message: `Server ${toolParams.name} enabled` }
        },
        id: message.id
      });
    }
    
    if (toolName === 'servers/disable' && toolParams.name) {
      return sendResponse({
        jsonrpc: '2.0',
        result: {
          data: { success: true, message: `Server ${toolParams.name} disabled` }
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
  console.log(JSON.stringify(response));
}

// Log startup
log('MCP stdio server started');
log('Waiting for client messages...');
