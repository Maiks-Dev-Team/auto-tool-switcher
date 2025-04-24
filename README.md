# MCP Auto Tool Switcher

A Node.js server for managing MCP servers with an enable/disable tool and configurable tool limit.

## Features
- List all connected MCP servers and their enabled/disabled status
- Enable or disable servers (enforces a configurable tool limit)
- Configuration stored in `servers.json`

## Usage

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

## Configuration
Edit `servers.json` to change the tool limit or add/remove MCP servers.
