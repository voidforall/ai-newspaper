const API_ROOT = "https://hacker-news.firebaseio.com/v0";

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Hacker News request failed: ${response.status}`);
  return response.json();
}

export async function fetchTopStories({ limit = 30, now = Date.now() } = {}) {
  const ids = await getJson(`${API_ROOT}/topstories.json`);
  const stories = await Promise.all(ids.slice(0, limit).map((id) => getJson(`${API_ROOT}/item/${id}.json`)));
  const dayAgo = now - 24 * 60 * 60 * 1000;

  return stories
    .filter((story) => story?.type === "story" && story.title && story.url && story.time * 1000 >= dayAgo)
    .map((story) => ({
      id: `hn-${story.id}`,
      sourceId: "hacker-news",
      title: story.title,
      url: story.url,
      publishedAt: new Date(story.time * 1000).toISOString(),
      rawSummary: story.text ?? "",
      score: story.score ?? 0,
      sourceLinks: [
        { name: "Hacker News", url: `https://news.ycombinator.com/item?id=${story.id}` },
        { name: "Original source", url: story.url }
      ]
    }));
}
