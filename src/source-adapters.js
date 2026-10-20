import { fetchTopStories } from "./hacker-news.js";
import { fetchAgentResearch } from "./agent-research.js";
import { fetchGitHubReleases } from "./github-releases.js";
import { fetchRssFeed } from "./rss.js";

const adapters = {
  "agent-research": fetchAgentResearch,
  "hacker-news": fetchTopStories,
  "github-releases": fetchGitHubReleases,
  rss: fetchRssFeed
};

export async function fetchConfiguredArticles(sources, options = {}) {
  return (await Promise.all(sources.map(async (source) => {
    const adapter = adapters[source.adapter ?? source.id];
    if (!adapter) throw new Error(`No adapter is registered for source: ${source.id}`);
    const report = { id: source.id, adapter: source.adapter ?? source.id, status: "pending", candidates: 0 };
    options.sourceReport?.push(report);
    try {
      const articles = await adapter({ ...options, source, sourceResult: report });
      if (report.status === "pending") report.status = articles.length ? "success" : "empty";
      report.candidates = articles.length;
      return articles;
    } catch {
      report.status = "failed";
      report.reason = "source-request-failed";
      console.warn(`Source ${source.id} failed; continuing with the other sources.`);
      return [];
    }
  }))).flat();
}
