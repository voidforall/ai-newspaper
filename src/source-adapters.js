import { fetchTopStories } from "./hacker-news.js";

const adapters = {
  "hacker-news": fetchTopStories
};

export async function fetchConfiguredArticles(sources) {
  const activeSources = sources.filter((source) => source.enabled);
  return (await Promise.all(activeSources.map((source) => {
    const adapter = adapters[source.id];
    if (!adapter) throw new Error(`No adapter is registered for source: ${source.id}`);
    return adapter();
  }))).flat();
}
