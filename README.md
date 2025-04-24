# MCP Auto Tool Switcher

![Status](https://img.shields.io/badge/status-early%20development-orange)

> **⚠️ Early Stage:** This project is in the early stages of development. Features are experimental, incomplete, and subject to rapid change.

## ✨ Overview
MCP Auto Tool Switcher is a system for managing [MCP](https://github.com/your-mcp-link) servers, tools, prompts, and resources. It is a modular MCP server that acts as a passthrough for tools from other MCP servers.

### Features
- **Cross-platform:** Works on Windows, macOS, and Linux
- **Server Management:** Add, remove, enable/disable, and configure MCP servers via MCP tools
- **Tool/Prompt/Resource Discovery:** List, invoke, and preview MCP tools, prompts, and resources
- **Server Tool Forwarding:** Act as a passthrough for tools from other MCP servers
- **Automatic Server Startup:** Automatically starts all enabled MCP servers on initialization
- **Intelligent Tool Caching:** Implements efficient caching for improved performance

## 📖 Documentation

For complete documentation, see the [docs folder](./docs/index.md).

## 🚀 Quick Start

### Auto Tool Switcher

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Start the Cascade MCP Server:**
   ```sh
   node cascade-mcp-server.js
   ```

3. **Available Tools:**
   - `mcp0_servers_list` — List all servers and their status
   - `mcp0_servers_enable` — Enable a server
   - `mcp0_servers_disable` — Disable a server
   - `mcp0_refresh_tools` — Refresh the list of tools from all enabled servers

## ⚙️ Configuration

- All server configuration is stored in [`servers.json`](./servers.json)
- MCP server configurations are stored in [`mcp-config.json`](./mcp-config.json)

## 🔮 Future Improvements

- **Electron Tray Client**: A system tray application for managing MCP servers with:
  - System tray/menu bar icon for easy access
  - Context menu for managing servers
  - Dialogs for adding, editing, and removing servers
  - Visual interface for tool discovery and invocation

## 🤝 Contributing

Contributions, feedback, and suggestions are welcome! Please note the project is in flux and APIs/UI may change frequently.

## 📄 License

MIT (to be added)
