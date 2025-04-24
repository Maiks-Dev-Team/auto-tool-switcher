# Cascade MCP Server Documentation

## Overview

The Cascade MCP Server is a modular implementation of the MCP protocol that acts as a passthrough for tools from other MCP servers. It allows Cascade to discover and utilize tools provided by other MCP servers connected to the Auto Tool Switcher.

## Architecture

The server has been refactored into a modular structure with the following components:

### 1. `src/cascade/client.js`

Handles communication with other MCP servers:

- **fetchToolsFromServer**: Fetches tools from a server (HTTP or child process)
- **fetchToolsViaHttp**: Fetches tools from an HTTP/HTTPS server
- **fetchToolsViaChildProcess**: Fetches tools using a child process
- **forwardToolCall**: Forwards a tool call to the appropriate server
- **forwardToolCallViaHttp**: Forwards a tool call via HTTP
- **forwardToolCallViaChildProcess**: Forwards a tool call via child process

### 2. `src/cascade/tools.js`

Implements the core MCP tools:

- **getCoreTools**: Returns the list of core tools
- **handleServersList**: Handles the servers_list tool
- **handleServersEnable**: Handles the servers_enable tool
- **handleServersDisable**: Handles the servers_disable tool
- **handleRefreshTools**: Handles the refresh_tools tool
- **fetchToolsFromEnabledServers**: Fetches tools from all enabled servers

### 3. `src/cascade/server.js`

Implements the MCP server protocol:

- **processMessage**: Processes incoming JSON-RPC messages
- Handles initialization, tools/list, and tools/call requests
- Routes tool calls to the appropriate handler

### 4. `src/cascade/config.js`

Manages configuration:

- **getConfig**: Reads server configuration from servers.json
- **saveConfig**: Saves configuration to servers.json
- **getEnabledCount**: Counts enabled servers
- **getMcpConfig**: Reads MCP configuration from mcp-config.json

### 5. `src/cascade/logger.js`

Handles logging:

- **log**: Logs messages to a file with timestamp and formatting

### 6. `src/cascade/index.js`

Main entry point:

- Sets up the readline interface for stdin/stdout communication
- Provides response and notification sending functions
- Handles error cases and process lifecycle

## Features

### Server Tool Forwarding

The Auto Tool Switcher acts as a passthrough for tools from other MCP servers, making their tools available through the Auto Tool Switcher with appropriate prefixing.

- Tools from other servers are prefixed with the server name (e.g., `browsermcp_open_browser`)
- Tool descriptions include the server name (e.g., `[From browsermcp] Open a browser window`)

### Server Management

The Auto Tool Switcher provides tools for managing MCP servers:

- **mcp0_servers_list**: Lists all available MCP servers and their status
- **mcp0_servers_enable**: Enables a specific MCP server
- **mcp0_servers_disable**: Disables a specific MCP server
- **mcp0_refresh_tools**: Refreshes the list of tools from all enabled servers

### Tool Discovery

The Auto Tool Switcher fetches and combines tools from all enabled servers:

- Fetches tools from all enabled servers on startup
- Updates the tool list when servers are enabled or disabled
- Sends update/tools notifications to inform Cascade about changes

### Tool Invocation

The Auto Tool Switcher forwards tool calls to the appropriate server:

- Extracts the server prefix from the tool name
- Finds the server by prefix
- Forwards the request to the actual server
- Returns the response to Cascade

## Configuration

### servers.json

Contains the configuration for the MCP servers:

```json
{
  "tool_limit": 60,
  "servers": [
    {
      "name": "MCP Alpha",
      "url": "http://localhost:8000",
      "enabled": true
    },
    {
      "name": "MCP Beta",
      "url": "http://localhost:8001",
      "enabled": false
    },
    {
      "name": "browsermcp",
      "url": "http://localhost:3000",
      "enabled": true
    },
    {
      "name": "todo",
      "url": "http://localhost:3001",
      "enabled": false
    }
  ]
}
```

### mcp-config.json

Contains the configuration for each MCP server:

```json
{
  "mcpServers": {
    "auto-tool-switcher": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["B:\\Projects\\MCP\\auto-tool-switcher\\cascade-integration.js"],
      "cwd": "B:\\Projects\\MCP\\auto-tool-switcher",
      "env": {
        "MCP_STDIO": "true"
      }
    },
    "browsermcp": {
      "command": "npx",
      "args": ["@browsermcp/mcp@latest"]
    },
    "todo": {
      "command": "node",
      "args": ["B:\\Projects\\MCP\\todo-list-mcp\\dist\\index.js"]
    }
  }
}
```

## Testing

A comprehensive test suite is available in the `test` directory:

- **test-server.js**: Basic test script that sends initialize, tools/list, and servers_list requests to the server
- **test-server-improved.js**: Enhanced test script with better output formatting and logging to test-results.log

To run the tests:

```sh
cd test
node test-server-improved.js
```

## MCP Protocol

The Cascade MCP Server implements the MCP protocol, which is a JSON-RPC based protocol for communication between MCP servers and clients.

### Initialization

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {}
}
```

### Tools List

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

### Tool Call

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "mcp0_servers_list",
    "parameters": {}
  }
}
```

### Notifications

```json
{
  "jsonrpc": "2.0",
  "method": "update/tools",
  "params": {
    "message": "Updated tool list with 0 tools from enabled servers"
  }
}
```

## Future Improvements

1. **Error Handling**: Improve error handling and logging
2. **Performance**: Optimize tool forwarding and caching
3. **Security**: Add authentication and authorization
4. **UI**: Add a web interface for managing servers and tools
5. **Documentation**: Add more detailed documentation for each module
