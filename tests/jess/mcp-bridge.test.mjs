import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { McpBridge, sanitizeServerConfig, safeModelToolName, toGeminiSchema, getSafeChildEnvironment } from '../../electron/mcpBridge.cjs';

test('MCP server configuration rejects unsafe transport and malformed executable settings', () => {
  assert.throws(() => sanitizeServerConfig({ name: 'Remote', transport: 'streamable-http', url: 'http://example.com/mcp' }, 'user-a'), /HTTPS/);
  assert.throws(() => sanitizeServerConfig({ name: 'Remote', transport: 'streamable-http', url: 'https://user:pass@example.com/mcp' }, 'user-a'), /credentials/);
  assert.throws(() => sanitizeServerConfig({ name: 'Local', transport: 'stdio', command: 'node', cwd: 'relative/path' }, 'user-a'), /absolute path/);
  assert.throws(() => sanitizeServerConfig({ name: 'Local', transport: 'stdio', command: 'node\nwhoami' }, 'user-a'), /unsupported characters/);
  assert.throws(() => sanitizeServerConfig({ name: 'Local', transport: 'stdio', command: 'node', env: { API_TOKEN: 'plaintext-secret' } }, 'user-a'), /encrypted secret storage/);
  assert.equal(Object.hasOwn(getSafeChildEnvironment(), 'OPENAI_API_KEY'), false);
});

test('MCP tool schema conversion and generated names stay within Gemini constraints', () => {
  const schema = toGeminiSchema({
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search text' },
      limit: { type: 'integer', enum: [1, 2, 3] },
      filters: { type: 'array', items: { type: 'string' } },
    },
    required: ['query', 'missing'],
  });
  assert.equal(schema.type, 'OBJECT');
  assert.equal(schema.properties.query.type, 'STRING');
  assert.equal(schema.properties.limit.type, 'INTEGER');
  assert.deepEqual(schema.required, ['query']);
  assert.equal(schema.properties.filters.items.type, 'STRING');

  const used = new Set();
  const longName = safeModelToolName('a-server-id-that-is-very-long', 'a-tool-name-that-is-also-extremely-long-and-should-be-truncated-to-fit-the-provider-limit', used);
  const duplicate = safeModelToolName('a-server-id-that-is-very-long', 'a-tool-name-that-is-also-extremely-long-and-should-be-truncated-to-fit-the-provider-limit', used);
  assert.ok(longName.length <= 64);
  assert.ok(duplicate.length <= 64);
  assert.notEqual(longName, duplicate);
});

test('stdio MCP servers initialize, publish tools, execute calls, and stay scoped to the owning user', async () => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'hubmind-mcp-test-'));
  const bridge = new McpBridge({ userDataPath, timeoutMs: 5000 });
  const fakeServer = [
    "const readline = require('node:readline');",
    "const rl = readline.createInterface({ input: process.stdin });",
    "rl.on('line', line => {",
    "  let message; try { message = JSON.parse(line); } catch { return; }",
    "  let result = {};",
    "  if (message.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'fake-server', version: '1' } };",
    "  else if (message.method === 'tools/list') result = { tools: [{ name: 'echo_tool', description: 'Echo a message', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } }] };",
    "  else if (message.method === 'tools/call') result = { content: [{ type: 'text', text: String(message.params.arguments.message) }] };",
    "  if (message.id !== undefined) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) + '\\n');",
    "});",
  ].join('\n');

  try {
    const servers = await bridge.saveServer({
      id: 'test-server',
      name: 'Local test server',
      transport: 'stdio',
      command: process.execPath,
      args: ['-e', fakeServer],
      enabled: true,
    }, 'user-a');

    assert.equal(servers.length, 1);
    assert.equal(servers[0].connected, true);
    assert.equal(servers[0].toolCount, 1);

    const tools = bridge.listTools('user-a');
    assert.equal(tools.length, 1);
    assert.match(tools[0].name, /^mcp_test_server_echo_tool$/);
    assert.equal(bridge.listTools('user-b').length, 0);

    const result = await bridge.callTool('user-a', tools[0].name, { message: 'hello from Jess' });
    assert.equal(result.content[0].text, 'hello from Jess');
    await assert.rejects(() => bridge.callTool('user-b', tools[0].name, { message: 'unauthorized' }), /not available/);

    await bridge.removeServer('user-a', 'test-server');
    assert.equal(bridge.listTools('user-a').length, 0);
  } finally {
    await bridge.shutdown();
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});
