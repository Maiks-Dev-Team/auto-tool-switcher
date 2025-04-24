const { app, Menu, Tray, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Import shared utilities
const { getServersConfig } = require('./src/utils');

let tray = null;
const CONFIG_PATH = path.join(__dirname, 'servers.json');

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
      title: 'No Servers',
      message: 'There are no servers to remove.'
    });
    return;
  }
  
  const { response } = await dialog.showMessageBox(null, {
    type: 'question',
    buttons: ['Cancel', ...config.servers.map(s => s.name)],
    title: 'Remove Server',
    message: 'Select a server to remove:',
    detail: serverNames.join('\n')
  });
  
  if (response === 0) return; // Cancel
  const serverIndex = response - 1;
  const serverName = config.servers[serverIndex].name;
  
  config.servers.splice(serverIndex, 1);
  saveConfig(config);
  
  dialog.showMessageBox(null, {
    type: 'info',
    buttons: ['OK'],
    title: 'Server Removed',
    message: `Removed server: ${serverName}`
  });
}

function createTray() {
  // Determine icon path
  let iconPath;
  try {
    iconPath = path.join(__dirname, 'assets', 'tray_icon.png');
    if (!fs.existsSync(iconPath)) {
      // Use JS-based icon generation if PNG not found
      iconPath = path.join(__dirname, 'assets', 'tray_icon.js');
      if (!fs.existsSync(iconPath)) {
        throw new Error('No icon found');
      }
      // Require will execute the JS file which should set up the icon
      require(iconPath);
      iconPath = path.join(__dirname, 'assets', 'tray_icon.png');
    }
  } catch (e) {
    console.error('Failed to load tray icon:', e);
    iconPath = null;
  }

  tray = new Tray(iconPath || path.join(__dirname, 'assets', 'tray_icon.png'));
  tray.setToolTip('MCP Auto Tool Switcher');
  
  updateTrayMenu();
}

function updateTrayMenu() {
  const config = getConfig();
  const serverMenuItems = config.servers.map(server => {
    return {
      label: `${server.name} (${server.enabled ? 'Enabled' : 'Disabled'})`,
      submenu: [
        {
          label: server.enabled ? 'Disable' : 'Enable',
          click: () => {
            server.enabled = !server.enabled;
            saveConfig(config);
            updateTrayMenu();
          }
        },
        {
          label: 'Open in Browser',
          click: () => {
            shell.openExternal(server.url);
          }
        }
      ]
    };
  });
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'MCP Auto Tool Switcher', enabled: false },
    { type: 'separator' },
    ...serverMenuItems,
    { type: 'separator' },
    { label: 'Add Server...', click: addServerDialog },
    { label: 'Remove Server...', click: removeServerDialog },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createTray();
  
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
});

// Keep the app running in the tray
app.on('before-quit', () => {
  if (tray) {
    tray.destroy();
  }
});
