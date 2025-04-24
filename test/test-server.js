/**
 * Test script for the Cascade MCP Server
 * This script will start the server and send various test commands
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Start the server
console.log('Starting Cascade MCP Server...');
const server = spawn('node', ['../cascade-mcp-server.js'], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe']
});

// Log server output
server.stdout.on('data', (data) => {
  console.log(`SERVER OUTPUT: ${data}`);
});

server.stderr.on('data', (data) => {
  console.error(`SERVER ERROR: ${data}`);
});

// Wait for server to start
setTimeout(() => {
  console.log('Sending initialize request...');
  
  // Send initialize request
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {}
  };
  
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  
  // Wait for response and then send tools/list request
  setTimeout(() => {
    console.log('Sending tools/list request...');
    
    const toolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };
    
    server.stdin.write(JSON.stringify(toolsRequest) + '\n');
    
    // Wait for response and then send servers_list request
    setTimeout(() => {
      console.log('Sending servers_list request...');
      
      const serversListRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'mcp0_servers_list',
          parameters: {}
        }
      };
      
      server.stdin.write(JSON.stringify(serversListRequest) + '\n');
      
      // Wait for response and then exit
      setTimeout(() => {
        console.log('Tests completed, shutting down server...');
        server.kill();
        process.exit(0);
      }, 1000);
    }, 1000);
  }, 1000);
}, 1000);

// Handle process exit
process.on('exit', () => {
  if (server && !server.killed) {
    server.kill();
  }
});

process.on('SIGINT', () => {
  if (server && !server.killed) {
    server.kill();
  }
  process.exit(0);
});
