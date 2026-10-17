import test from 'node:test';
import assert from 'node:assert/strict';
import { getFullRepositoryStatus } from '../../src/server/githubService.ts';

test('GitHub repository service authenticates and loads release notes, commits, and repository metadata', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.GITHUB_TOKEN;
  const calls = [];
  process.env.GITHUB_TOKEN = 'ci-test-token';

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const headers = init.headers || {};
    calls.push({ url, headers });

    let payload;
    if (url.endsWith('/releases?per_page=30')) {
      payload = [{
        id: 2,
        tag_name: 'desktop-test-v2',
        name: 'Desktop Test Release',
        published_at: '2026-10-01T12:00:00Z',
        html_url: 'https://github.com/Jaystarbliss-studios/HUB-MIND/releases/tag/desktop-test-v2',
        body: 'Glass overlay improvements and live web research.',
        assets: [{ id: 7, name: 'Hub-Mind-Setup-x64.exe', size: 1024, browser_download_url: 'https://example.test/installer.exe', download_count: 4 }],
      }];
    } else if (url.includes('/commits?per_page=')) {
      payload = [{
        sha: '0123456789abcdef',
        commit: { message: 'feat: add Google search tool\n\nLonger details', author: { name: 'Test Author', date: '2026-10-02T12:00:00Z' } },
        html_url: 'https://github.com/Jaystarbliss-studios/HUB-MIND/commit/0123456789abcdef',
      }];
    } else if (url.endsWith('/pulls?state=all&per_page=5')) {
      payload = [];
    } else if (url === 'https://api.github.com/repos/Jaystarbliss-studios/HUB-MIND') {
      payload = {
        name: 'HUB-MIND',
        full_name: 'Jaystarbliss-studios/HUB-MIND',
        description: 'Jaystarbliss Studios operations platform',
        html_url: 'https://github.com/Jaystarbliss-studios/HUB-MIND',
        stargazers_count: 12,
        forks_count: 3,
        open_issues_count: 5,
        default_branch: 'main',
        updated_at: '2026-10-03T12:00:00Z',
      };
    } else {
      throw new Error('Unexpected GitHub API URL: ' + url);
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const status = await getFullRepositoryStatus();
    assert.equal(status.success, true);
    assert.equal(status.repository, 'Jaystarbliss-studios/HUB-MIND');
    assert.deepEqual(status.githubAuthentication, { authenticated: true, mode: 'token-authenticated' });
    assert.equal(status.latestRelease.body, 'Glass overlay improvements and live web research.');
    assert.equal(status.recentCommits[0].message, 'feat: add Google search tool');
    assert.equal(status.overview.fullName, 'Jaystarbliss-studios/HUB-MIND');
    assert.equal(status.overview.stars, 12);

    assert.ok(calls.some(call => call.url.endsWith('/releases?per_page=30')));
    assert.ok(calls.some(call => call.url.includes('/commits?per_page=')));
    assert.ok(calls.some(call => call.url === 'https://api.github.com/repos/Jaystarbliss-studios/HUB-MIND'));
    for (const call of calls) {
      assert.equal(call.headers.Authorization, 'Bearer ci-test-token');
      assert.equal(call.headers.Accept, 'application/vnd.github+json');
      assert.equal(call.headers['X-GitHub-Api-Version'], '2022-11-28');
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
  }
});
