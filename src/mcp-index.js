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
    return callback({
      jsonrpc: '2.0',
      result: {
        tools: [
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
        ]
      },
      id: message.id
    });
  }
  
  // Handle tools/call
  if (message.method === 'tools/call') {
    log('[MCP] Handling tools/call request');
    const toolName = message.params?.name;
    const toolParams = message.params?.parameters || {};
    
    if (toolName === 'servers_list') {
      const config = getServersConfig();
      return callback({
        jsonrpc: '2.0',
        result: {
          data: config
        },
        id: message.id
      });
    }
    
    if (toolName === 'servers_enable' && toolParams.name) {
      const { enableServer } = require('./serverManager');
      try {
        const result = enableServer(toolParams.name);
        return callback({
          jsonrpc: '2.0',
          result: {
            data: result
          },
          id: message.id
        });
      } catch (error) {
        return callback({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error.message || 'Internal error'
          },
          id: message.id
        });
      }
    }
    
    if (toolName === 'servers_disable' && toolParams.name) {
      const { disableServer } = require('./serverManager');
      try {
        const result = disableServer(toolParams.name);
        return callback({
          jsonrpc: '2.0',
          result: {
            data: result
          },
          id: message.id
        });
      } catch (error) {
        return callback({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error.message || 'Internal error'
          },
          id: message.id
        });
      }
    }
    
    return callback({
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: 'Method not found'
      },
      id: message.id
    });
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
