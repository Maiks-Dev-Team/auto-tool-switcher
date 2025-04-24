const http = require('http');

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
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
  });
}

async function listServerTools(serverUrl) {
  // MCP servers should expose /tools/list endpoint
  try {
    const url = serverUrl.replace(/\/$/, '') + '/tools/list';
    const result = await fetchJson(url);
    return result.tools || [];
  } catch (e) {
    return { error: e.message };
  }
}

async function listServerPrompts(serverUrl) {
  try {
    const url = serverUrl.replace(/\/$/, '') + '/prompts/list';
    const result = await fetchJson(url);
    return result.prompts || [];
  } catch (e) {
    return { error: e.message };
  }
}

async function listServerResources(serverUrl) {
  try {
    const url = serverUrl.replace(/\/$/, '') + '/resources/list';
    const result = await fetchJson(url);
    return result.resources || [];
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = {
  listServerTools,
  listServerPrompts,
  listServerResources
};
