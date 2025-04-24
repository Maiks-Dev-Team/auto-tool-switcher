# Auto Tool Switcher - Cascade Integration Guide

This guide explains how to integrate the Auto Tool Switcher with Cascade using the Model Context Protocol (MCP).

## Overview

The Auto Tool Switcher is an MCP server that manages connections to multiple MCP servers, enabling/disabling them based on a configurable tool limit. When integrated with Cascade, it provides the following tools:

- `mcp0_servers_list` - List all available MCP servers
- `mcp0_servers_enable` - Enable a specific MCP server
- `mcp0_servers_disable` - Disable a specific MCP server

## Integration Steps

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

## Troubleshooting

If you encounter issues with the integration, check the following:

1. Ensure the path to `cascade-integration.js` is correct in your MCP configuration
2. Check the Auto Tool Switcher log file at `./auto-tool-switcher.log` for any errors
3. Verify that the `servers.json` file exists and contains valid server configurations
4. Make sure you don't exceed the 50-tool limit in Cascade

## Example Configuration

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

## Notes

- The Auto Tool Switcher manages a list of MCP servers defined in `servers.json`
- There's a configurable tool limit (default: 60) to prevent exceeding Cascade's 50-tool limit
- The server implements the MCP protocol and provides endpoints for tool discovery and server management
