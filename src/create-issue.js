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

function shortenHeadline(value, limit = 56) {
  const headline = value.replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim();
  if (headline.length <= limit) return headline;
  const boundary = headline.lastIndexOf(" ", limit);
  return `${headline.slice(0, boundary > 20 ? boundary : limit).trim()}…`;
}

function deskFor(article) {
  return {
    Technology: "The Build Desk",
    Business: "The Market Desk",
    Ideas: "The Ideas Desk"
  }[categoryFor(article)];
}

export function editionTitleFor(articles) {
  const lead = articles[0];
  if (!lead?.title) return "The Open Edition";
  return `${shortenHeadline(lead.title)} — ${deskFor(lead)}`;
}

export function createIssue({ date, articles, editionTitle, id = date, maxStories = 10, recipe, sources }) {
  const selected = uniqueByUrl(articles)
    .slice(0, maxStories);

  return {
    id,
    date,
    editionTitle: editionTitle?.trim() || editionTitleFor(selected),
    editorNote: selected.length
      ? `A curated view of ${selected.length} stories shaping today's Hacker News conversation.`
      : "No qualifying stories were available for this edition.",
    stories: selected.map(storyFrom),
    generatedAt: new Date().toISOString(),
    ...(recipe ? { recipe: { id: recipe.id, name: recipe.name } } : {}),
    ...(sources ? { sources: sources.map(({ id, name, type }) => ({ id, name, type })) } : {})
  };
}
