/**
 * Shared logging utilities
 */
const fs = require('fs');
const path = require('path');

const LOG_PATH = path.resolve(__dirname, '../auto-tool-switcher.log');

/**
 * Log a message to both the console and log file
 * @param {...any} args - Arguments to log
 */
function log(...args) {
  // Format objects for better readability
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
  
  const timestamp = new Date().toISOString();
  const msg = `[${timestamp}] ${formattedArgs.join(' ')}`;
  
  // Log to console
  console.log(msg);
  
  // Log to file with error handling
  try {
    fs.appendFileSync(LOG_PATH, msg + '\n', { encoding: 'utf8', flag: 'a' });
  } catch (e) {
    console.error(`Failed to write to log file: ${e.message}`);
  }
}

/**
 * Ensure the log file exists
 */
function ensureLogFile() {
  try {
    if (!fs.existsSync(LOG_PATH)) {
      fs.writeFileSync(LOG_PATH, '', { encoding: 'utf8' });
      console.log(`Created log file at ${LOG_PATH}`);
    }
    return true;
  } catch (e) {
    console.error(`Failed to create log file: ${e.message}`);
    return false;
  }
}

// Initialize log file
ensureLogFile();

module.exports = {
  log,
  ensureLogFile
};
