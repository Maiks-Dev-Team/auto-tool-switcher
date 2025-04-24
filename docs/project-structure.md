# Auto Tool Switcher Project Structure

This document provides an overview of the project's directory structure and the purpose of each component.

## Directory Structure

```
auto-tool-switcher/
├── docs/                      # Documentation files
│   ├── cascade-mcp-server.md  # Detailed documentation for Cascade MCP Server
│   └── project-structure.md   # This file - overview of project structure
├── src/                       # Source code
│   ├── cascade/               # Modular Cascade MCP Server components
│   │   ├── client.js          # Communication with other MCP servers
│   │   ├── config.js          # Configuration management
│   │   ├── index.js           # Main entry point for Cascade modules
│   │   ├── logger.js          # Logging functionality
│   │   ├── server.js          # MCP server protocol implementation
│   │   └── tools.js           # Core MCP tools implementation
│   ├── index.js               # Main entry point for the Express server
│   └── ...                    # Other source files
├── test/                      # Test files
│   ├── test-server.js         # Basic test script
│   ├── test-server-improved.js # Enhanced test script
│   └── README.md              # Test documentation
├── cascade-mcp-server.js      # Main entry point for Cascade MCP Server
├── mcp-config.json            # Configuration for MCP servers
├── servers.json               # Server list and configuration
├── package.json               # Project dependencies and scripts
└── README.md                  # Project overview and documentation
```

## Key Components

### Cascade MCP Server

The Cascade MCP Server is a modular implementation of the MCP protocol that acts as a passthrough for tools from other MCP servers.

- **cascade-mcp-server.js**: Main entry point that uses the modular structure
- **src/cascade/**: Directory containing the modular components

### Express Server

The Express server provides a REST API for managing MCP servers.

- **src/index.js**: Main entry point for the Express server
- **src/routes/**: API routes

### Configuration Files

- **servers.json**: Contains the list of MCP servers and their configuration
- **mcp-config.json**: Contains the configuration for each MCP server

### Test Files

- **test/test-server.js**: Basic test script
- **test/test-server-improved.js**: Enhanced test script with better output formatting

## Module Relationships

```
cascade-mcp-server.js
    │
    ├── src/cascade/index.js
    │       │
    │       ├── src/cascade/server.js
    │       │       │
    │       │       ├── src/cascade/tools.js
    │       │       │       │
    │       │       │       └── src/cascade/client.js
    │       │       │
    │       │       └── src/cascade/client.js
    │       │
    │       ├── src/cascade/logger.js
    │       │
    │       └── src/cascade/config.js
    │
    └── servers.json
```

## File Purposes

### src/cascade/client.js

Handles communication with other MCP servers:
- Fetches tools from servers (HTTP or child process)
- Forwards tool calls to appropriate servers

### src/cascade/tools.js

Implements the core MCP tools:
- Defines tool schemas and handlers
- Manages server enabling/disabling
- Refreshes tool cache

### src/cascade/server.js

Implements the MCP server protocol:
- Processes incoming JSON-RPC messages
- Routes requests to appropriate handlers

### src/cascade/config.js

Manages configuration:
- Reads/writes server configuration
- Provides utility functions

### src/cascade/logger.js

Handles logging:
- Formats log messages
- Writes logs to file

### src/cascade/index.js

Main entry point for Cascade modules:
- Sets up stdin/stdout communication
- Provides core functions
