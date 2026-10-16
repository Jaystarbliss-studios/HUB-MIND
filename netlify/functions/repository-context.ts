const REPO = 'Jaystarbliss-studios/HUB-MIND';
const API = 'https://api.github.com';
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'Hub-Mind-Jess-Repository-Context',
};
const responseJson = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60, s-maxage=60' },
});
async function githubJson(path: string) {
  const response = await fetch(API + path, { headers, signal: AbortSignal.timeout(9000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = String(payload?.message || 'GitHub API request failed').slice(0, 300);
    throw new Error('GitHub repository context unavailable (' + response.status + '): ' + detail);
  }
  return payload;
}
export default async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') return responseJson({ error: 'Method not allowed' }, 405);
  try {
    const [repository, commits, pulls] = await Promise.all([
      githubJson('/repos/' + REPO),
      githubJson('/repos/' + REPO + '/commits?per_page=12'),
      githubJson('/repos/' + REPO + '/pulls?state=all&sort=updated&direction=desc&per_page=20'),
    ]);
    const recentPullRequests = (Array.isArray(pulls) ? pulls : []).map((pr: any) => ({
      number: pr.number,
      title: String(pr.title || '').slice(0, 300),
      state: pr.merged_at ? 'merged' : pr.state,
      mergedAt: pr.merged_at || null,
      updatedAt: pr.updated_at || null,
      url: pr.html_url || '',
      base: pr.base?.ref || '',
      head: pr.head?.ref || '',
      summary: String(pr.body || '').slice(0, 5000),
    }));
    return responseJson({
      repository: REPO,
      defaultBranch: repository.default_branch,
      updatedAt: repository.updated_at,
      fetchedAt: new Date().toISOString(),
      recentCommits: (Array.isArray(commits) ? commits : []).map((commit: any) => ({
        sha: String(commit.sha || '').slice(0, 12),
        message: String(commit.commit?.message || '').split('\n')[0].slice(0, 400),
        committedAt: commit.commit?.committer?.date || commit.commit?.author?.date || null,
        url: commit.html_url || '',
      })),
      recentPullRequests,
      interpretationRules: [
        'A merged pull request is evidence that its listed changes entered the target branch, not proof every feature passed manual acceptance testing.',
        'An open pull request is proposed work and must not be described as implemented in production.',
        'Commit titles alone are not proof of runtime behavior; report tests and release evidence separately.',
      ],
    });
  } catch (error: any) {
    const detail = String(error?.message || 'Unknown GitHub API error').slice(0, 500);
    return responseJson({ error: 'Could not load live Hub-Mind repository status.', detail, repository: REPO }, 502);
  }
};
