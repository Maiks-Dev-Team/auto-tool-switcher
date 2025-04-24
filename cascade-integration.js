/**
 * Cascade Integration for Auto Tool Switcher
 * 
 * This file implements a custom integration between the Auto Tool Switcher
 * and the Cascade interface, providing reliable tool registration and execution.
 * 
 * This is the entry point used by Cascade as specified in mcp-config.json.
 * It now uses the modular implementation from src/cascade.
 */

// Import the modules from src/cascade
const cascade = require('./src/cascade/index');
const { log } = require('./src/cascade/logger');

// Log startup information
log('Cascade integration started');
log('Node version:', process.version);
log('Process arguments:', process.argv);
log('Current working directory:', process.cwd());

// Initialize readline interface
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Handle incoming messages
rl.on('line', async (line) => {
  try {
    const message = JSON.parse(line);
    log('Received message:', message);
    
    // Process the message using the cascade module
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

log('Waiting for client messages...');

// Send an initial notification to stdout to help with debugging
cascade.sendNotification({
  method: 'notification',
  params: {
    message: 'Auto Tool Switcher ready for connection'
  }
});
