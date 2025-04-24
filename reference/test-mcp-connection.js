/**
 * Test MCP Connection
 * 
 * This script simulates the communication between Cascade and our MCP server
 * to help diagnose connection issues.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Path to our MCP server
const MCP_SERVER_PATH = path.resolve(__dirname, 'cascade-integration.js');

// Log to console and file
function log(...args) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${args.join(' ')}`;
  console.log(message);
  fs.appendFileSync('test-mcp-connection.log', message + '\n');
}

// Start the MCP server process
log('Starting MCP server process...');
const mcp = spawn('node', [MCP_SERVER_PATH], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, MCP_STDIO: 'true' }
});

// Handle server output
mcp.stdout.on('data', (data) => {
  const message = data.toString().trim();
  log('MCP Server stdout:', message);
  
  try {
    // Try to parse as JSON
    const json = JSON.parse(message);
    handleServerMessage(json);
  } catch (e) {
    log('Failed to parse server message as JSON:', e.message);
  }
});

mcp.stderr.on('data', (data) => {
  log('MCP Server stderr:', data.toString().trim());
});

mcp.on('close', (code) => {
  log(`MCP Server process exited with code ${code}`);
});

// Handle messages from the server
function handleServerMessage(message) {
  if (message.method === 'notification') {
    log('Received notification:', message.params?.message || 'No message');
    
    // After receiving the initial notification, send initialize request
    setTimeout(() => {
      sendToServer({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      });
    }, 1000);
    
    return;
  }
  
  if (message.id === 1) {
    log('Received initialize response:', JSON.stringify(message, null, 2));
    
    // After initialization, request tool list
    setTimeout(() => {
      sendToServer({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      });
    }, 1000);
    
    return;
  }
  
  if (message.id === 2) {
    log('Received tools/list response:', JSON.stringify(message, null, 2));
    
    // If we got tools, try to call the servers_list tool
    if (message.result && message.result.tools) {
      const tools = message.result.tools;
      log(`Found ${tools.length} tools:`, tools.map(t => t.name).join(', '));
      
      const serversListTool = tools.find(t => t.name === 'mcp0_servers_list');
      if (serversListTool) {
        setTimeout(() => {
          log('Calling mcp0_servers_list tool...');
          sendToServer({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
              name: 'mcp0_servers_list',
              parameters: {}
            }
          });
        }, 1000);
      } else {
        log('mcp0_servers_list tool not found');
      }
    }
    
    return;
  }
  
  if (message.id === 3) {
    log('Received servers_list response:', JSON.stringify(message, null, 2));
    
    // Try to enable a server
    setTimeout(() => {
      log('Calling mcp0_servers_enable tool...');
      sendToServer({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'mcp0_servers_enable',
          parameters: {
            name: 'MCP Beta'
          }
        }
      });
    }, 1000);
    
    return;
  }
  
  if (message.id === 4) {
    log('Received servers_enable response:', JSON.stringify(message, null, 2));
    
    // Try to disable a server
    setTimeout(() => {
      log('Calling mcp0_servers_disable tool...');
      sendToServer({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'mcp0_servers_disable',
          parameters: {
            name: 'MCP Alpha'
          }
        }
      });
    }, 1000);
    
    return;
  }
  
  if (message.id === 5) {
    log('Received servers_disable response:', JSON.stringify(message, null, 2));
    
    // Test complete, exit after a delay
    setTimeout(() => {
      log('Test complete, exiting...');
      mcp.kill();
      process.exit(0);
    }, 1000);
    
    return;
  }
  
  // Handle any other messages
  log('Received unhandled message:', JSON.stringify(message, null, 2));
}

// Send a message to the server
function sendToServer(message) {
  const json = JSON.stringify(message);
  log('Sending to server:', json);
  mcp.stdin.write(json + '\n');
}

// Handle process exit
process.on('exit', () => {
  log('Test script exiting, killing MCP server process');
  mcp.kill();
});

// Create log file
fs.writeFileSync('test-mcp-connection.log', '--- MCP Connection Test Log ---\n');

log('Test script started');
