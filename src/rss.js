function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|#38);/g, "&")
    .replace(/&(?:lt|#60);/g, "<")
    .replace(/&(?:gt|#62);/g, ">")
    .replace(/&(?:quot|#34);/g, '"')
    .replace(/&(?:apos|#39);/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function contentFor(entry, tag) {
  const match = entry.match(new RegExp(`<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`, "i"));
  return decodeXml(match?.[1]);
}

function linkFor(entry) {
  const atomLinks = [...entry.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map((match) => ({
    url: match[1],
    rel: match[0].match(/\brel=["']([^"']+)["']/i)?.[1]?.toLowerCase()
  })).filter((link) => safeHttpUrl(link.url));
  const preferred = atomLinks.find((link) => !link.rel || link.rel === "alternate") ?? atomLinks[0];
  return preferred?.url ?? contentFor(entry, "link");
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function entryBlocks(xml) {
  return [...xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)].map((match) => match[1]);
}

function entryDate(entry) {
  const value = contentFor(entry, "published") || contentFor(entry, "updated") || contentFor(entry, "pubDate");
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
}

function identifier(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function fetchRssFeed({ source, date, limit = 30, fetchImpl = fetch } = {}) {
  const feedUrl = safeHttpUrl(source?.feedUrl);
  if (!feedUrl) throw new Error(`RSS source ${source?.id ?? "unknown"} requires an HTTP(S) feedUrl.`);
  const response = await fetchImpl(feedUrl);
  if (!response.ok) throw new Error(`RSS request failed: ${response.status}`);
  const xml = await response.text();

  return entryBlocks(xml).map((entry, index) => {
    const title = contentFor(entry, "title");
    const url = safeHttpUrl(linkFor(entry));
    const publishedAt = entryDate(entry);
    const entryId = contentFor(entry, "id") || url;
    if (!title || !url || !publishedAt || !entryId) return undefined;
    return {
      id: `${source.id}-${identifier(entryId)}`,
      sourceId: source.id,
      title,
      url,
      publishedAt,
      rawSummary: contentFor(entry, "summary") || contentFor(entry, "description") || contentFor(entry, "content"),
      score: Math.max(1, limit - index),
      sourceLinks: [
        { name: source.name, url: feedUrl },
        { name: "Original source", url }
      ]
    };
  }).filter((article) => article && (!date || article.publishedAt.startsWith(date))).slice(0, limit);
}
