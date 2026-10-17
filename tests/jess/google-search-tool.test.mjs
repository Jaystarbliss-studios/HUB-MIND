import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('google_search is declared for Jess Live and routed through the grounded web-search executor', async () => {
  const [server, tools, service] = await Promise.all([
    read('../../server.ts'),
    read('../../src/lib/jessTools.ts'),
    read('../../src/server/webSearchService.ts'),
  ]);
  assert.ok(server.includes('name: "google_search"'));
  assert.ok(server.includes('required: ["query"]'));
  assert.ok(tools.includes("name: 'google_search'"));
  assert.match(tools, /case 'google_search':\s*case 'search_web':/);
  assert.ok(tools.includes("['google_search', 'search_web', 'desktop_open_website'].includes(name)"));
  assert.ok(server.includes('app.post("/api/web-search"'));
  assert.ok(service.includes('tools: [{ googleSearch: {} }]'));
  assert.ok(service.includes('groundingMetadata'));
});

test('GitHub token remains server-only and repository status exposes release, commit, and authentication details', async () => {
  const [service, env, tools] = await Promise.all([
    read('../../src/server/githubService.ts'),
    read('../../.env.example'),
    read('../../src/lib/jessTools.ts'),
  ]);
  assert.ok(service.includes('process.env.GITHUB_TOKEN || process.env.GH_TOKEN'));
  assert.ok(service.includes('headers.Authorization'));
  assert.ok(service.includes('githubAuthentication:'));
  assert.ok(service.includes('recentCommits: commits'));
  assert.ok(service.includes('latestRelease'));
  assert.ok(env.includes('GITHUB_TOKEN="YOUR_GITHUB_TOKEN"'));
  assert.ok(tools.includes("name: 'get_hubmind_repository_status'"));
});
