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
      const eligible = articles.filter((article) => {
        if (!article.publishedAt || (!options.since && !options.until)) return true;
        const timestamp = Date.parse(article.publishedAt);
        return Number.isFinite(timestamp) && (!options.since || timestamp >= Date.parse(options.since)) && (!options.until || timestamp <= Date.parse(options.until));
      });
      if (report.status === "pending") report.status = eligible.length ? "success" : "empty";
      report.fetched = articles.length;
      report.candidates = eligible.length;
      return eligible.map((article) => ({ ...article, sourceRole: source.role ?? "unknown", ...(source.kind ? { kind: source.kind } : {}) }));
    } catch {
      report.status = "failed";
      report.reason = "source-request-failed";
      console.warn(`Source ${source.id} failed; continuing with the other sources.`);
      return [];
    }
  }))).flat();
}
