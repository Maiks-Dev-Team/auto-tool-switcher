const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { listServers, enableServer, disableServer } = require('./serverManager');

const LOG_PATH = path.resolve(__dirname, '../auto-tool-switcher.log');
function log(...args) {
  const msg = `[${new Date().toISOString()}] ` + args.join(' ');
  fs.appendFileSync(LOG_PATH, msg + '\n');
  console.log(msg);
}

const app = express();
const PORT = 12345;

// Disable Electron launching for now to focus on MCP server functionality
log('[MCP] Running in server-only mode (Electron disabled)');

// Export functions for potential future use
module.exports = {
  getServersConfig,
  fetchToolsList
};

app.use(bodyParser.json());

// Log all incoming requests
app.use((req, res, next) => {
  log('Incoming request:', req.method, req.url);
  next();
});

// Minimal MCP endpoints for discovery
app.get('/status', (req, res) => res.json({ status: 'ok', type: 'auto-tool-switcher' }));

const http = require('http');

// Import getServersConfig from shared utils
const { getServersConfig } = require('./utils');

function fetchToolsList(url) {
  return new Promise((resolve) => {
    const endpoint = url.replace(/\/$/, '') + '/tools/list';
    http.get(endpoint, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.tools || []);
        } catch {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

app.get('/tools/list', async (req, res) => {
  try {
    const servers = getServersConfig().filter(s => s.enabled);
    log('Aggregating tools from', servers.length, 'servers');
    const toolsArrays = await Promise.all(servers.map(async s => {
      try {
        const tools = await fetchToolsList(s.url);
        log('Fetched', tools.length, 'tools from', s.url);
        return tools;
      } catch (err) {
        log('[ERROR] Failed to fetch tools from', s.url, err);
        return [];
      }
    }));
    const externalTools = toolsArrays.flat();
    log('Returning', externalTools.length, 'tools');
    res.json({ tools: externalTools });
  } catch (err) {
    log('[ERROR] /tools/list failed:', err);
    res.status(500).json({ error: 'Failed to aggregate tools' });
  }
});

app.get('/servers', listServers);
app.post('/servers/enable', enableServer);
app.post('/servers/disable', disableServer);

app.listen(PORT, () => {
  log(`[MCP] Auto Tool Switcher server running on port ${PORT}`);
});

// Log all uncaught errors and promise rejections
process.on('uncaughtException', err => {
  log('[UNCAUGHT]', err.stack || err);
});
process.on('unhandledRejection', err => {
  log('[UNHANDLED REJECTION]', err && err.stack || err);
});
