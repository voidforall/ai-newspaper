import config from "../site-config.json" with { type: "json" };

export function escapeXml(value) {
  return String(value).toWellFormed().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
}

export function siteConfig(environment = process.env) {
  const url = new URL(environment.SITE_URL || config.url);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("SITE_URL must be an absolute HTTP(S) deployment URL without credentials, query or fragment.");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return { ...config, url: url.href };
}

export function publishedMainIssues(issues) {
  return issues.filter((issue) => issue.recipe?.id === "ai-builder" && issue.status === "published" && issue.editorial?.status === "complete" && ["ai", "manual"].includes(issue.editorial?.method))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function shareMetadata(issue, site, { path, story, demo = false } = {}) {
  const url = new URL(path, site.url).href;
  const legacy = issue.schemaVersion === undefined;
  const title = `${demo ? "示例刊 · " : ""}${story?.headline ?? issue.editionTitle} — ${issue.date}`;
  const description = demo ? `示例刊，非当日新闻或正式主刊。${story?.summary ?? issue.editorNote}`
    : legacy ? `历史归档（编辑审阅未记录）：${story?.headline ?? issue.editionTitle}，${issue.date}。打开查看原始期刊与来源。`
      : story?.summary ?? issue.editorNote;
  return { title, description, url, image: new URL("cover.png", url).href, imageAlt: `${site.title} · ${issue.date} · ${story?.headline ?? issue.editionTitle}`, siteName: site.title, feedUrl: new URL("feed.xml", site.url).href, publishedAt: issue.publishedAt, language: issue.language ?? "en", demo };
}

export function renderMetadata(metadata) {
  if (!metadata) return "";
  const attr = escapeXml;
  return `<link rel="canonical" href="${attr(metadata.url)}">
    <link rel="alternate" type="application/rss+xml" title="${attr(metadata.siteName)}" href="${attr(metadata.feedUrl)}">
    <meta name="description" content="${attr(metadata.description)}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="${attr(metadata.siteName)}">
    <meta property="og:locale" content="${metadata.language === "zh-CN" ? "zh_CN" : "en_US"}">
    <meta property="og:title" content="${attr(metadata.title)}">
    <meta property="og:description" content="${attr(metadata.description)}">
    <meta property="og:url" content="${attr(metadata.url)}">
    <meta property="og:image" content="${attr(metadata.image)}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${attr(metadata.imageAlt)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${attr(metadata.title)}">
    <meta name="twitter:description" content="${attr(metadata.description)}">
    <meta name="twitter:image" content="${attr(metadata.image)}">
    <meta name="twitter:image:alt" content="${attr(metadata.imageAlt)}">
    ${metadata.publishedAt ? `<meta property="article:published_time" content="${attr(metadata.publishedAt)}">` : ""}`;
}

export function renderFeed(issues, site) {
  const entries = publishedMainIssues(issues).slice(0, 50);
  const items = entries.map((issue) => {
    if (!Number.isFinite(Date.parse(issue.publishedAt))) throw new Error(`Published main edition ${issue.id} is missing its actual publication time.`);
    const url = new URL(`editions/${issue.id}/`, site.url).href;
    return `<item><title>${escapeXml(issue.editionTitle)}</title><link>${escapeXml(url)}</link><guid isPermaLink="true">${escapeXml(url)}</guid><pubDate>${new Date(issue.publishedAt).toUTCString()}</pubDate><description>${escapeXml(issue.editorNote)}</description></item>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${escapeXml(site.title)}</title><link>${escapeXml(site.url)}</link><description>${escapeXml(site.description)}</description><language>zh-cn</language>
<atom:link href="${escapeXml(new URL("feed.xml", site.url).href)}" rel="self" type="application/rss+xml"/>
${items}</channel></rss>\n`;
}
