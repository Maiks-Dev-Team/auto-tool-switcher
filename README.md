# MCP Auto Tool Switcher

![Status](https://img.shields.io/badge/status-early%20development-orange)

> **⚠️ Early Stage:** This project is in the early stages of development. Features are experimental, incomplete, and subject to rapid change.

---

## ✨ Overview
MCP Auto Tool Switcher is a system for managing [MCP](https://github.com/your-mcp-link) servers, tools, prompts, and resources. It consists of two main components:

1. **Electron Tray Client**: A system tray application for managing MCP servers
2. **Cascade MCP Server**: A modular MCP server that acts as a passthrough for tools from other MCP servers

### Features
- **Cross-platform:** Works on Windows, macOS, and Linux
- **Modern UI:** Accessible from your system tray for instant access
- **Server Management:** Add, remove, enable/disable, and configure MCP servers
- **Tool/Prompt/Resource Discovery:** List, invoke, and preview MCP tools, prompts, and resources
- **Server Tool Forwarding:** Act as a passthrough for tools from other MCP servers

See [`PLAN.md`](./PLAN.md) for the current roadmap and feature set.

---

## 📸 Screenshots
<!--
Add screenshots here when available.
-->

---

## 🚀 Getting Started (Tray Client)

1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Start the Electron tray client:**
   ```sh
   npm start
   ```
3. **Use the tray icon:**
   - Right-click the tray icon to access all MCP server management features.
   - Add/remove/edit servers, list/invoke tools, run prompts, preview resources, and more.

---

## ⚙️ Configuration
- All server configuration is stored in [`servers.json`](./servers.json).
- You can edit this file manually or use the tray app's dialogs for most operations.

---

## 🛠 Features
| Feature            | Status           | Description                                    |
|--------------------|------------------|------------------------------------------------|
| Add/Remove Servers | ✅ Implemented   | Manage MCP server list from tray menu          |
| Edit Config        | ✅ Implemented   | Edit server details and enable/disable status  |
| List Tools         | ✅ Implemented   | View available tools on a server               |
| Invoke Tool        | ✅ Implemented   | Run a tool and view results                    |
| List Prompts       | ✅ Implemented   | View available prompts on a server             |
| Run Prompt         | ✅ Implemented   | Run a prompt and view results                  |
| List Resources     | ✅ Implemented   | View available resources on a server           |
| Preview Resource   | ✅ Implemented   | Preview text/binary content of resources       |
| Notifications      | 🚧 Planned       | Desktop notifications for server events        |
| Import/Export      | 🚧 Planned       | Manage server configs across machines          |

---

## 📝 Cascade MCP Server

The Cascade MCP Server is a modular implementation of the MCP protocol that acts as a passthrough for tools from other MCP servers.

### Architecture

The server has been refactored into a modular structure with the following components:

- **client.js**: Handles communication with other MCP servers
- **tools.js**: Implements the core MCP tools
- **server.js**: Implements the MCP server protocol
- **config.js**: Manages configuration
- **logger.js**: Handles logging
- **index.js**: Main entry point

### Features

- **Server Tool Forwarding**: Act as a passthrough for tools from other MCP servers
- **Server Management**: Enable/disable MCP servers
- **Tool Discovery**: Fetch and combine tools from all enabled servers
- **Tool Invocation**: Forward tool calls to the appropriate server

### Usage

1. Install dependencies:
   ```sh
   npm install
   ```

2. Start the Cascade MCP Server:
   ```sh
   node cascade-mcp-server.js
   ```

3. Available Tools:
   - `mcp0_servers_list` — List all servers and their status
   - `mcp0_servers_enable` — Enable a server
   - `mcp0_servers_disable` — Disable a server
   - `mcp0_refresh_tools` — Refresh the list of tools from all enabled servers

### Testing

A comprehensive test suite is available in the `test` directory. To run the tests:

```sh
cd test
node test-server-improved.js
```

See the [test README](./test/README.md) for more information.

**Configuration:**
Edit `servers.json` to change the tool limit or add/remove MCP servers.

---

## 🤝 Contributing
Contributions, feedback, and suggestions are welcome! Please note the project is in flux and APIs/UI may change frequently.

---

## 📄 License
MIT (to be added)
