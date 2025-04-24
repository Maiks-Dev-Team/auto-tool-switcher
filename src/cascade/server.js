/**
 * Server module for the Cascade MCP Server
 * Implements the MCP server protocol
 */
const { log } = require('./logger');
const { getConfig } = require('./config');
const { forwardToolCall, startEnabledServers } = require('./client');
const { 
  handleServersList, 
  handleServersEnable, 
  handleServersDisable, 
  handleRefreshTools,
  fetchToolsFromEnabledServers
} = require('./tools');
const {
  getCoreTools,
  getAllTools
} = require('./tools-manager');

// Start enabled servers on module load
let serversStarted = false;

/**
 * Process incoming JSON-RPC message
 * @param {Object} message - JSON-RPC message
 * @param {Function} sendResponse - Function to send response
 * @param {Function} sendNotification - Function to send notification
 */
async function processMessage(message, sendResponse, sendNotification) {
  if (!message.jsonrpc || message.jsonrpc !== '2.0') {
    return sendResponse({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request'
      },
      id: message.id || null
    });
  }
  
  // Handle initialization
  if (message.method === 'initialize') {
    log('Handling initialize request');
    
    // Start enabled servers if not already started
    if (!serversStarted) {
      const config = getConfig();
      log('Starting enabled servers automatically...');
      
      startEnabledServers(config.servers)
        .then(results => {
          serversStarted = true;
          log('Server startup results:', results);
          
          // Send notification about started servers
          sendNotification({
            jsonrpc: '2.0',
            method: 'update/tools',
            params: {
              message: `Started ${results.filter(r => r.success).length} enabled MCP servers`
            }
          });
          
          // Refresh tools after servers are started
          fetchToolsFromEnabledServers()
            .then(tools => {
              log(`Fetched ${tools.length} tools from enabled servers after startup`);
              
              // Send update/tools notification
              sendNotification({
                jsonrpc: '2.0',
                method: 'update/tools',
                params: {
                  message: `Updated tool list with ${tools.length} tools from enabled servers`
                }
              });
            })
            .catch(error => {
              log('Error fetching tools after server startup:', error);
            });
        })
        .catch(error => {
          log('Error starting servers:', error);
        });
    }
    
    return sendResponse({
      jsonrpc: '2.0',
      result: {
        serverInfo: {
          name: 'Auto Tool Switcher',
          version: '1.0.0'
        },
        capabilities: {
          tools: {
            supported: true
          }
        }
      },
      id: message.id
    });
  }
  
  // Handle tools/list
  if (message.method === 'tools/list') {
    log('Handling tools/list request');
    
    // Get all tools (core + server) using the tools manager
    getAllTools()
      .then(allTools => {
        // Send update/tools notification
        sendNotification({
          jsonrpc: '2.0',
          method: 'update/tools',
          params: {
            message: `Updated tool list with ${allTools.length - getCoreTools().length} tools from enabled servers`
          }
        });
      })
      .catch(error => {
        log('Error fetching tools from servers:', error);
      });
    
    // Get the current tools (may be from cache)
    const coreTools = getCoreTools();
    let serverTools = [];
    
    // Try to get server tools immediately (may be cached)
    fetchToolsFromEnabledServers()
      .then(tools => {
        serverTools = tools;
      })
      .catch(() => {});
    
    // Combine core tools with any server tools we might already have
    const allTools = [...coreTools, ...serverTools];
    log(`Returning ${allTools.length} tools (${coreTools.length} core + ${serverTools.length} from servers)`);
    
    return sendResponse({
      jsonrpc: '2.0',
      result: {
        tools: allTools
      },
      id: message.id
    });
  }
  
  // Handle tools/call
  if (message.method === 'tools/call') {
    log('Handling tools/call request');
    const toolName = message.params?.name;
    const toolParams = message.params?.parameters || {};
    
    log(`Processing tool call for: ${toolName} with params:`, toolParams);
    
    // Handle core tools
    if (toolName === 'mcp0_servers_list') {
      return handleServersList(message, sendResponse, sendNotification);
    }
    
    if (toolName === 'mcp0_servers_enable') {
      return handleServersEnable(message, toolParams, sendResponse, sendNotification);
    }
    
    if (toolName === 'mcp0_servers_disable') {
      return handleServersDisable(message, toolParams, sendResponse, sendNotification);
    }
    
    if (toolName === 'mcp0_refresh_tools') {
      return handleRefreshTools(message, sendResponse, sendNotification);
    }
    
    // Check if this is a tool from an enabled server
    // Extract the server prefix and actual tool name
    const parts = toolName.split('_');
    if (parts.length >= 2) {
      const serverPrefix = parts[0];
      const actualToolName = parts.slice(1).join('_');
      
      // Find the server by prefix
      const config = getConfig();
      const server = config.servers.find(s => 
        s.name.toLowerCase().replace(/\\s+/g, '_') === serverPrefix && s.enabled
      );
      
      if (server) {
        log(`Detected server tool: ${toolName} -> ${server.name} / ${actualToolName}`);
        
        // Forward the request to the actual server
        forwardToolCall(server, actualToolName, toolParams, message.id)
          .then(response => {
            log(`Received response from ${server.name} for tool ${actualToolName}:`, response);
            sendResponse(response);
          })
          .catch(error => {
            log(`Error forwarding tool call to ${server.name}:`, error);
            sendResponse({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: `Error forwarding request to ${server.name}: ${error.message}`
              },
              id: message.id
            });
          });
        
        // Return here to prevent the default response
        return;
      }
    }
    
    // Default response for unknown tools
    return sendResponse({
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: 'Method not found'
      },
      id: message.id
    });
  }
  
  // Default response for unhandled methods
  log('Unhandled method:', message.method);
  sendResponse({
    jsonrpc: '2.0',
    error: {
      code: -32601,
      message: 'Method not found'
    },
    id: message.id || null
  });
}

module.exports = {
  processMessage
};
