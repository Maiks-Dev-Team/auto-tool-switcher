/**
 * Main entry point for the Cascade MCP Server
 * Handles initialization and message processing
 */
const readline = require('readline');
const { processMessage } = require('./server');
const { log } = require('./logger');
const config = require('./config');

// Initialize the configuration
// Make sure the config is loaded

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

/**
 * Send a JSON-RPC response
 * @param {Object} response - JSON-RPC response object
 */
function sendResponse(response) {
  log('Sending response:', response);
  console.log(JSON.stringify(response));
}

/**
 * Send a JSON-RPC notification
 * @param {Object} notification - JSON-RPC notification object
 */
function sendNotification(notification) {
  log('Sending notification:', notification);
  console.log(JSON.stringify(notification));
}

// Process incoming messages
rl.on('line', async (line) => {
  try {
    const message = JSON.parse(line);
    log('Received message:', message);
    
    // Process the message
    await processMessage(message, sendResponse, sendNotification);
  } catch (error) {
    log('Error processing message:', error);
    
    // Send error response
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
  log('Exiting Cascade MCP Server');
  rl.close();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log('Uncaught exception:', error);
});

// Log startup
log('Cascade MCP Server started');

// Export for testing
module.exports = {
  sendResponse,
  sendNotification,
  processMessage
};
