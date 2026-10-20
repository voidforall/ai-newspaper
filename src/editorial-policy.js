const sourceOrder = { primary: 0, analysis: 1, community: 2, unknown: 3 };

export function canonicalArticleUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || ["fbclid", "gclid"].includes(key.toLowerCase())) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.href;
  } catch { return undefined; }
}

function preferredArticle(first, second) {
  const difference = (sourceOrder[first.sourceRole] ?? 3) - (sourceOrder[second.sourceRole] ?? 3);
  if (difference !== 0) return difference < 0 ? first : second;
  if (first.sourceId === second.sourceId && (second.score ?? 0) > (first.score ?? 0)) return second;
  if (!first.material && second.material) return second;
  return first;
}

function attributionLinks(articles) {
  const links = new Map();
  for (const article of articles) {
    for (const link of article.sourceLinks ?? []) {
      const canonical = canonicalArticleUrl(link.url);
      if (!canonical) continue;
      const key = `${link.name}:${link.name === "Original source" ? canonical : link.url}`;
      if (!links.has(key)) links.set(key, link);
    }
  }
  return [...links.values()];
}

export function mergeDuplicateCandidates(articles) {
  const groups = new Map();
  for (const article of articles) {
    const canonicalUrl = canonicalArticleUrl(article.url);
    if (!canonicalUrl) continue;
    const existing = groups.get(canonicalUrl);
    const winner = existing ? preferredArticle(existing, article) : article;
    const loser = winner === article ? existing : article;
    groups.set(canonicalUrl, {
      ...winner, canonicalUrl,
      articleIds: [...new Set([...(winner.articleIds ?? [winner.id]), ...(loser?.articleIds ?? (loser ? [loser.id] : []))])],
      sourceLinks: attributionLinks(loser ? [winner, loser] : [winner]),
      kind: contentKind(winner, canonicalUrl)
    });
  }
  return [...groups.values()];
}

function contentKind(article, canonicalUrl) {
  if (["paper", "release"].includes(article.kind)) return article.kind;
  const url = new URL(canonicalUrl);
  if (url.hostname === "arxiv.org" && /^\/abs\//.test(url.pathname)) return "paper";
  if (article.material?.kind === "release-notes" || (url.hostname === "github.com" && /^\/[^/]+\/[^/]+\/releases\/tag\//.test(url.pathname))) return "release";
  return "news";
}

export function topicFor(article) {
  if (article.topic) return article.topic.trim().toLowerCase();
  const text = `${article.title} ${article.rawSummary ?? ""}`;
  if (/\b(?:rag|retrieval|embeddings?|vector)\b|检索|向量/i.test(text)) return "retrieval";
  if (/\b(?:agents?|mcp|tools?|sdk)\b|智能体|工具/i.test(text)) return "agents-and-tools";
  if (/\b(?:train|training|fine.?tun|datasets?)\b|训练|数据集/i.test(text)) return "training";
  if (/\b(?:models?|llms?|inference|gpu|cuda|openai|anthropic|claude|gemini)\b|模型|推理/i.test(text)) return "models-and-inference";
  return "engineering";
}

function relevantToAiBuilder(article) {
  const text = `${article.title} ${article.rawSummary ?? ""}`;
  if (/limited.time (?:discount|offer)|claim your|coupon|join (?:the|our) waitlist|revolutionary|game.changing|限时优惠|优惠券|革命性|加入等候名单/i.test(text)) return false;
  if (["paper", "release"].includes(article.kind)) return true;
  const relevant = /\b(?:ai|llms?|agents?|mcp|rag|retrieval|embeddings?|vector|transformers?|inference|gpu|cuda|openai|anthropic|claude|gemini)\b|人工智能|大模型|智能体|模型推理/i.test(text);
  const technical = /\b(?:api|sdk|mcp|rag|retrieval|embeddings?|inference|gpu|cuda|benchmark|evaluation|dataset|training|compatibility|migration)\b|接口|评测|吞吐|兼容|迁移|训练|检索|向量/i.test(text);
  return relevant && technical && (topicFor(article) !== "engineering" || article.sourceRole === "analysis");
}

export function limitSelection(articles, maxStories, policy) {
  const sources = new Map();
  const topics = new Map();
  const selected = [];
  for (const article of articles) {
    if (selected.length >= maxStories) break;
    const topic = topicFor(article);
    const source = article.sourceId ?? "unknown";
    if ((sources.get(source) ?? 0) >= (policy?.maxPerSource ?? Infinity) || (topics.get(topic) ?? 0) >= (policy?.maxPerTopic ?? Infinity)) continue;
    selected.push({ ...article, topic });
    sources.set(source, (sources.get(source) ?? 0) + 1);
    topics.set(topic, (topics.get(topic) ?? 0) + 1);
  }
  return selected;
}

export function fallbackSelection(candidates, maxStories, policy) {
  const groups = new Map();
  for (const article of candidates) {
    if (policy && !relevantToAiBuilder(article)) continue;
    const source = article.sourceId ?? "unknown";
    const group = groups.get(source) ?? [];
    group.push(article);
    groups.set(source, group);
  }
  const queues = [...groups.values()].sort((a, b) => (sourceOrder[a[0].sourceRole] ?? 3) - (sourceOrder[b[0].sourceRole] ?? 3));
  // Scores are only compared inside one source; source queues alternate across the edition.
  for (const queue of queues) queue.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const balanced = [];
  for (let index = 0; queues.some((queue) => index < queue.length); index += 1) {
    for (const queue of queues) if (queue[index]) balanced.push(queue[index]);
  }
  return limitSelection(balanced, maxStories, policy);
}
