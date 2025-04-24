/**
 * Configuration module for the Cascade MCP Server
 */
const fs = require('fs');
const path = require('path');
const { log } = require('./logger');

// Path to the servers configuration file
const SERVERS_CONFIG_PATH = path.resolve(__dirname, '../../servers.json');
// Path to the MCP configuration file
const MCP_CONFIG_PATH = path.resolve(__dirname, '../../mcp-config.json');

/**
 * Read server configuration
 * @returns {Object} Server configuration
 */
function getConfig() {
  try {
    log('Reading config from:', SERVERS_CONFIG_PATH);
    const data = fs.readFileSync(SERVERS_CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    log('Error reading servers config:', e);
    return { tool_limit: 60, servers: [] };
  }
}

/**
 * Save configuration to file
 * @param {Object} config - Configuration to save
 * @returns {boolean} Success status
 */
function saveConfig(config) {
  try {
    const configPath = SERVERS_CONFIG_PATH;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (e) {
    log('Error writing servers config:', e);
    return false;
  }
}

/**
 * Count enabled servers
 * @param {Object} config - Server configuration
 * @returns {number} Number of enabled servers
 */
function getEnabledCount(config) {
  return config.servers.filter(s => s.enabled).length;
}

/**
 * Read MCP configuration
 * @returns {Object} MCP configuration
 */
function getMcpConfig() {
  try {
    log('Reading MCP config from:', MCP_CONFIG_PATH);
    const data = fs.readFileSync(MCP_CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    log('Error reading MCP config:', e);
    return { mcpServers: {} };
  }
}

module.exports = {
  getConfig,
  saveConfig,
  getEnabledCount,
  getMcpConfig
};
