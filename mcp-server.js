/**
 * Auto Tool Switcher MCP Server
 * Based on the Model Context Protocol
 */
const { createMcpServer, StdioTransport } = require('@modelcontextprotocol/sdk');
const { z } = require('zod');
const fs = require('fs');
const path = require('path');

// Setup logging
const LOG_PATH = path.resolve(__dirname, './auto-tool-switcher.log');

// Ensure log file exists
function ensureLogFile() {
  try {
    fs.writeFileSync(LOG_PATH, '', { encoding: 'utf8' });
    console.error(`Created log file at ${LOG_PATH}`);
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
  
  const msg = `[${timestamp}] [AUTO-TOOL-SWITCHER] ${formattedArgs.join(' ')}`;
  
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
function getConfig() {
  try {
    const configPath = path.resolve(__dirname, './servers.json');
    log('Reading config from:', configPath);
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    log('Error reading servers config:', e);
    return { tool_limit: 60, servers: [] };
  }
}

// Save configuration to file
function saveConfig(config) {
  try {
    const configPath = path.resolve(__dirname, './servers.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (e) {
    log('Error writing servers config:', e);
    return false;
  }
}

// Count enabled servers
function getEnabledCount(config) {
  return config.servers.filter(s => s.enabled).length;
}

// Initialize MCP Server
const server = createMcpServer({
  serverInfo: {
    name: 'Auto Tool Switcher',
    version: '1.0.0'
  }
});

// Define the servers/list tool
server.tools.define({
  name: 'servers/list',
  description: 'List all available MCP servers',
  parameters: z.object({}),
  handler: async () => {
    log('Handling servers/list request');
    const config = getConfig();
    return {
      tool_limit: config.tool_limit,
      servers: config.servers
    };
  }
});

// Define the servers/enable tool
server.tools.define({
  name: 'servers/enable',
  description: 'Enable a specific MCP server',
  parameters: z.object({
    name: z.string().describe('Name of the server to enable')
  }),
  handler: async ({ name }) => {
    log('Handling servers/enable request for:', name);
    const config = getConfig();
    const server = config.servers.find(s => s.name === name);
    
    if (!server) {
      throw new Error(`Server '${name}' not found`);
    }
    
    if (server.enabled) {
      return { success: true, message: `Server '${name}' is already enabled` };
    }
    
    const enabledCount = getEnabledCount(config);
    if (enabledCount >= config.tool_limit) {
      throw new Error(`Tool limit (${config.tool_limit}) reached. Disable another server first.`);
    }
    
    server.enabled = true;
    saveConfig(config);
    
    return { success: true, message: `Server '${name}' enabled` };
  }
});

// Define the servers/disable tool
server.tools.define({
  name: 'servers/disable',
  description: 'Disable a specific MCP server',
  parameters: z.object({
    name: z.string().describe('Name of the server to disable')
  }),
  handler: async ({ name }) => {
    log('Handling servers/disable request for:', name);
    const config = getConfig();
    const server = config.servers.find(s => s.name === name);
    
    if (!server) {
      throw new Error(`Server '${name}' not found`);
    }
    
    if (!server.enabled) {
      return { success: true, message: `Server '${name}' is already disabled` };
    }
    
    server.enabled = false;
    saveConfig(config);
    
    return { success: true, message: `Server '${name}' disabled` };
  }
});

// Connect the server to the standard I/O transport
const transport = new StdioTransport();
server.listen(transport);

// Log startup
log('MCP server started');
log('Node version:', process.version);
log('Process arguments:', process.argv);
log('Environment variables:', JSON.stringify({
  MCP_STDIO: process.env.MCP_STDIO,
  NODE_ENV: process.env.NODE_ENV
}));
log('Current working directory:', process.cwd());
log('Waiting for client messages...');
