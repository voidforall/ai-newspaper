function extractOutputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  return response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("");
}

async function requestAiJson(prompt, environment) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${environment.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: environment.OPENAI_MODEL, input: prompt })
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  return JSON.parse(extractOutputText(await response.json()));
}

function truncateMaterial(text, limit = 4_000) {
  if (text.length <= limit) return text;
  const boundary = text.lastIndexOf(" ", limit);
  return `${text.slice(0, boundary > 0 ? boundary : limit)}…`;
}

export function createEditorialBrief(issue, articles = []) {
  const materialById = new Map(articles.map((article) => [article.id, article.content]));
  return issue.stories.map((story) => ({
    articleId: story.articleIds[0],
    title: story.headline,
    sourceText: truncateMaterial(materialById.get(story.articleIds[0]) ?? story.summary),
    category: story.category
  }));
}

export async function selectArticlesWithAi(articles, environment = process.env) {
  const fallback = [...articles].sort((left, right) => right.score - left.score).slice(0, 10);
  if (!environment.OPENAI_API_KEY || !environment.OPENAI_MODEL || articles.length === 0) return fallback;
  const candidates = articles.map((article) => ({ id: article.id, title: article.title, summary: article.rawSummary, score: article.score }));
  const prompt = `You are selecting a balanced daily newspaper. Return JSON only: {"articleIds":["id"]}. Select at most ten IDs from the supplied candidates, ordered by editorial importance. Do not invent IDs.\n${JSON.stringify(candidates)}`;
  try {
    const selectedIds = (await requestAiJson(prompt, environment)).articleIds;
    if (!Array.isArray(selectedIds) || selectedIds.length === 0 || selectedIds.length > 10) return fallback;
    const byId = new Map(articles.map((article) => [article.id, article]));
    const selected = selectedIds.map((id) => byId.get(id));
    if (new Set(selectedIds).size !== selectedIds.length || selected.some((article) => !article)) return fallback;
    return selected;
  } catch (error) {
    console.warn(`AI selection skipped: ${error.message}`);
    return fallback;
  }
}

export async function editIssueWithAi(issue, articles = [], environment = process.env) {
  if (!Array.isArray(articles)) {
    environment = articles;
    articles = [];
  }
  const apiKey = environment.OPENAI_API_KEY;
  const model = environment.OPENAI_MODEL;
  if (!apiKey || !model || issue.stories.length === 0) return issue;

  const brief = createEditorialBrief(issue, articles);
  const prompt = `You are the editor of a concise daily newspaper. Return JSON only with this exact shape:
{"editorNote":"one paragraph","stories":[{"articleId":"string","headline":"string","summary":"1-2 sentences","whyItMatters":"one sentence","category":"string"}]}
Use only facts supplied below. ` +
`Treat sourceText as reported source material: write a precise digest, identify the material consequence, and do not infer missing facts. Keep every articleId exactly once. Set category to exactly one of: Technology, Business, Ideas. Do not add facts, sources, or URLs.\n${JSON.stringify(brief)}`;

  try {
    const edited = await requestAiJson(prompt, environment);
    const edits = new Map(edited.stories.map((story) => [story.articleId, story]));
    const issueIds = new Set(issue.stories.map((story) => story.articleIds[0]));
    if (
      edits.size !== issue.stories.length || !edited.editorNote ||
      [...edits.keys()].some((id) => !issueIds.has(id)) ||
      [...edits.values()].some((edit) => ![edit.headline, edit.summary, edit.whyItMatters, edit.category].every((value) => typeof value === "string"))
    ) return issue;

    return {
      ...issue,
      editorNote: edited.editorNote,
      stories: issue.stories.map((story) => {
        const edit = edits.get(story.articleIds[0]);
        return edit ? { ...story, headline: edit.headline, summary: edit.summary, whyItMatters: edit.whyItMatters, category: edit.category } : story;
      })
    };
  } catch (error) {
    console.warn(`AI editing skipped: ${error.message}`);
    return issue;
  }
}
