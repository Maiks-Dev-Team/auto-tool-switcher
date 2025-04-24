/**
 * Cascade MCP Server for Auto Tool Switcher
 * 
 * This implementation follows the exact naming conventions expected by Cascade
 * and implements the MCP protocol correctly.
 * 
 * This is the main entry point that uses the modular structure in src/cascade
 */

// Import the modules
const cascade = require('./src/cascade/index');

// Import the logger
const { log } = require('./src/cascade/logger');

// Import the configuration module
const { getConfig } = require('./src/cascade/config');

// Import the tools module
const { getCoreTools, handleServersList, handleServersEnable, handleServersDisable, handleRefreshTools, fetchToolsFromEnabledServers } = require('./src/cascade/tools');

// Import the client module
const { fetchToolsFromServer, forwardToolCall } = require('./src/cascade/client');

// Import the server module
const { processMessage } = require('./src/cascade/server');

// Import readline
const readline = require('readline');

// Initialize readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Use the sendResponse and sendNotification functions from the cascade module

// Process incoming messages
rl.on('line', async (line) => {
  try {
    const message = JSON.parse(line);
    log('Received message:', message);
    
    // Process the message
    await cascade.processMessage(message, cascade.sendResponse, cascade.sendNotification);
  } catch (error) {
    log('Error processing message:', error);
    
    // Send error response
    cascade.sendResponse({
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
cascade.sendNotification({
  method: 'notification',
  params: {
    message: 'Cascade MCP server ready for connection'
  }
});
