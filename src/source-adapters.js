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
  return (await Promise.all(sources.map((source) => {
    const adapter = adapters[source.adapter ?? source.id];
    if (!adapter) throw new Error(`No adapter is registered for source: ${source.id}`);
    return adapter({ ...options, source });
  }))).flat();
}
