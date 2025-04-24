/**
 * Test for the automatic server startup functionality
 * 
 * This test verifies that the Auto Tool Switcher automatically starts
 * enabled MCP servers when it initializes.
 */
const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

// Test configuration
const TEST_TIMEOUT = 10000; // 10 seconds

/**
 * Main test function
 */
async function runTest() {
  console.log('Starting Auto Tool Switcher test with automatic server startup...');
  
  // Start the Auto Tool Switcher
  const autoToolSwitcher = spawn(
    'node',
    [path.join(__dirname, '..', 'cascade-integration.js')],
    {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe']
    }
  );
  
  // Set up readline to parse JSON-RPC messages
  const rl = readline.createInterface({
    input: autoToolSwitcher.stdout,
    terminal: false
  });
  
  // Track test state
  let initializeResponseReceived = false;
  let toolsListResponseReceived = false;
  let serversStartedNotificationReceived = false;
  let toolsUpdatedNotificationReceived = false;
  
  // Set up a promise that will resolve when the test is complete
  const testPromise = new Promise((resolve, reject) => {
    // Set a timeout for the entire test
    const timeout = setTimeout(() => {
      reject(new Error(`Test timed out after ${TEST_TIMEOUT}ms`));
    }, TEST_TIMEOUT);
    
    // Process responses
    rl.on('line', (line) => {
      try {
        const message = JSON.parse(line);
        console.log('Received message:', JSON.stringify(message, null, 2));
        
        // Check for initialize response
        if (message.id === 1 && message.result) {
          console.log('✓ Initialize response received');
          initializeResponseReceived = true;
        }
        
        // Check for tools/list response
        if (message.id === 2 && message.result && message.result.tools) {
          console.log(`✓ Tools list response received with ${message.result.tools.length} tools`);
          toolsListResponseReceived = true;
        }
        
        // Check for update/tools notification about started servers
        if (message.method === 'update/tools' && 
            message.params && 
            message.params.message && 
            message.params.message.includes('Started')) {
          console.log('✓ Server startup notification received');
          serversStartedNotificationReceived = true;
        }
        
        // Check for update/tools notification about updated tools
        if (message.method === 'update/tools' && 
            message.params && 
            message.params.message && 
            message.params.message.includes('Updated tool list')) {
          console.log('✓ Tools updated notification received');
          toolsUpdatedNotificationReceived = true;
        }
        
        // Check if all required messages have been received
        if (initializeResponseReceived && 
            toolsListResponseReceived && 
            (serversStartedNotificationReceived || toolsUpdatedNotificationReceived)) {
          clearTimeout(timeout);
          resolve();
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    });
    
    // Handle errors
    autoToolSwitcher.on('error', (err) => {
      console.error('Error with Auto Tool Switcher process:', err);
      clearTimeout(timeout);
      reject(err);
    });
    
    // Handle process exit
    autoToolSwitcher.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Auto Tool Switcher exited with code ${code}`);
        clearTimeout(timeout);
        reject(new Error(`Auto Tool Switcher exited with code ${code}`));
      }
    });
  });
  
  // Send initialize request
  const initializeRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {}
  }) + '\n';
  
  autoToolSwitcher.stdin.write(initializeRequest);
  console.log('Sent initialize request');
  
  // Wait a moment for initialization to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Send tools/list request
  const toolsListRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  }) + '\n';
  
  autoToolSwitcher.stdin.write(toolsListRequest);
  console.log('Sent tools/list request');
  
  try {
    // Wait for the test to complete
    await testPromise;
    
    // Run assertions
    assert(initializeResponseReceived, 'Initialize response was not received');
    assert(toolsListResponseReceived, 'Tools list response was not received');
    
    // At least one of these should be true
    assert(
      serversStartedNotificationReceived || toolsUpdatedNotificationReceived,
      'Neither server startup nor tools updated notification was received'
    );
    
    console.log('✅ Test passed! Auto Tool Switcher successfully starts enabled servers on initialization.');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    // Clean up
    autoToolSwitcher.kill();
    rl.close();
  }
}

// Run the test
runTest();
