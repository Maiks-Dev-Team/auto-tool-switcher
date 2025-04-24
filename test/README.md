# Cascade MCP Server Tests

This directory contains test scripts for verifying the functionality of the Cascade MCP Server.

## Available Tests

- **test-server.js**: Basic test script that sends initialize, tools/list, and servers_list requests to the server.
- **test-server-improved.js**: Enhanced test script with better output formatting and logging to test-results.log.

## Running Tests

To run the tests, navigate to the test directory and run:

```bash
node test-server.js
# or
node test-server-improved.js
```

## Test Output

The test-server-improved.js script will generate a test-results.log file with detailed output from the test run.

## What's Being Tested

1. Server initialization
2. Tools listing
3. Server listing
4. Notification handling

## Adding New Tests

When adding new tests, please follow these guidelines:

1. Place all test files in this directory
2. Update this README.md with information about new tests
3. Make sure tests clean up after themselves (kill server processes, etc.)
4. Use descriptive names for test files
