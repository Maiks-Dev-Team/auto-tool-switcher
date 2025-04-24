/**
 * Tools Manager module for the Cascade MCP Server
 * Handles tool discovery, caching, and management
 */
const { log } = require('./logger');
const { getConfig } = require('./config');
const { fetchToolsFromServer } = require('./client');

// Cache for server tools
let toolsCache = {
  timestamp: 0,
  tools: []
};

// Cache refresh interval (5 minutes)
const CACHE_REFRESH_INTERVAL = 5 * 60 * 1000;

/**
 * Get core MCP tools
 * @returns {Array} List of core tools
 */
function getCoreTools() {
  return [
    {
      name: 'mcp0_servers_list',
      description: 'List all available MCP servers',
      parameters: {
        properties: {},
        type: 'object'
      }
    },
    {
      name: 'mcp0_servers_enable',
      description: 'Enable a specific MCP server',
      parameters: {
        properties: {
          name: {
            type: 'string',
            description: 'Name of the server to enable'
          }
        },
        type: 'object'
      }
    },
    {
      name: 'mcp0_servers_disable',
      description: 'Disable a specific MCP server',
      parameters: {
        properties: {
          name: {
            type: 'string',
            description: 'Name of the server to disable'
          }
        },
        type: 'object'
      }
    },
    {
      name: 'mcp0_refresh_tools',
      description: 'Refresh the list of tools from all enabled servers',
      parameters: {
        properties: {},
        type: 'object'
      }
    }
  ];
}

/**
 * Fetch tools from all enabled servers
 * @param {boolean} forceRefresh - Force refresh the cache
 * @returns {Promise<Array>} List of tools
 */
async function fetchToolsFromEnabledServers(forceRefresh = false) {
  const now = Date.now();
  
  // Check if cache is valid
  if (!forceRefresh && 
      toolsCache.timestamp > 0 && 
      now - toolsCache.timestamp < CACHE_REFRESH_INTERVAL) {
    log(`Using cached tools (${toolsCache.tools.length} tools, cache age: ${Math.round((now - toolsCache.timestamp) / 1000)}s)`);
    return toolsCache.tools;
  }
  
  log('Fetching tools from enabled servers...');
  
  const config = getConfig();
  const enabledServers = config.servers.filter(server => server.enabled);
  
  log(`Found ${enabledServers.length} enabled servers`);
  
  if (enabledServers.length === 0) {
    log('No enabled servers found, returning empty list');
    toolsCache = {
      timestamp: now,
      tools: []
    };
    return [];
  }
  
  try {
    // Fetch tools from each enabled server
    const fetchPromises = enabledServers.map(server => 
      fetchToolsFromServer(server)
        .catch(error => {
          log(`Error fetching tools from ${server.name}:`, error);
          return []; // Return empty array on error
        })
    );
    
    // Wait for all promises to resolve
    const toolsArrays = await Promise.all(fetchPromises);
    
    // Flatten the array of arrays
    const allTools = toolsArrays.flat();
    
    log(`Fetched ${allTools.length} tools from ${enabledServers.length} enabled servers`);
    
    // Update cache
    toolsCache = {
      timestamp: now,
      tools: allTools
    };
    
    return allTools;
  } catch (error) {
    log('Error fetching tools from enabled servers:', error);
    return [];
  }
}

/**
 * Get all available tools (core + server)
 * @param {boolean} forceRefresh - Force refresh the cache
 * @returns {Promise<Array>} List of all tools
 */
async function getAllTools(forceRefresh = false) {
  const coreTools = getCoreTools();
  const serverTools = await fetchToolsFromEnabledServers(forceRefresh);
  
  return [...coreTools, ...serverTools];
}

/**
 * Invalidate the tools cache
 */
function invalidateCache() {
  log('Invalidating tools cache');
  toolsCache = {
    timestamp: 0,
    tools: []
  };
}

module.exports = {
  getCoreTools,
  fetchToolsFromEnabledServers,
  getAllTools,
  invalidateCache
};
