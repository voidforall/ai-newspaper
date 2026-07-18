const MAX_ARTICLE_CHARS = 12_000;
const MAX_DIGEST_INPUT_CHARS = 700;

function decodeEntities(html) {
  return html
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

export function extractReadableText(html) {
  const preferredContent = html.match(/<(article|main)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  return decodeEntities(preferredContent)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ARTICLE_CHARS);
}

function digestInput(text) {
  const firstSentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.slice(0, 2).join(" ").trim() ?? text;
  if (firstSentences.length <= MAX_DIGEST_INPUT_CHARS) return firstSentences;
  const boundary = firstSentences.lastIndexOf(" ", MAX_DIGEST_INPUT_CHARS);
  return `${firstSentences.slice(0, boundary > 0 ? boundary : MAX_DIGEST_INPUT_CHARS)}…`;
}

function canInvestigate(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const privateIpv4 = /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    const localName = host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local");
    return ["http:", "https:"].includes(parsed.protocol) && !privateIpv4 && !localName && host !== "::1";
  } catch {
    return false;
  }
}

export async function investigateArticle(article, fetchPage = fetch) {
  if (!canInvestigate(article.url)) {
    return { ...article, investigation: { status: "skipped", reason: "unsafe-url" } };
  }

  try {
    const response = await fetchPage(article.url, {
      headers: { Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(12_000)
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return { ...article, investigation: { status: "unavailable", reason: "non-html-response" } };
    }
    const content = extractReadableText(await response.text());
    if (!content) return { ...article, investigation: { status: "unavailable", reason: "empty-content" } };
    return {
      ...article,
      rawSummary: digestInput(content),
      content,
      investigation: { status: "complete", extractedCharacters: content.length }
    };
  } catch (error) {
    return { ...article, investigation: { status: "unavailable", reason: error.message } };
  }
}

export function investigateArticles(articles, fetchPage = fetch) {
  const results = new Array(articles.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(3, articles.length) }, async () => {
    while (nextIndex < articles.length) {
      const index = nextIndex++;
      results[index] = await investigateArticle(articles[index], fetchPage);
    }
  });
  return Promise.all(workers).then(() => results);
}
