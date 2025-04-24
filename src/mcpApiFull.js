const http = require('http');

async function fetchJson(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      method,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function callTool(serverUrl, toolName, args) {
  try {
    const url = serverUrl.replace(/\/$/, '') + '/tools/call';
    const result = await fetchJson(url, 'POST', { name: toolName, arguments: args });
    return result;
  } catch (e) {
    return { error: e.message };
  }
}

async function getPrompt(serverUrl, promptName, args) {
  try {
    const url = serverUrl.replace(/\/$/, '') + '/prompts/get';
    const result = await fetchJson(url, 'POST', { name: promptName, arguments: args });
    return result;
  } catch (e) {
    return { error: e.message };
  }
}

async function readResource(serverUrl, uri) {
  try {
    const url = serverUrl.replace(/\/$/, '') + '/resources/read';
    const result = await fetchJson(url, 'POST', { uri });
    return result;
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = {
  ...require('./mcpApi'),
  callTool,
  getPrompt,
  readResource
};
