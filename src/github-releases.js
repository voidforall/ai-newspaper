import { fetchWithRetry } from "./http.js";

function repositoryFor(source) {
  if (typeof source?.repository !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.repository)) {
    throw new Error(`GitHub release source ${source?.id ?? "unknown"} requires an owner/repository value.`);
  }
  return source.repository;
}

function publishedOnDate(release, date) {
  return !date || release.published_at?.startsWith(date);
}

export async function fetchGitHubReleases({ source, date, limit = 30, fetchImpl = fetch } = {}) {
  const repository = repositoryFor(source);
  const releases = [];
  for (let page = 1; ; page += 1) {
    const response = await fetchWithRetry(`https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`, {
      headers: { Accept: "application/vnd.github+json" }
    }, { fetchImpl });
    if (!response.ok) throw new Error(`GitHub releases request failed: ${response.status}`);
    const releasePage = await response.json();
    if (!Array.isArray(releasePage)) throw new Error("GitHub releases response must be an array.");
    releases.push(...releasePage);
    if (!date || releasePage.length === 0 || releasePage.some((release) => release.published_at?.slice(0, 10) < date)) break;
  }

  return releases
    .filter((release) => !release.draft && !release.prerelease && release.html_url && release.published_at && publishedOnDate(release, date))
    .slice(0, limit)
    .map((release, index) => ({
      id: `github-release-${release.id}`,
      sourceId: source.id,
      title: release.name || `${repository} ${release.tag_name}`,
      url: release.html_url,
      publishedAt: new Date(release.published_at).toISOString(),
      rawSummary: release.body ?? "",
      score: Math.max(1, limit - index),
      sourceLinks: [
        { name: source.name, url: `https://github.com/${repository}/releases` },
        { name: "Original source", url: release.html_url }
      ]
    }));
}
