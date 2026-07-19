function text(value) {
  return typeof value === "string" && value.trim();
}

function sourceConfig(source) {
  if (!text(source?.topic) || !Array.isArray(source?.allowedDomains) || source.allowedDomains.length === 0 || !source.allowedDomains.every((domain) => /^[a-z0-9.-]+$/i.test(domain))) {
    throw new Error(`Agent research source ${source?.id ?? "unknown"} requires a topic and allowedDomains.`);
  }
  return {
    maxCandidates: Number.isSafeInteger(source.maxCandidates) && source.maxCandidates > 0 ? source.maxCandidates : 5,
    maxSearches: Number.isSafeInteger(source.maxSearches) && source.maxSearches > 0 ? source.maxSearches : 1,
    maxOutputTokens: Number.isSafeInteger(source.maxOutputTokens) && source.maxOutputTokens > 0 ? source.maxOutputTokens : 1_000
  };
}

function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  return response.output?.flatMap((item) => item.content ?? []).filter((part) => part.type === "output_text").map((part) => part.text).join("");
}

function candidateUrl(value, domains) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)) ? url.href : undefined;
  } catch { return undefined; }
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function citedUrls(response) {
  return new Set(response.output?.flatMap((item) => item.content ?? []).flatMap((part) => part.annotations ?? []).filter((annotation) => annotation.type === "url_citation").map((annotation) => annotation.url) ?? []);
}

export async function fetchAgentResearch({ source, date, environment = process.env, fetchImpl = fetch } = {}) {
  const { maxCandidates, maxSearches, maxOutputTokens } = sourceConfig(source);
  const model = environment.OPENAI_RESEARCH_MODEL ?? environment.OPENAI_MODEL;
  if (!environment.OPENAI_API_KEY || !model) {
    console.warn(`Agent research skipped for ${source.id}: missing OpenAI credentials.`);
    return [];
  }
  try {
    const response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${environment.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: `Research ${source.topic}${date ? ` for ${date}` : ""}. Return JSON only: {"candidates":[{"title":"string","url":"https://...","summary":"string"}]}. Return at most ${maxCandidates} candidates. Use only the allowed domains and include only reported articles with a direct original URL.`,
        tools: [{ type: "web_search", filters: { allowed_domains: source.allowedDomains } }],
        tool_choice: "required",
        max_tool_calls: maxSearches,
        max_output_tokens: maxOutputTokens
      })
    });
    if (!response.ok) throw new Error(`OpenAI research request failed: ${response.status}`);
    const body = await response.json();
    const candidates = JSON.parse(outputText(body)).candidates;
    const citations = citedUrls(body);
    if (!Array.isArray(candidates)) throw new Error("research output did not contain candidates");
    return candidates.slice(0, maxCandidates).flatMap((candidate, index) => {
      const url = candidateUrl(candidate?.url, source.allowedDomains);
      if (!url || !citations.has(url) || !text(candidate?.title) || !text(candidate?.summary)) return [];
      return [{ id: `agent-${source.id}-${slug(url)}`, sourceId: source.id, title: candidate.title.trim(), url, publishedAt: date ? `${date}T00:00:00.000Z` : undefined, rawSummary: candidate.summary.trim(), score: maxCandidates - index, sourceLinks: [{ name: source.name, url: `https://${source.allowedDomains[0]}/` }, { name: "Original source", url }] }];
    });
  } catch (error) {
    console.warn(`Agent research skipped for ${source.id}: ${error.message}`);
    return [];
  }
}
