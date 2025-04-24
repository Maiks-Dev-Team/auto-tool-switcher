# MCP Auto Tool Switcher (Tray Client)

![Status](https://img.shields.io/badge/status-early%20development-orange)

> **⚠️ Early Stage:** This project is in the early stages of development. Features are experimental, incomplete, and subject to rapid change.

---

## ✨ Overview
MCP Auto Tool Switcher is an Electron-based tray/menu bar application for managing [MCP](https://github.com/your-mcp-link) servers, tools, prompts, and resources directly from your system tray.

- **Cross-platform:** Works on Windows, macOS, and Linux.
- **Modern UI:** Accessible from your system tray for instant access.
- **Server Management:** Add, remove, enable/disable, and configure MCP servers.
- **Tool/Prompt/Resource Discovery:** List, invoke, and preview MCP tools, prompts, and resources.

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

## 📝 Legacy: Node.js Server API (for reference)
> These endpoints are from the earliest version of the project and may be removed in the future.

**Features:**
- List all connected MCP servers and their enabled/disabled status
- Enable or disable servers (enforces a configurable tool limit)
- Configuration stored in `servers.json`

**Usage:**
1. Install dependencies:
   ```sh
   npm install express body-parser
   ```
2. Start the server:
   ```sh
   node src/index.js
   ```
3. API Endpoints:
   - `GET /servers` — List all servers and their status
   - `POST /servers/enable` — Enable a server (JSON body: `{ "name": "MCP Alpha" }`)
   - `POST /servers/disable` — Disable a server (JSON body: `{ "name": "MCP Alpha" }`)

**Configuration:**
Edit `servers.json` to change the tool limit or add/remove MCP servers.

---

## 🤝 Contributing
Contributions, feedback, and suggestions are welcome! Please note the project is in flux and APIs/UI may change frequently.

---

## 📄 License
MIT (to be added)
