function categoryFor(article) {
  const text = `${article.title} ${article.rawSummary ?? ""}`.toLowerCase();
  if (/ai|model|software|database|program|computer|security/.test(text)) return "Technology";
  if (/market|company|funding|business|startup/.test(text)) return "Business";
  return "Ideas";
}

function sourceNameFor(article) {
  return article.sourceLinks?.find((link) => link.name !== "Original source")?.name ?? "the source desk";
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
  const sourceName = sourceNameFor(article);
  const sourceKind = sourceName.toLowerCase();
  const whyItMatters = sourceName === "Hacker News"
    ? `The Hacker News community gave this story ${article.score} points.`
    : sourceKind.includes("arxiv")
      ? "It adds a current research result to the edition."
      : sourceKind.includes("release")
        ? "It records a versioned change that developers can inspect directly."
        : `It adds a direct record from ${sourceName} to the edition.`;
  return {
    articleIds: [article.id],
    headline: article.title,
    summary: article.rawSummary || "Read the discussion and original source.",
    category: categoryFor(article),
    importance: article.score,
    whyItMatters,
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
  const sourceName = sourceNameFor(article).toLowerCase();
  if (sourceName.includes("arxiv")) return "The Research Desk";
  if (sourceName.includes("release")) return "The Release Desk";
  return {
    Technology: "The Build Desk",
    Business: "The Market Desk",
    Ideas: "The Ideas Desk"
  }[categoryFor(article)];
}

function titleStem(value) {
  const [prefix] = value.split(":", 1);
  if (prefix.trim().length >= 3 && prefix.trim().length <= 36) return prefix.trim();
  return shortenHeadline(value, 42);
}

export function editionTitleFor(articles) {
  const lead = articles[0];
  if (!lead?.title) return "The Open Edition";
  return `${titleStem(lead.title)} — ${deskFor(lead)}`;
}

function editorNoteFor(selected, recipe) {
  if (selected.length === 0) return "No qualifying stories were available for this edition.";
  const sourceNames = [...new Set(selected.map(sourceNameFor))];
  const desk = recipe?.name ?? sourceNames.join(", ");
  return `A curated view of ${selected.length} ${selected.length === 1 ? "story" : "stories"} from ${desk}.`;
}

export function createIssue({ date, articles, editionTitle, id = date, maxStories = 10, recipe, sources }) {
  const selected = uniqueByUrl(articles)
    .slice(0, maxStories);

  return {
    id,
    date,
    editionTitle: editionTitle?.trim() || editionTitleFor(selected),
    editorNote: editorNoteFor(selected, recipe),
    stories: selected.map(storyFrom),
    generatedAt: new Date().toISOString(),
    ...(recipe ? { recipe: { id: recipe.id, name: recipe.name } } : {}),
    ...(sources ? { sources: sources.map(({ id, name, type }) => ({ id, name, type })) } : {})
  };
}
