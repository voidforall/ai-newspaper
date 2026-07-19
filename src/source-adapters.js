import { fetchTopStories } from "./hacker-news.js";
import { fetchGitHubReleases } from "./github-releases.js";
import { fetchRssFeed } from "./rss.js";

const adapters = {
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
