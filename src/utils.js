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
    return JSON.parse(data) || { servers: [], tool_limit: 3 };
  } catch (e) {
    console.error('Error reading servers config:', e);
    return { servers: [], tool_limit: 3 };
  }
}

/**
 * Get only the enabled servers from the configuration
 * @returns {Array} Array of enabled server objects
 */
function getEnabledServers() {
  const config = getServersConfig();
  return config.servers.filter(server => server.enabled);
}

module.exports = {
  getServersConfig,
  getEnabledServers
};
