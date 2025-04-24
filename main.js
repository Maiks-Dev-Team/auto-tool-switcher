const { app, Menu, Tray, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, '..', 'servers.json');
let tray = null;

function getConfig() {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return { tool_limit: 60, servers: [] };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

async function addServerDialog() {
  const win = null;
  const name = await dialog.showInputBox ? await dialog.showInputBox({
    title: 'Add MCP Server',
    label: 'Server Name:',
    value: '',
    inputAttrs: { type: 'text' }
  }) : await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['OK'],
    title: 'Add MCP Server',
    message: 'Electron does not have a native prompt. Please edit servers.json to add servers.'
  });
  // For now, prompt fallback
  if (!dialog.showInputBox) return;
  if (!name) return;
  const url = await dialog.showInputBox({
    title: 'Add MCP Server',
    label: 'Server URL:',
    value: 'http://localhost:',
    inputAttrs: { type: 'text' }
  });
  if (!url) return;
  const config = getConfig();
  config.servers.push({ name, url, enabled: true });
  saveConfig(config);
  dialog.showMessageBox(win, {
    type: 'info',
    buttons: ['OK'],
    title: 'Server Added',
    message: `Added server: ${name} (${url})`
  });
}

async function removeServerDialog() {
  const config = getConfig();
  const serverNames = config.servers.map((s, i) => `${i + 1}. ${s.name} (${s.url})`);
  if (!serverNames.length) {
    dialog.showMessageBox(null, {
      type: 'info',
      buttons: ['OK'],
      title: 'Remove MCP Server',
      message: 'No servers to remove.'
    });
    return;
  }
  const { response } = await dialog.showMessageBox(null, {
    type: 'question',
    buttons: serverNames.concat('Cancel'),
    title: 'Remove MCP Server',
    message: 'Select a server to remove:'
  });
  if (response >= config.servers.length) return;
  const removed = config.servers.splice(response, 1);
  saveConfig(config);
  dialog.showMessageBox(null, {
    type: 'info',
    buttons: ['OK'],
    title: 'Server Removed',
    message: `Removed server: ${removed[0].name}`
  });
}

function listServersDialog() {
  const config = getConfig();
  const servers = config.servers;
  const win = null;
  dialog.showMessageBox(win, {
    type: 'info',
    buttons: ['OK'],
    title: 'Current MCP Servers',
    message: servers.length ? servers.map(s => `${s.name} (${s.url}) [${s.enabled ? 'enabled' : 'disabled'}]`).join('\n') : 'No servers configured.'
  });
}

async function editServerConfig() {
  const config = getConfig();
  const servers = config.servers;
  if (!servers.length) {
    dialog.showMessageBox(null, {
      type: 'info',
      buttons: ['OK'],
      title: 'Edit Server Configuration',
      message: 'No servers to edit.'
    });
    return;
  }
  const serverNames = servers.map((s, i) => `${i + 1}. ${s.name} (${s.url}) [${s.enabled ? 'enabled' : 'disabled'}]`);
  const { response } = await dialog.showMessageBox(null, {
    type: 'question',
    buttons: serverNames.concat('Cancel'),
    title: 'Edit Server Configuration',
    message: 'Select a server to edit:'
  });
  if (response >= servers.length) return;
  const selected = servers[response];
  // Use input boxes if available, otherwise instruct user
  if (!dialog.showInputBox) {
    dialog.showMessageBox(null, {
      type: 'info',
      buttons: ['OK'],
      title: 'Edit Server Configuration',
      message: 'Electron does not have a native prompt. Please edit servers.json to modify server details.'
    });
    return;
  }
  const newName = await dialog.showInputBox({
    title: 'Edit Server Name',
    label: 'Server Name:',
    value: selected.name,
    inputAttrs: { type: 'text' }
  });
  if (!newName) return;
  const newUrl = await dialog.showInputBox({
    title: 'Edit Server URL',
    label: 'Server URL:',
    value: selected.url,
    inputAttrs: { type: 'text' }
  });
  if (!newUrl) return;
  const enableDisable = await dialog.showMessageBox(null, {
    type: 'question',
    buttons: ['Enabled', 'Disabled', 'Cancel'],
    title: 'Enable/Disable Server',
    message: 'Set server enabled status:'
  });
  if (enableDisable.response === 2) return;
  selected.name = newName;
  selected.url = newUrl;
  selected.enabled = (enableDisable.response === 0);
  saveConfig(config);
  dialog.showMessageBox(null, {
    type: 'info',
    buttons: ['OK'],
    title: 'Server Updated',
    message: `Server updated: ${selected.name} (${selected.url}) [${selected.enabled ? 'enabled' : 'disabled'}]`
  });
}

const {
  listServerTools,
  listServerPrompts,
  listServerResources,
  callTool,
  getPrompt,
  readResource
} = require('./src/mcpApiFull');

async function selectServerDialog() {
  const config = getConfig();
  const servers = config.servers;
  if (!servers.length) {
    await dialog.showMessageBox(null, {
      type: 'info',
      buttons: ['OK'],
      title: 'No Servers',
      message: 'No servers configured.'
    });
    return null;
  }
  const serverNames = servers.map((s, i) => `${i + 1}. ${s.name} (${s.url})`);
  const { response } = await dialog.showMessageBox(null, {
    type: 'question',
    buttons: serverNames.concat('Cancel'),
    title: 'Select MCP Server',
    message: 'Choose a server:'
  });
  if (response >= servers.length) return null;
  return servers[response];
}

async function listToolsDialog() {
  const server = await selectServerDialog();
  if (!server) return;
  const result = await listServerTools(server.url);
  if (result.error) {
    dialog.showMessageBox(null, {
      type: 'error',
      buttons: ['OK'],
      title: 'Error Listing Tools',
      message: result.error
    });
    return;
  }
  dialog.showMessageBox(null, {
    type: 'info',
    buttons: ['OK'],
    title: `Tools for ${server.name}`,
    message: result.length ? result.map(t => `${t.name}: ${t.description || ''}`).join('\n') : 'No tools found.'
  });
}

async function listPromptsDialog() {
  const server = await selectServerDialog();
  if (!server) return;
  const result = await listServerPrompts(server.url);
  if (result.error) {
    dialog.showMessageBox(null, {
      type: 'error',
      buttons: ['OK'],
      title: 'Error Listing Prompts',
      message: result.error
    });
    return;
  }
  dialog.showMessageBox(null, {
    type: 'info',
    buttons: ['OK'],
    title: `Prompts for ${server.name}`,
    message: result.length ? result.map(p => `${p.name}: ${p.description || ''}`).join('\n') : 'No prompts found.'
  });
}

async function listResourcesDialog() {
  const server = await selectServerDialog();
  if (!server) return;
  const result = await listServerResources(server.url);
  if (result.error) {
    dialog.showMessageBox(null, {
      type: 'error',
      buttons: ['OK'],
      title: 'Error Listing Resources',
      message: result.error
    });
    return;
  }
  dialog.showMessageBox(null, {
    type: 'info',
    buttons: ['OK'],
    title: `Resources for ${server.name}`,
    message: result.length ? result.map(r => `${r.name || r.uri}: ${r.mimeType || ''}`).join('\n') : 'No resources found.'
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, '../assets/tray_icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Add MCP Server', click: addServerDialog },
    { label: 'Remove MCP Server', click: removeServerDialog },
    { label: 'List Current Servers', click: listServersDialog },
    { label: 'Edit Server Configuration', click: editServerConfig },
    { label: 'Open Configuration File', click: editServerConfig },
    { type: 'separator' },
    { label: 'List Tools', click: listToolsDialog },
    { label: 'List Prompts', click: listPromptsDialog },
    { label: 'List Resources', click: listResourcesDialog },
    { type: 'separator' },
    { label: 'Invoke Tool', click: invokeToolDialog },
    { label: 'Run Prompt', click: runPromptDialog },
    { label: 'Preview Resource', click: previewResourceDialog },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setToolTip('MCP Tray Client');
  tray.setContextMenu(contextMenu);
}

async function invokeToolDialog() {
  const server = await selectServerDialog();
  if (!server) return;
  const tools = await listServerTools(server.url);
  if (tools.error || !tools.length) {
    dialog.showMessageBox(null, { type: 'error', buttons: ['OK'], title: 'No Tools', message: tools.error || 'No tools found.' });
    return;
  }
  const toolNames = tools.map((t, i) => `${i + 1}. ${t.name}: ${t.description || ''}`);
  const { response } = await dialog.showMessageBox(null, {
    type: 'question',
    buttons: toolNames.concat('Cancel'),
    title: 'Select Tool',
    message: 'Choose a tool to invoke:'
  });
  if (response >= tools.length) return;
  const tool = tools[response];
  let args = {};
  if (tool.inputSchema && tool.inputSchema.properties) {
    for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
      if (!dialog.showInputBox) {
        dialog.showMessageBox(null, { type: 'info', buttons: ['OK'], title: 'Input Required', message: 'Please edit servers.json or use a UI with prompt support.' });
        return;
      }
      const val = await dialog.showInputBox({ title: `Tool Argument: ${key}`, label: prop.description || key, value: '', inputAttrs: { type: 'text' } });
      if (val === undefined) return;
      args[key] = val;
    }
  }
  const result = await callTool(server.url, tool.name, args);
  if (result.error) {
    dialog.showMessageBox(null, { type: 'error', buttons: ['OK'], title: 'Tool Error', message: result.error });
    return;
  }
  dialog.showMessageBox(null, { type: 'info', buttons: ['OK'], title: `Tool Result: ${tool.name}`, message: JSON.stringify(result, null, 2) });
}

async function runPromptDialog() {
  const server = await selectServerDialog();
  if (!server) return;
  const prompts = await listServerPrompts(server.url);
  if (prompts.error || !prompts.length) {
    dialog.showMessageBox(null, { type: 'error', buttons: ['OK'], title: 'No Prompts', message: prompts.error || 'No prompts found.' });
    return;
  }
  const promptNames = prompts.map((p, i) => `${i + 1}. ${p.name}: ${p.description || ''}`);
  const { response } = await dialog.showMessageBox(null, {
    type: 'question',
    buttons: promptNames.concat('Cancel'),
    title: 'Select Prompt',
    message: 'Choose a prompt to run:'
  });
  if (response >= prompts.length) return;
  const prompt = prompts[response];
  let args = {};
  if (prompt.arguments) {
    for (const arg of prompt.arguments) {
      if (!dialog.showInputBox) {
        dialog.showMessageBox(null, { type: 'info', buttons: ['OK'], title: 'Input Required', message: 'Please edit servers.json or use a UI with prompt support.' });
        return;
      }
      const val = await dialog.showInputBox({ title: `Prompt Argument: ${arg.name}`, label: arg.description || arg.name, value: '', inputAttrs: { type: 'text' } });
      if (val === undefined) return;
      args[arg.name] = val;
    }
  }
  const result = await getPrompt(server.url, prompt.name, args);
  if (result.error) {
    dialog.showMessageBox(null, { type: 'error', buttons: ['OK'], title: 'Prompt Error', message: result.error });
    return;
  }
  dialog.showMessageBox(null, { type: 'info', buttons: ['OK'], title: `Prompt Result: ${prompt.name}`, message: JSON.stringify(result, null, 2) });
}

async function previewResourceDialog() {
  const server = await selectServerDialog();
  if (!server) return;
  const resources = await listServerResources(server.url);
  if (resources.error || !resources.length) {
    dialog.showMessageBox(null, { type: 'error', buttons: ['OK'], title: 'No Resources', message: resources.error || 'No resources found.' });
    return;
  }
  const resourceNames = resources.map((r, i) => `${i + 1}. ${r.name || r.uri}: ${r.mimeType || ''}`);
  const { response } = await dialog.showMessageBox(null, {
    type: 'question',
    buttons: resourceNames.concat('Cancel'),
    title: 'Select Resource',
    message: 'Choose a resource to preview:'
  });
  if (response >= resources.length) return;
  const resource = resources[response];
  const result = await readResource(server.url, resource.uri);
  if (result.error) {
    dialog.showMessageBox(null, { type: 'error', buttons: ['OK'], title: 'Resource Error', message: result.error });
    return;
  }
  let msg = '';
  if (result.contents && result.contents.length) {
    const content = result.contents[0];
    if (content.text) {
      msg = content.text.substring(0, 1000) + (content.text.length > 1000 ? '\n... (truncated)' : '');
    } else if (content.data) {
      msg = '[Binary data, not previewable]';
    } else {
      msg = '[Unknown content type]';
    }
  } else {
    msg = '[No content]';
  }
  dialog.showMessageBox(null, { type: 'info', buttons: ['OK'], title: `Resource Preview: ${resource.name || resource.uri}`, message: msg });
}

app.whenReady().then(createTray);

app.on('window-all-closed', (e) => {
  // Prevent quitting when all windows are closed
  e.preventDefault();
});
