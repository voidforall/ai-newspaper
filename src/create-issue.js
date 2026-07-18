const SOURCE_NAMES = {
  "hacker-news": "Hacker News"
};

function categoryFor(article) {
  const text = `${article.title} ${article.rawSummary ?? ""}`.toLowerCase();
  if (/ai|model|software|database|program|computer|security/.test(text)) return "Technology";
  if (/market|company|funding|business|startup/.test(text)) return "Business";
  return "Ideas";
}

function uniqueByUrl(articles) {
  const highestScored = new Map();
  for (const article of articles) {
    const existing = highestScored.get(article.url);
    if (!existing || article.score > existing.score) highestScored.set(article.url, article);
  }
  return [...highestScored.values()];
}

function storyFrom(article) {
  return {
    articleIds: [article.id],
    headline: article.title,
    summary: article.rawSummary || "Read the discussion and original source.",
    category: categoryFor(article),
    importance: article.score,
    whyItMatters: `The Hacker News community gave this story ${article.score} points.`,
    sourceLinks: [
      { name: SOURCE_NAMES[article.sourceId] ?? article.sourceId, url: `https://news.ycombinator.com/item?id=${article.id.replace(/^hn-/, "")}` },
      { name: "Original source", url: article.url }
    ]
  };
}

export function createIssue({ date, articles, editionTitle = "The Daily Signal" }) {
  const selected = uniqueByUrl(articles)
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);

  return {
    date,
    editionTitle,
    editorNote: selected.length
      ? `A curated view of ${selected.length} stories shaping today's Hacker News conversation.`
      : "No qualifying stories were available for this edition.",
    stories: selected.map(storyFrom),
    generatedAt: new Date().toISOString()
  };
}
