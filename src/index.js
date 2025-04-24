const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const http = require('http');

const LOG_PATH = path.resolve(__dirname, '../auto-tool-switcher.log');

// Create or clear the log file at startup
try {
  fs.writeFileSync(LOG_PATH, '', { encoding: 'utf8' });
  console.log(`Log file initialized at ${LOG_PATH}`);
} catch (e) {
  console.error(`Failed to initialize log file: ${e.message}`);
}

/**
 * Log a message to both the console and log file
 * @param {...any} args - Arguments to log
 */
function log(...args) {
  // Format objects for better readability
  const formattedArgs = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return '[Object]';
      }
    }
    return arg;
  });
  
  const timestamp = new Date().toISOString();
  const msg = `[${timestamp}] ${formattedArgs.join(' ')}`;
  
  // Log to console
  console.log(msg);
  
  // Log to file with error handling
  try {
    fs.appendFileSync(LOG_PATH, msg + '\n', { encoding: 'utf8', flag: 'a' });
  } catch (e) {
    console.error(`Failed to write to log file: ${e.message}`);
  }
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

// Log all incoming requests with detailed information
app.use((req, res, next) => {
  log('[MCP] Incoming request:', req.method, req.url);
  log('[MCP] Request headers:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    log('[MCP] Request body:', JSON.stringify(req.body, null, 2));
  }
  
  // Add response logging
  const originalSend = res.send;
  res.send = function(body) {
    log('[MCP] Response:', res.statusCode, typeof body === 'object' ? JSON.stringify(body) : body);
    return originalSend.apply(this, arguments);
  };
  
  next();
});

// Minimal MCP endpoints for discovery
app.get('/status', (req, res) => {
  log('[MCP] Status request received');
  res.json({ status: 'ok', type: 'auto-tool-switcher' });
});

// Additional test endpoint for MCP client connectivity
app.get('/mcp/test', (req, res) => {
  log('[MCP] Test endpoint accessed');
  res.json({
    success: true,
    message: 'MCP server is running correctly',
    timestamp: new Date().toISOString(),
    serverInfo: {
      name: 'Auto Tool Switcher',
      version: '1.0.0',
      nodeVersion: process.version,
      platform: process.platform
    }
  });
});

// Required MCP protocol endpoints
app.get('/mcp/info', (req, res) => {
  log('[MCP] MCP info request received');
  log('[MCP] Client detected:', req.headers['user-agent'] || 'Unknown');
  log('[MCP] Client IP:', req.ip || req.connection.remoteAddress || 'Unknown');
  
  res.json({
    name: 'Auto Tool Switcher',
    version: '1.0.0',
    description: 'MCP Auto Tool Switcher server for enabling/disabling MCP servers with a configurable tool limit.',
    capabilities: ['tools/list', 'servers/enable', 'servers/disable'],
    protocol_version: '1.0'
  });
});

// Special endpoint for MCP client detection
app.get('/mcp-client-check', (req, res) => {
  log('[MCP] MCP client check endpoint accessed');
  log('[MCP] Headers:', JSON.stringify(req.headers, null, 2));
  res.json({
    detected: true,
    message: 'MCP client connection successful',
    timestamp: new Date().toISOString()
  });
});

app.get('/mcp/health', (req, res) => {
  log('[MCP] MCP health check received');
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Import getServersConfig from shared utils after setting up basic server
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

// Import serverManager functions after defining fetchToolsList
const { listServers, enableServer, disableServer } = require('./serverManager');

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

// Define and export functions after they're used
module.exports = {
  getServersConfig,
  fetchToolsList
};
