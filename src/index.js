const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { listServers, enableServer, disableServer } = require('./serverManager');
const http = require('http');

const LOG_PATH = path.resolve(__dirname, '../auto-tool-switcher.log');
function log(...args) {
  const msg = `[${new Date().toISOString()}] ` + args.join(' ');
  try {
    fs.appendFileSync(LOG_PATH, msg + '\n');
  } catch (e) {
    console.error('[LOG ERROR]', e);
  }
  console.log(msg);
}

// Import getServersConfig from shared utils
const { getServersConfig } = require('./utils');

// Define fetchToolsList function
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

const app = express();
const PORT = 12345;

// Disable Electron launching for now to focus on MCP server functionality
log('[MCP] Running in server-only mode (Electron disabled)');

// Log startup information
log('[MCP] Starting server...');
log('[MCP] Node version:', process.version);
log('[MCP] Current working directory:', process.cwd());
log('[MCP] Process arguments:', process.argv);
log('[MCP] Environment:', process.env.NODE_ENV || 'development');

// Log file system access
try {
  const stat = fs.statSync(LOG_PATH);
  log('[MCP] Log file exists:', LOG_PATH);
  log('[MCP] Log file size:', stat.size, 'bytes');
} catch (e) {
  log('[MCP] Creating new log file:', LOG_PATH);
  fs.writeFileSync(LOG_PATH, '');
}

// Log required files
const requiredFiles = ['package.json', 'servers.json'];
requiredFiles.forEach(file => {
  try {
    const filePath = path.resolve(__dirname, '../', file);
    fs.accessSync(filePath);
    log('[MCP] Found required file:', filePath);
  } catch (e) {
    log('[ERROR] Missing required file:', file);
  }
});

app.use(bodyParser.json());

// Log all incoming requests
app.use((req, res, next) => {
  log('[MCP] Incoming request:', req.method, req.url);
  next();
});

// Minimal MCP endpoints for discovery
app.get('/status', (req, res) => {
  log('[MCP] Status request received');
  res.json({ status: 'ok', type: 'auto-tool-switcher' });
});

// Define and export functions after they're used
module.exports = {
  getServersConfig,
  fetchToolsList
};

// Server endpoints
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
    const allTools = toolsArrays.flat();
    log('Total tools aggregated:', allTools.length);
    res.json({ tools: allTools });
  } catch (err) {
    log('[ERROR] Failed to aggregate tools:', err);
    res.status(500).json({ error: 'Failed to aggregate tools' });
  }
});

app.get('/servers', listServers);
app.post('/servers/enable', enableServer);
app.post('/servers/disable', disableServer);

// Log server startup
app.listen(PORT, () => {
  log('[MCP] Server listening on port', PORT);
  log('[MCP] Server URL:', `http://localhost:${PORT}`);
});

// Log all uncaught errors and promise rejections
process.on('uncaughtException', err => {
  log('[ERROR] Uncaught exception:', err.stack || err);
});
process.on('unhandledRejection', err => {
  log('[ERROR] Unhandled rejection:', err && err.stack || err);
});

// Log process exit
process.on('exit', code => {
  log('[MCP] Process exiting with code:', code);
});

// Log process signals
process.on('SIGINT', () => {
  log('[MCP] Received SIGINT signal');
  process.exit(0);
});
process.on('SIGTERM', () => {
  log('[MCP] Received SIGTERM signal');
  process.exit(0);
});

// Log memory usage periodically
setInterval(() => {
  const mem = process.memoryUsage();
  log('[MCP] Memory usage:', {
    rss: (mem.rss / 1024 / 1024).toFixed(2) + ' MB',
    heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
    heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2) + ' MB'
  });
}, 30000); // Log every 30 seconds
