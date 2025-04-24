/**
 * Tools module for the Cascade MCP Server
 * Implements the core MCP tools
 */
const { log } = require('./logger');
const { getConfig, saveConfig, getEnabledCount } = require('./config');
const { fetchToolsFromServer } = require('./client');

/**
 * Get the list of core tools
 * @returns {Array} List of core tools
 */
function getCoreTools() {
  return [
    {
      name: 'mcp0_servers_list',
      description: 'List all available MCP servers',
      parameters: {}
    },
    {
      name: 'mcp0_servers_enable',
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
      name: 'mcp0_servers_disable',
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
    },
    {
      name: 'mcp0_refresh_tools',
      description: 'Refresh the list of tools from all enabled servers',
      parameters: {}
    }
  ];
}

/**
 * Handle the servers_list tool
 * @param {Object} message - JSON-RPC message
 * @param {Function} sendResponse - Function to send response
 * @param {Function} sendNotification - Function to send notification
 */
async function handleServersList(message, sendResponse, sendNotification) {
  const config = getConfig();
  
  // Format the output to be more clear
  const formattedServers = config.servers.map(server => ({
    name: server.name,
    url: server.url,
    status: server.enabled ? 'ENABLED' : 'DISABLED'
  }));
  
  log('Formatted servers:', formattedServers);
  
  // Send update/tools notification to inform clients about available tools
  sendNotification({
    jsonrpc: '2.0',
    method: 'update/tools',
    params: {
      message: `Refreshed server list. Found ${formattedServers.length} servers.`
    }
  });
  log('Sent update/tools notification after listing servers');
  
  // Return a more detailed and formatted response
  sendResponse({
    jsonrpc: '2.0',
    result: {
      data: {
        tool_limit: config.tool_limit,
        enabled_count: getEnabledCount(config),
        servers: formattedServers,
        message: `Found ${formattedServers.length} servers. ${getEnabledCount(config)} enabled out of limit ${config.tool_limit}.`
      }
    },
    id: message.id
  });
}

/**
 * Handle the servers_enable tool
 * @param {Object} message - JSON-RPC message
 * @param {Object} toolParams - Tool parameters
 * @param {Function} sendResponse - Function to send response
 * @param {Function} sendNotification - Function to send notification
 */
async function handleServersEnable(message, toolParams, sendResponse, sendNotification) {
  const config = getConfig();
  const serverName = toolParams.name || 'MCP Alpha';
  
  log(`Enabling server: ${serverName}`);
  
  const server = config.servers.find(s => s.name === serverName);
  
  if (!server) {
    const errorResponse = {
      jsonrpc: '2.0',
      error: {
        code: -32602,
        message: `Server '${serverName}' not found`
      },
      id: message.id
    };
    log('Server not found, sending error:', errorResponse);
    return sendResponse(errorResponse);
  }
  
  if (server.enabled) {
    const alreadyEnabledResponse = {
      jsonrpc: '2.0',
      result: {
        data: { 
          success: true, 
          message: `Server '${serverName}' is already enabled`,
          server: {
            name: server.name,
            url: server.url,
            status: 'ENABLED'
          }
        }
      },
      id: message.id
    };
    log('Server already enabled, sending response:', alreadyEnabledResponse);
    return sendResponse(alreadyEnabledResponse);
  }
  
  const enabledCount = getEnabledCount(config);
  if (enabledCount >= config.tool_limit) {
    const limitResponse = {
      jsonrpc: '2.0',
      error: {
        code: -32602,
        message: `Tool limit (${config.tool_limit}) reached. Disable another server first.`
      },
      id: message.id
    };
    log('Tool limit reached, sending error:', limitResponse);
    return sendResponse(limitResponse);
  }
  
  server.enabled = true;
  saveConfig(config);
  
  // Send update/tools notification to inform clients about the change
  sendNotification({
    jsonrpc: '2.0',
    method: 'update/tools',
    params: {
      message: `Server '${serverName}' enabled`
    }
  });
  log('Sent update/tools notification after enabling server');
  
  const successResponse = {
    jsonrpc: '2.0',
    result: {
      data: { 
        success: true, 
        message: `Server '${serverName}' enabled`,
        server: {
          name: server.name,
          url: server.url,
          status: 'ENABLED'
        }
      }
    },
    id: message.id
  };
  log('Server enabled successfully, sending response:', successResponse);
  return sendResponse(successResponse);
}

/**
 * Handle the servers_disable tool
 * @param {Object} message - JSON-RPC message
 * @param {Object} toolParams - Tool parameters
 * @param {Function} sendResponse - Function to send response
 * @param {Function} sendNotification - Function to send notification
 */
async function handleServersDisable(message, toolParams, sendResponse, sendNotification) {
  const config = getConfig();
  const serverName = toolParams.name || 'MCP Beta';
  
  log(`Disabling server: ${serverName}`);
  
  const server = config.servers.find(s => s.name === serverName);
  
  if (!server) {
    const errorResponse = {
      jsonrpc: '2.0',
      error: {
        code: -32602,
        message: `Server '${serverName}' not found`
      },
      id: message.id
    };
    log('Server not found, sending error:', errorResponse);
    return sendResponse(errorResponse);
  }
  
  if (!server.enabled) {
    const alreadyDisabledResponse = {
      jsonrpc: '2.0',
      result: {
        data: { 
          success: true, 
          message: `Server '${serverName}' is already disabled`,
          server: {
            name: server.name,
            url: server.url,
            status: 'DISABLED'
          }
        }
      },
      id: message.id
    };
    log('Server already disabled, sending response:', alreadyDisabledResponse);
    return sendResponse(alreadyDisabledResponse);
  }
  
  server.enabled = false;
  saveConfig(config);
  
  // Send update/tools notification to inform clients about the change
  sendNotification({
    jsonrpc: '2.0',
    method: 'update/tools',
    params: {
      message: `Server '${serverName}' disabled`
    }
  });
  log('Sent update/tools notification after disabling server');
  
  const successResponse = {
    jsonrpc: '2.0',
    result: {
      data: { 
        success: true, 
        message: `Server '${serverName}' disabled`,
        server: {
          name: server.name,
          url: server.url,
          status: 'DISABLED'
        }
      }
    },
    id: message.id
  };
  log('Server disabled successfully, sending response:', successResponse);
  return sendResponse(successResponse);
}

/**
 * Handle the refresh_tools tool
 * @param {Object} message - JSON-RPC message
 * @param {Function} sendResponse - Function to send response
 * @param {Function} sendNotification - Function to send notification
 */
async function handleRefreshTools(message, sendResponse, sendNotification) {
  log('Handling refresh_tools request');
  
  // Send update/tools notification to inform clients about refreshed tools
  sendNotification({
    jsonrpc: '2.0',
    method: 'update/tools',
    params: {
      message: `Refreshed tool cache. Checking for tools from all enabled servers.`
    }
  });
  log('Sent update/tools notification for refresh_tools');
  
  return sendResponse({
    jsonrpc: '2.0',
    result: {
      data: { 
        success: true, 
        message: `Refreshing tools from all enabled servers...`,
        enabled_servers: getEnabledCount(getConfig())
      }
    },
    id: message.id
  });
}

/**
 * Fetch tools from all enabled servers
 * @returns {Promise<Array>} List of tools from all enabled servers
 */
async function fetchToolsFromEnabledServers() {
  const config = getConfig();
  const enabledServers = config.servers.filter(s => s.enabled);
  let serverTools = [];
  
  // For each enabled server, try to fetch its tools
  const fetchPromises = enabledServers.map(async server => {
    try {
      const tools = await fetchToolsFromServer(server);
      return tools;
    } catch (error) {
      log(`Error fetching tools from ${server.name}:`, error);
      return [];
    }
  });
  
  // Wait for all fetches to complete
  const results = await Promise.all(fetchPromises);
  
  // Flatten the array of arrays
  serverTools = results.flat();
  log(`Fetched ${serverTools.length} tools from ${enabledServers.length} enabled servers`);
  
  return serverTools;
}

module.exports = {
  getCoreTools,
  handleServersList,
  handleServersEnable,
  handleServersDisable,
  handleRefreshTools,
  fetchToolsFromEnabledServers
};
