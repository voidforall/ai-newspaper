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
    sourceLinks: article.sourceLinks
  };
}

export function createIssue({ date, articles, editionTitle = "The Daily Signal", id = date }) {
  const selected = uniqueByUrl(articles)
    .slice(0, 10);

  return {
    id,
    date,
    editionTitle,
    editorNote: selected.length
      ? `A curated view of ${selected.length} stories shaping today's Hacker News conversation.`
      : "No qualifying stories were available for this edition.",
    stories: selected.map(storyFrom),
    generatedAt: new Date().toISOString()
  };
}
