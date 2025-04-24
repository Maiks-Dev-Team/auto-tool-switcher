/**
 * Shared utilities for both server and Electron processes
 */
const fs = require('fs');
const path = require('path');

/**
 * Get the servers configuration from servers.json
 * @returns {Array} Array of server objects
 */
function getServersConfig() {
  try {
    const configPath = path.resolve(__dirname, '../servers.json');
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data).servers || [];
  } catch (e) {
    console.error('Error reading servers config:', e);
    return [];
  }
}

module.exports = {
  getServersConfig
};
