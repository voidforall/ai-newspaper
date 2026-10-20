import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import { fetchWithRetry } from "./http.js";

const MAX_ARTICLE_CHARS = 12_000;
const MAX_RESPONSE_BYTES = 2_000_000;
const MIN_MATERIAL_CHARS = 80;
const TRUNCATION_NOTICE = "[Source shortened: middle section omitted.]";

function normalizeText(value = "") {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= MAX_ARTICLE_CHARS) return text;
  return `${text.slice(0, 8_000)} ${TRUNCATION_NOTICE} ${text.slice(-3_500)}`;
}

function documentFor(html, url) {
  // Scripts and remote resources remain disabled (the jsdom defaults).
  return new JSDOM(html, { url, virtualConsole: new VirtualConsole() });
}

export function extractReadableText(html, url = "https://example.com/") {
  const dom = documentFor(html, url);
  try {
    const document = dom.window.document;
    document.querySelectorAll('script,style,noscript,nav,footer,header,aside,form,dialog,[role="dialog"],[aria-hidden="true"],.advertisement,.cookie-banner').forEach((node) => node.remove());
    if (new URL(url).hostname === "arxiv.org") {
      const abstract = document.querySelector("blockquote.abstract");
      abstract?.querySelector(".descriptor")?.remove();
      return normalizeText(abstract?.textContent);
    }
    const result = new Readability(document, { charThreshold: MIN_MATERIAL_CHARS, maxElemsToParse: 20_000 }).parse();
    return normalizeText(result?.textContent);
  } finally {
    dom.window.close();
  }
}

function digestInput(text) {
  const sentences = [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(text)].slice(0, 2).map((part) => part.segment).join("").trim();
  if (sentences.length <= 700) return sentences;
  const boundary = sentences.lastIndexOf(" ", 700);
  return `${sentences.slice(0, boundary > 0 ? boundary : 700)}…`;
}

function canInvestigate(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const privateIpv4 = /^(0\.|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    const localName = host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local");
    const privateIpv6 = host === "::" || host === "::1" || host.startsWith("::ffff:") || /^(?:f[cd][\da-f]{2}|fe[89ab][\da-f]):/.test(host);
    return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password && !privateIpv4 && !privateIpv6 && !localName;
  } catch {
    return false;
  }
}

async function requestMaterial(url, fetchPage, headers = {}) {
  const signal = AbortSignal.timeout(12_000);
  let current = url;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    if (!canInvestigate(current)) throw new Error("unsafe-redirect");
    const response = await fetchWithRetry(current, {
      headers: { Accept: "text/html,application/xhtml+xml", ...headers }, signal, redirect: "manual"
    }, { fetchImpl: fetchPage });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      current = new URL(location, current).href;
      continue;
    }
    if (!response.ok) throw new Error("source-http-error");
    return { response, url: current };
  }
  throw new Error("too-many-redirects");
}

async function boundedText(response) {
  if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) throw new Error("source-too-large");
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) throw new Error("source-too-large");
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("source-too-large");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function markdownText(markdown) {
  return normalizeText(markdown
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/```[^\n]*\n|```/g, ""));
}

function withMaterial(article, text, { status = "complete", method, sourceUrl, fetchedAt, reason } = {}) {
  const content = normalizeText(text);
  if (content.length < MIN_MATERIAL_CHARS) throw new Error("insufficient-source-material");
  return {
    ...article, content, rawSummary: digestInput(content), fetchedAt,
    investigation: { status, method, sourceUrl, ...(reason ? { reason } : {}), truncated: content.includes(TRUNCATION_NOTICE), extractedCharacters: content.length }
  };
}

export function hasEditorialMaterial(article) {
  return typeof article.content === "string" && article.content.trim().length >= MIN_MATERIAL_CHARS && ["complete", "fallback"].includes(article.investigation?.status);
}

export async function investigateArticle(article, fetchPage = fetch) {
  if (!canInvestigate(article.url)) return { ...article, investigation: { status: "skipped", reason: "unsafe-url" } };
  const fetchedAt = new Date().toISOString();
  const original = new URL(article.url);
  try {
    if (article.material?.kind === "release-notes" && article.material.url === article.url) {
      return withMaterial(article, markdownText(article.material.text), { method: "release-notes", sourceUrl: article.url, fetchedAt });
    }
    const repository = original.hostname === "github.com" && original.pathname.match(/^\/([\w.-]+)\/([\w.-]+)\/?$/);
    if (repository) {
      const url = `https://api.github.com/repos/${repository[1]}/${repository[2]}/readme`;
      const { response } = await requestMaterial(url, fetchPage, { Accept: "application/vnd.github.raw+json" });
      return withMaterial(article, markdownText(await boundedText(response)), { method: "github-readme", sourceUrl: url, fetchedAt });
    }
    const { response, url } = await requestMaterial(article.url, fetchPage);
    if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get("content-type") ?? "")) throw new Error("non-html-response");
    const content = extractReadableText(await boundedText(response), url);
    return withMaterial(article, content, { method: original.hostname === "arxiv.org" ? "arxiv-abstract" : "readability", sourceUrl: url, fetchedAt });
  } catch (error) {
    const reasons = new Set(["unsafe-redirect", "too-many-redirects", "source-http-error", "source-too-large", "insufficient-source-material", "non-html-response"]);
    const reason = reasons.has(error.message) ? error.message : "source-unavailable";
    if (reason !== "unsafe-redirect" && article.material?.kind === "feed-summary" && canInvestigate(article.material.url)) {
      try {
        return withMaterial(article, article.material.text, { status: "fallback", method: "feed-summary", sourceUrl: article.material.url, fetchedAt, reason });
      } catch { /* Short feed snippets are not enough to support an editorial claim. */ }
    }
    return { ...article, fetchedAt, investigation: { status: "unavailable", reason } };
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
