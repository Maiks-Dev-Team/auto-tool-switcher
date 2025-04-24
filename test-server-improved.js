/**
 * Improved test script for the Cascade MCP Server
 * This script will start the server and send various test commands with better output formatting
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Create a log file
const LOG_FILE = path.resolve(__dirname, 'test-results.log');
fs.writeFileSync(LOG_FILE, '=== Cascade MCP Server Test Results ===\n\n', { encoding: 'utf8' });

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n', { encoding: 'utf8' });
}

// Start the server
log('Starting Cascade MCP Server...');
const server = spawn('node', ['cascade-mcp-server.js'], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe']
});

// Set up readline for parsing server output
const rl = readline.createInterface({
  input: server.stdout,
  terminal: false
});

// Process server output
rl.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    log(`SERVER RESPONSE: ${JSON.stringify(response, null, 2)}`);
    
    // Check if this is a response to one of our requests
    if (response.id === 1) {
      log('✅ Initialize request successful');
    } else if (response.id === 2) {
      log('✅ Tools/list request successful');
      log(`Found ${response.result.tools.length} tools`);
    } else if (response.id === 3) {
      log('✅ Servers_list request successful');
      if (response.result && response.result.data) {
        log(`Found ${response.result.data.servers.length} servers, ${response.result.data.enabled_count} enabled`);
      }
    }
  } catch (error) {
    log(`Error parsing server output: ${line}`);
  }
});

// Log server errors
server.stderr.on('data', (data) => {
  log(`SERVER ERROR: ${data}`);
});

// Run tests sequentially
async function runTests() {
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 1: Initialize
  log('TEST 1: Sending initialize request...');
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {}
  };
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Tools/list
  log('TEST 2: Sending tools/list request...');
  const toolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };
  server.stdin.write(JSON.stringify(toolsRequest) + '\n');
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 3: Servers_list
  log('TEST 3: Sending servers_list request...');
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
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Tests completed
  log('All tests completed, shutting down server...');
  server.kill();
  rl.close();
  
  log('Test results have been saved to test-results.log');
}

// Run the tests
runTests().catch(error => {
  log(`Test error: ${error.message}`);
  if (server && !server.killed) {
    server.kill();
  }
  process.exit(1);
});

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
