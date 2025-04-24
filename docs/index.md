# Auto Tool Switcher Documentation

Welcome to the Auto Tool Switcher documentation. This documentation provides comprehensive information about the Auto Tool Switcher project, including its components, architecture, and usage.

## Table of Contents

1. [Overview](#overview)
2. [Components](#components)
3. [Installation](#installation)
4. [Usage](#usage)
5. [Architecture](#architecture)
6. [Cascade Integration](#cascade-integration)
7. [Development Plan](#development-plan)
8. [Testing](#testing)
9. [Contributing](#contributing)

## Overview

The Auto Tool Switcher is a system for managing [MCP](https://github.com/your-mcp-link) servers, tools, prompts, and resources. It is a modular MCP server that acts as a passthrough for tools from other MCP servers.

### Features

- **Cross-platform:** Works on Windows, macOS, and Linux
- **Server Management:** Add, remove, enable/disable, and configure MCP servers via MCP tools
- **Tool/Prompt/Resource Discovery:** List, invoke, and preview MCP tools, prompts, and resources
- **Server Tool Forwarding:** Act as a passthrough for tools from other MCP servers
- **Automatic Server Startup:** Automatically starts all enabled MCP servers on initialization
- **Intelligent Tool Caching:** Implements efficient caching for improved performance

## Components

### Cascade MCP Server

The Cascade MCP Server is a modular implementation of the MCP protocol that acts as a passthrough for tools from other MCP servers.

Features:
- **Server Tool Forwarding**: Act as a passthrough for tools from other MCP servers
- **Server Management**: Enable/disable MCP servers
- **Tool Discovery**: Fetch and combine tools from all enabled servers
- **Tool Invocation**: Forward tool calls to the appropriate server
- **Automatic Server Startup**: Automatically starts all enabled MCP servers when initializing
- **Intelligent Tool Caching**: Implements caching with configurable refresh intervals for better performance
- **Robust Error Handling**: Provides detailed error messages and fallbacks for improved reliability

## Installation

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

### Installing Dependencies

```sh
npm install
```

### Configuration

- All server configuration is stored in [`servers.json`](../servers.json).
- MCP server configurations are stored in [`mcp-config.json`](../mcp-config.json).

## Usage

### Starting the Auto Tool Switcher

```sh
node cascade-mcp-server.js
```

### Available Tools

- `mcp0_servers_list` — List all servers and their status
- `mcp0_servers_enable` — Enable a server
- `mcp0_servers_disable` — Disable a server
- `mcp0_refresh_tools` — Refresh the list of tools from all enabled servers

## Architecture

The Auto Tool Switcher has been refactored into a modular structure with the following components:

### Directory Structure

```
auto-tool-switcher/
├── docs/                      # Documentation files
├── src/                       # Source code
│   ├── cascade/               # Modular Cascade MCP Server components
│   │   ├── client.js          # Communication with other MCP servers
│   │   ├── config.js          # Configuration management
│   │   ├── index.js           # Main entry point for Cascade modules
│   │   ├── logger.js          # Logging functionality
│   │   ├── server.js          # MCP server protocol implementation
│   │   ├── tools.js           # Core MCP tools implementation
│   │   └── tools-manager.js   # Tool discovery and caching system
│   ├── index.js               # Main entry point for the Express server
│   └── ...                    # Other source files
├── test/                      # Test files
│   ├── auto-start-servers.test.js # Test for automatic server startup
│   └── ...                    # Other test files
├── reference/                 # Reference files and unused code
├── cascade-mcp-server.js      # Main entry point for Cascade MCP Server
├── mcp-config.json            # Configuration for MCP servers
├── servers.json               # Server list and configuration
└── package.json               # Project dependencies and scripts
```

### Module Relationships

```
cascade-mcp-server.js
    │
    ├── src/cascade/index.js
    │       │
    │       ├── src/cascade/server.js
    │       │       │
    │       │       ├── src/cascade/tools.js
    │       │       │       │
    │       │       │       ├── src/cascade/config.js
    │       │       │       │
    │       │       │       └── src/cascade/tools-manager.js
    │       │       │
    │       │       ├── src/cascade/client.js
    │       │       │       │
    │       │       │       └── src/cascade/config.js
    │       │       │
    │       │       └── src/cascade/tools-manager.js
    │       │
    │       └── src/cascade/logger.js
    │
    └── servers.json
```

### Module Descriptions

#### src/cascade/client.js

Handles communication with other MCP servers:
- Fetches tools from servers (HTTP or child process)
- Forwards tool calls to appropriate servers

#### src/cascade/tools.js

Implements the core MCP tools:
- Defines tool schemas and handlers
- Manages server enabling/disabling
- Refreshes tool cache

#### src/cascade/server.js

Implements the MCP server protocol:
- Processes incoming JSON-RPC messages
- Routes requests to appropriate handlers

#### src/cascade/config.js

Manages configuration:
- Reads/writes server configuration
- Provides utility functions

#### src/cascade/logger.js

Handles logging:
- Formats log messages
- Writes logs to file

#### src/cascade/index.js

Main entry point for Cascade modules:
- Sets up stdin/stdout communication
- Provides core functions

#### src/cascade/tools-manager.js

Centralized tool management system:
- Handles tool discovery and caching
- Provides APIs for getting core tools, server tools, and all tools
- Implements intelligent caching with configurable refresh intervals
- Handles cache invalidation when server status changes

## Cascade Integration

This section explains how to integrate the Auto Tool Switcher with Cascade using the Model Context Protocol (MCP).

### Integration Steps

To integrate the Auto Tool Switcher with Cascade, follow these steps:

1. **Add the server to your Cascade MCP configuration**

   Edit your `~/.codeium/windsurf/mcp_config.json` file and add the Auto Tool Switcher configuration:

   ```json
   {
     "mcpServers": {
       "auto-tool-switcher": {
         "command": "node",
         "args": [
           "<ABSOLUTE_PATH_TO>/cascade-integration.js"
         ],
         "env": {}
       }
     }
   }
   ```

   Replace `<ABSOLUTE_PATH_TO>` with the absolute path to your Auto Tool Switcher directory.

2. **Restart Cascade**

   After updating the configuration, restart Cascade to apply the changes.

3. **Using the tools**

   Once integrated, you can use the following tools in Cascade:

   - `mcp0_servers_list` - Lists all available MCP servers and their status
   - `mcp0_servers_enable` - Enables a specific MCP server (requires a `name` parameter)
   - `mcp0_servers_disable` - Disables a specific MCP server (requires a `name` parameter)

### Troubleshooting

If you encounter issues with the integration, check the following:

1. Ensure the path to `cascade-integration.js` is correct in your MCP configuration
2. Check the Auto Tool Switcher log file at `./auto-tool-switcher.log` for any errors
3. Verify that the `servers.json` file exists and contains valid server configurations
4. Make sure you don't exceed the 50-tool limit in Cascade

### Example Configuration

Here's an example of a complete `mcp_config.json` file with the Auto Tool Switcher and other MCP servers:

```json
{
  "mcpServers": {
    "auto-tool-switcher": {
      "command": "node",
      "args": [
        "C:\\Projects\\MCP\\auto-tool-switcher\\cascade-integration.js"
      ],
      "env": {}
    },
    "google-maps": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-google-maps"
      ],
      "env": {
        "GOOGLE_MAPS_API_KEY": "<YOUR_API_KEY>"
      }
    }
  }
}
```

## Development Plan

### Goal
Improve the Auto Tool Switcher to provide a robust and efficient way to manage MCP servers and their tools.

### Implementation Steps
1. **Core Functionality**
   - Implement server management tools
   - Add tool discovery and forwarding
   - Implement automatic server startup
2. **Configuration Management**
   - Read/write server configurations to JSON files
   - Add logic for adding, removing, enabling/disabling servers
3. **Testing**
   - Create comprehensive test suite
   - Ensure cross-platform compatibility
4. **Documentation**
   - Provide usage instructions for end users

### MCP Concepts Integration

#### Resources
- Resources represent any kind of data (files, database records, API responses, images, logs, etc.) that an MCP server exposes to clients.
- Each resource is identified by a unique URI and can contain text or binary data.
- Future UI: List resources per server, preview text/binary content, allow resource downloads, and manage resource subscriptions.

#### Prompts
- Prompts are predefined templates that guide workflows, accept arguments, include context, and can chain interactions.
- Future UI: Show available prompts, provide forms for arguments, integrate prompts into context menus and guided workflows.

#### Tools
- MCP servers expose tools as executable functions that can be discovered and invoked by clients.
- Future UI: Show available tools, descriptions, and allow direct execution from the tray menu.

### Future Enhancements
- **Electron Tray Client**: A system tray application for managing MCP servers with the following features:
  - System Tray/Menu Bar Icon (Windows: Taskbar tray icon, Mac: Menu bar icon)
  - Context Menu (Add/Remove/List/Edit servers, Open Configuration File, Quit)
  - Dialogs/Forms for adding, editing, and removing servers
  - Persistent Storage (Updates a JSON config file)
  - Cross-Platform Support (Works on both Windows and Mac)
- Import/export server configs
- Integration with MCP client for live status
- Notifications for server events/errors
- Auto-update functionality
- Support for additional transport types (e.g., HTTP, custom protocols)
- UI for listing tools, prompts, resources, and context from each server
- UI for tool invocation and parameter entry
- UI for sampling requests and completions
- UI for root management and resource scoping
- UI for prompt discovery, argument entry, and execution
- UI for resource browsing, preview, and download

## Testing

A comprehensive test suite is available in the `test` directory:

- **test-server.js**: Basic test script that sends initialize, tools/list, and servers_list requests to the server
- **test-server-improved.js**: Enhanced test script with better output formatting and logging to test-results.log
- **auto-start-servers.test.js**: Test for the automatic server startup functionality

To run the tests:

```sh
cd test
node test-server-improved.js
```

## Contributing

Contributions, feedback, and suggestions are welcome! Please note the project is in flux and APIs/UI may change frequently.

### Guidelines

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Create a new Pull Request

## License

MIT (to be added)
