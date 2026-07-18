function extractOutputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  return response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("");
}

export async function editIssueWithAi(issue, environment = process.env) {
  const apiKey = environment.OPENAI_API_KEY;
  const model = environment.OPENAI_MODEL;
  if (!apiKey || !model || issue.stories.length === 0) return issue;

  const brief = issue.stories.map((story) => ({
    articleId: story.articleIds[0], title: story.headline, summary: story.summary, category: story.category
  }));
  const prompt = `You are the editor of a concise daily newspaper. Return JSON only with this exact shape:
{"editorNote":"one paragraph","stories":[{"articleId":"string","headline":"string","summary":"1-2 sentences","whyItMatters":"one sentence","category":"string"}]}
Use only facts supplied below. Keep every articleId exactly once. Do not add facts, sources, or URLs.\n${JSON.stringify(brief)}`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: prompt })
    });
    if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
    const edited = JSON.parse(extractOutputText(await response.json()));
    const edits = new Map(edited.stories.map((story) => [story.articleId, story]));
    if (edits.size !== issue.stories.length || !edited.editorNote) return issue;

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
