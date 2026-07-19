import { fetchTopStories } from "./hacker-news.js";

const adapters = {
  "hacker-news": fetchTopStories
};

export async function fetchConfiguredArticles(sources, options = {}) {
  return (await Promise.all(sources.map((source) => {
    const adapter = adapters[source.adapter ?? source.id];
    if (!adapter) throw new Error(`No adapter is registered for source: ${source.id}`);
    return adapter({ ...options, source });
  }))).flat();
}
