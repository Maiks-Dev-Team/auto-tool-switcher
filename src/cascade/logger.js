/**
 * Logger module for the Cascade MCP Server
 */
const fs = require('fs');
const path = require('path');

// Setup logging
const LOG_PATH = path.resolve(__dirname, '../../cascade-mcp-server.log');

// Initialize log file
try {
  fs.writeFileSync(LOG_PATH, '', { encoding: 'utf8' });
} catch (e) {
  console.error(`Failed to initialize log file: ${e.message}`);
}

/**
 * Log function that writes to both console and log file
 * @param  {...any} args - Arguments to log
 */
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

module.exports = {
  log
};
