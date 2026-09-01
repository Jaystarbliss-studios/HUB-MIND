export function getShareUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

export function shareHubMindItem(path: string, label: string): void {
  const url = getShareUrl(path);
  const text = `Hub-Mind: ${label}\n${url}`;
  if (navigator.share) {
    navigator.share({ title: `Hub-Mind — ${label}`, text: `Open this in Hub-Mind: ${label}`, url }).catch(() => {});
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

export function copyShareUrl(path: string): Promise<void> {
  return navigator.clipboard.writeText(getShareUrl(path));
}
