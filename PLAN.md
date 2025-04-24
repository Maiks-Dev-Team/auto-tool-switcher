# PLAN.md

## MCP Server Tray Client Plan

### Goal
Create a cross-platform tray/menu bar application that allows users to intuitively add, remove, and manage MCP servers from their desktop environment.

---

### Features
- **System Tray/Menu Bar Icon**
  - Windows: Taskbar tray icon
  - Mac: Menu bar icon
- **Context Menu**
  - Add MCP Server
  - Remove MCP Server
  - List Current Servers
  - Edit Server Configuration
  - Open Configuration File
  - Quit
- **Dialogs/Forms**
  - For adding, editing, and removing servers
- **Persistent Storage**
  - Updates a JSON config file (e.g., `servers.json` or `test.json`)
- **Cross-Platform Support**
  - Works on both Windows and Mac

---

### Recommended Stack
- **Electron** (JavaScript/TypeScript) for cross-platform system tray apps with UI dialogs.

---

### Implementation Steps
1. **Project Setup**
   - Initialize Electron project
   - Add basic tray/menu bar functionality
2. **Tray/Menu Bar Icon & Context Menu**
   - Implement tray icon and context menu with all planned actions
3. **Config Management**
   - Read/write MCP server configurations to a JSON file
   - Add logic for adding, removing, editing servers
4. **Dialogs/UI**
   - Implement dialogs for user input (add/edit servers)
5. **Cross-Platform Testing**
   - Test on both Windows and Mac for consistent UX
6. **Documentation**
   - Provide usage instructions for end users

---

### Architecture Alignment with MCP
- The tray client acts as the **Host**, managing connections to multiple MCP servers.
- Each MCP server is managed as a separate **Client** connection.
- The system is designed to be extensible, supporting multiple transport layers (stdio, HTTP, etc.).
- The UI will display connection status for each server and allow users to manage (add/remove/reconnect) servers easily.
- Future enhancements will include UI for exploring tools, prompts, and context provided by each server.

---

### MCP Concepts Integration

#### Resources
- Resources represent any kind of data (files, database records, API responses, images, logs, etc.) that an MCP server exposes to clients.
- Each resource is identified by a unique URI (e.g., file://, postgres://, screen://) and can contain text (UTF-8) or binary (base64) data.
- Clients can discover resources via the `resources/list` endpoint and read them with `resources/read`. Resource templates and subscriptions are supported for dynamic or frequently changing data.
- Best practices: Use clear names/URIs, set correct MIME types, validate URIs, implement access control, sanitize paths, and handle errors gracefully.
- Future UI: List resources per server, preview text/binary content, allow resource downloads, and manage resource subscriptions.

#### Prompts
- Prompts are predefined templates that guide workflows, accept arguments, include context, and can chain interactions. They can be surfaced as UI elements (slash commands, quick actions, etc.).
- Each prompt has a name, description, and argument list. Clients discover prompts via `prompts/list` and invoke them via `prompts/get`, passing required arguments.
- Prompts can be dynamic (accepting arguments, embedding resource context, supporting multi-step workflows).
- Best practices: Use descriptive names/descriptions, validate arguments, handle errors, consider versioning, and document formats.
- Future UI: Show available prompts, provide forms for arguments, integrate prompts into context menus and guided workflows, and handle prompt updates/notifications.


#### Tools
- MCP servers expose tools as executable functions that can be discovered and invoked by clients.
- The tray client will support listing available tools for each server and invoking them with user-provided parameters.
- Tool definitions follow a schema, including name, description, input schema, and annotations (e.g., readOnly, destructive, idempotent, openWorld).
- Future UI: Show available tools, descriptions, and allow direct execution from the tray menu.

#### Sampling
- Sampling is the process of generating completions or responses from an LLM, with human-in-the-loop review.
- The tray client could support initiating sampling requests, displaying message history, and letting users review/approve completions.
- Sampling requests include messages, model preferences (cost, speed, intelligence), system prompts, context inclusion, temperature, max tokens, and stop sequences.
- Future UI: Initiate sampling, view and edit requests, review completions.

#### Roots
- Roots are URIs (e.g., file paths, URLs) that define the workspace or context for a server.
- The tray client will allow users to set and modify roots for each MCP server, helping organize and scope resources.
- Roots are informational, guiding servers to focus on relevant resources.
- Future UI: Manage roots per server, display current roots, handle root changes gracefully.

#### Transports
- MCP supports multiple transport types for client-server communication: Standard Input/Output (stdio) and Server-Sent Events (SSE) are built-in.
- The tray client will abstract transport selection, allowing users to connect to servers via stdio (for local tools) or SSE (for networked servers).
- Security best practices: Validate origins, bind locally when possible, implement authentication for SSE.
- Future enhancements: Support for additional/custom transports and secure configuration options.

---

### Future Enhancements
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

---

**Next Steps:**
- Scaffold Electron project
- Implement basic tray/menu bar and menu actions
- Connect menu actions to config file operations
