import { createHash } from "node:crypto";
import { canonicalArticleUrl } from "./editorial-policy.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSources(story, language) {
  return story.sourceLinks
    .map((source) => isSafeUrl(source.url)
      ? `<a href="${escapeHtml(source.url)}">${escapeHtml(language === "zh-CN" && source.name === "Original source" ? "原文" : source.name)}</a>`
      : `<span>${escapeHtml(source.name)}</span>`)
    .join(" · ");
}

function isSafeUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function displayCategory(category, language = "en") {
  const normalized = String(category).toLowerCase();
  const name = /tech|ai|software|security|science/.test(normalized) ? "Technology" : /business|market|economy|company|finance/.test(normalized) ? "Business" : "Ideas";
  return language === "zh-CN" ? { Technology: "技术与产品", Business: "产业动态", Ideas: "观点与实践" }[name] : name;
}

function renderEvidence(story, language) {
  if (!story.evidence?.length || !story.attribution) return "";
  const zh = language === "zh-CN";
  const kinds = zh ? { "source-statement": "来源陈述", "vendor-claim": "厂商／作者主张", "community-report": "社区体验", "editorial-judgment": "编辑判断", unknown: "未知" }
    : { "source-statement": "Source statement", "vendor-claim": "Vendor / author claim", "community-report": "Community report", "editorial-judgment": "Editorial judgment", unknown: "Unknown" };
  const labels = zh ? { headline: "标题", summary: "摘要", whyItMatters: "开发者影响", caveat: "限制与未知" }
    : { headline: "Headline", summary: "Summary", whyItMatters: "Impact", caveat: "Limits" };
  const byId = new Map(story.evidence.map((item) => [item.id, item]));
  const blocks = Object.entries(labels).filter(([field]) => story[field] && story.attribution[field]).map(([field, label]) => {
    const attribution = story.attribution[field];
    const excerpts = attribution.evidenceIds.map((id) => byId.get(id)).filter(Boolean).map((item) => `<figure><blockquote>${escapeHtml(item.quote)}</blockquote><figcaption>${isSafeUrl(item.url) ? `<a href="${escapeHtml(item.url)}">${zh ? "查看来源" : "View source"}</a>` : ""} · ${escapeHtml(item.method ?? "")} · ${zh ? "抓取于" : "Retrieved"} <time datetime="${escapeHtml(item.fetchedAt)}">${escapeHtml(item.fetchedAt)}</time> · ${zh ? "提取文本位置" : "Extracted text offsets"} ${item.location.start}–${item.location.end}</figcaption></figure>`).join("");
    return `<section class="evidence-block"><h3>${label} <span>${escapeHtml(kinds[attribution.kind] ?? attribution.kind)}</span></h3><p>${escapeHtml(story[field])}</p>${excerpts || `<p class="material-note">${attribution.kind === "unknown" ? zh ? "提供的材料未说明此项。" : "Not established by the supplied material." : zh ? "这是编辑对材料的解读。" : "This is an editorial interpretation of the material."}</p>`}</section>`;
  }).join("");
  return `<details class="evidence"><summary>${zh ? "查看原文依据与编辑判断" : "Inspect source evidence and editorial judgment"}</summary><p class="material-note">${zh ? "摘录和引用关系经过程序检查；不代表独立事实核验。位置对应抓取时的提取文本，原页面可能变化。" : "Excerpt and reference integrity checked; this is not independent fact-checking. Offsets refer to extracted text at retrieval; the source page may change."}</p>${blocks}</details>`;
}

export function storyIdFor(story) {
  const original = canonicalArticleUrl(story.sourceLinks?.find((link) => link.name === "Original source")?.url);
  const source = story.sourceLinks?.map((link) => canonicalArticleUrl(link.url)).find(Boolean);
  // Legacy feed-only stories have no article ID. Their immutable summary distinguishes
  // separate articles from the same feed without depending on a display headline/order.
  const identity = story.articleIds?.[0] ?? original ?? (source ? `${source}\n${story.summary ?? ""}` : undefined);
  if (!identity) return undefined;
  return `story-${createHash("sha256").update(String(identity)).digest("hex").slice(0, 20)}`;
}

function displayUpdate(value, zh) {
  if (!Number.isFinite(Date.parse(value))) return value;
  return `${new Intl.DateTimeFormat(zh ? "zh-CN" : "en-GB", { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value))} UTC`;
}

function renderReadingContext(context, issue) {
  if (!context) return "";
  const zh = issue.language === "zh-CN";
  const nav = `<nav class="reader-nav" aria-label="${zh ? "阅读导航" : "Reader navigation"}"><a href="${escapeHtml(context.homeHref)}">AI Builder 日报</a><div><a href="${escapeHtml(context.archiveHref)}">${zh ? "历史期刊" : "Archive"}</a><a href="${escapeHtml(context.builderHref)}">${zh ? "自建报纸" : "Build your edition"}</a></div></nav>`;
  const note = context.demo ? `${context.home ? "主刊尚未正式发布。" : ""}示例刊 · 根据真实发布说明人工编写，供体验阅读与原文依据；不是当日新闻或正式主刊。`
    : context.home ? `${issue.date === context.today ? "最新主刊" : "今日主刊尚未发布，以下为最近一期"} · ${issue.date}` : "";
  return `${nav}<p class="reader-position">${zh ? "给 AI 应用开发者的五分钟日报 · 技术变化、实际影响与原文依据" : "A five-minute newspaper for AI application builders"}</p>${note ? `<p class="reader-status">${escapeHtml(note)}</p>` : ""}<p class="reader-updated">${zh ? "本期日期" : "Edition"} <time datetime="${escapeHtml(issue.date)}">${escapeHtml(issue.date)}</time>${issue.generatedAt ? ` · ${zh ? "生成于" : "Generated"} <time datetime="${escapeHtml(issue.generatedAt)}">${escapeHtml(displayUpdate(issue.generatedAt, zh))}</time>` : ""}${context.editionHref ? ` · <a href="${escapeHtml(context.editionHref)}">${zh ? "本期固定链接" : "Edition permalink"}</a>` : ""}</p>`;
}

function renderStory(story, { lead = false, language = "en", storyLink } = {}) {
  const kind = lead ? "lead-story" : "story";
  const zh = language === "zh-CN";
  const kicker = zh ? { paper: "研究", release: "版本更新", news: "动态" }[story.kind] ?? displayCategory(story.category, language) : displayCategory(story.category);
  return `<article class="${kind}"${storyIdFor(story) ? ` id="${storyIdFor(story)}"` : ""}>
    <p class="kicker">${escapeHtml(kicker)}</p>
    <h2>${escapeHtml(story.headline)}</h2>
    ${storyLink ? `<a class="story-permalink" href="${escapeHtml(storyLink(story))}">${zh ? "单独阅读 ↗" : "Story permalink ↗"}</a>` : ""}
    <p class="summary">${escapeHtml(story.summary)}</p>
    <p class="why"><span>${zh ? "开发者影响" : "Why it matters"}</span>${escapeHtml(story.whyItMatters)}</p>
    ${story.caveat ? `<p class="why"><span>${zh ? "限制与未知" : "Limits and unknowns"}</span>${escapeHtml(story.caveat)}</p>` : ""}
    <p class="sources">${renderSources(story, language)}</p>
    ${renderEvidence(story, language)}
    ${story.sourceMaterial?.status === "fallback" ? `<p class="material-note">${zh ? "本条根据来源订阅摘要编写；未能获取原文。" : "Based on a feed summary · Original article unavailable."}</p>` : ""}
  </article>`;
}

function groupStories(stories, language) {
  return stories.reduce((groups, story) => {
    const category = displayCategory(story.category, language);
    const group = groups.get(category) ?? [];
    group.push(story);
    groups.set(category, group);
    return groups;
  }, new Map());
}

function renderSections(stories, language, storyLink) {
  return [...groupStories(stories, language).entries()]
    .map(([category, categoryStories]) => `<section class="news-section">
      <h2 class="section-title">${escapeHtml(category)}</h2>
      ${categoryStories.map((story) => renderStory(story, { language, storyLink })).join("\n")}
    </section>`)
    .join("\n");
}

function resolveTemplate(template) {
  if (["standard", "classic"].includes(template)) return template;
  throw new Error(`Unknown render template: ${template}`);
}

function renderEditionNavigation(navigation) {
  if (!navigation) return "";
  const previous = navigation.newer
    ? `<a class="page-turn page-turn-left" href="${escapeHtml(navigation.newer.href)}" aria-label="Newer edition, ${escapeHtml(navigation.newer.date)}"><span>‹</span><small>Newer edition</small></a>`
    : "";
  const next = navigation.older
    ? `<a class="page-turn page-turn-right" href="${escapeHtml(navigation.older.href)}" aria-label="Older edition, ${escapeHtml(navigation.older.date)}"><span>›</span><small>Older edition</small></a>`
    : "";
  const timeline = navigation.timeline.map((edition) => edition.current
    ? `<span aria-current="page">${escapeHtml(edition.date)}</span>`
    : `<a href="${escapeHtml(edition.href)}">${escapeHtml(edition.date)}</a>`).join("");
  return `${previous}${next}<nav class="edition-navigation" aria-label="Edition navigation">
    <a class="source-link" href="${escapeHtml(navigation.source.href)}">← Back to ${escapeHtml(navigation.source.name)}</a>
    <div class="edition-timeline"><span class="timeline-label">Edition timeline</span><div class="timeline">${timeline}</div></div>
  </nav>`;
}

export function renderIssue(issue, { template = issue.template ?? "standard", navigation, readingContext, storyLink } = {}) {
  const selectedTemplate = resolveTemplate(template);
  const language = issue.language ?? "en";
  const zh = language === "zh-CN";
  const [lead, ...remainingStories] = issue.stories;
  const masthead = (readingContext?.story ? zh ? "AI Builder 日报" : "AI Newspaper" : issue.editionTitle).toUpperCase();
  const leadMarkup = lead ? renderStory(lead, { lead: true, language, storyLink }) : `<p class="empty-edition">${zh ? "本期暂无符合标准的新闻。" : "No stories made this edition."}</p>`;
  const sections = renderSections(remainingStories, language, storyLink);
  const publicationNote = readingContext?.demo ? "示例刊 · 人工审阅" : issue.schemaVersion === undefined
    ? "Archived edition · Editorial review was not tracked for this issue."
    : issue.status === "draft" ? zh ? "草稿 · 尚未发布" : "Draft · Not published."
      : issue.editorial?.method === "manual" ? zh ? "编辑审阅版" : "Editor-reviewed edition." : zh ? "AI 编辑版" : "AI-edited edition.";

  return `<!doctype html>
<html lang="${escapeHtml(language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(issue.editionTitle)} — ${escapeHtml(issue.date)}</title>
  <style>
    :root { --ink: #181715; --paper: #f5f0e5; --rule: #24211c; --accent: #a1261f; }
    * { box-sizing: border-box; }
    .newspaper, article, .news-section, .lead-story > * { min-width: 0; overflow-wrap: anywhere; }
    a:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
    .reader-nav { align-items: center; display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; border-bottom: 3px double var(--rule); padding-bottom: 16px; margin-bottom: 18px; font: 700 .85rem/1.4 Arial, sans-serif; }
    .reader-nav > a { font-size: 1.05rem; text-decoration: none; }
    .reader-nav div { display: flex; gap: 20px; }
    .reader-nav a { display: inline-flex; align-items: center; min-height: 36px; }
    .reader-position { font-size: .95rem; margin: 12px 0; }
    .reader-status { border-left: 3px solid var(--accent); padding: 8px 12px; font: .85rem/1.7 Arial, sans-serif; }
    .reader-updated { color: #655e53; font: .72rem/1.6 Arial, sans-serif; overflow-wrap: anywhere; }
    .story-permalink { grid-column: 1 / -1; font: .75rem/1.5 Arial, sans-serif; margin: 10px 0 0; display: inline-block; width: fit-content; min-height: 32px; }
    .lead-story .story-permalink { grid-row: 3; }

    body { background: #dcd4c5; color: var(--ink); font: 16px/1.42 Georgia, "Times New Roman", serif; margin: 0; }
    .newspaper { background: var(--paper); box-shadow: 0 1px 16px #5a4c393d; margin: 28px auto; max-width: 1240px; padding: 20px 28px 46px; }
    .edition-line { border-bottom: 1px solid var(--rule); display: flex; font: 700 .68rem/1.2 Arial, sans-serif; justify-content: space-between; letter-spacing: .08em; padding: 0 0 7px; text-transform: uppercase; }
    .masthead { border-bottom: 5px double var(--rule); padding: 8px 0 10px; text-align: center; }
    .masthead h1 { font: 900 clamp(2.6rem, 8vw, 6.7rem)/.82 Georgia, "Times New Roman", serif; letter-spacing: -.07em; margin: 0; text-transform: uppercase; }
    .deck { border-bottom: 1px solid var(--rule); font-size: clamp(1rem, 2vw, 1.35rem); font-style: italic; line-height: 1.25; margin: 0; padding: 9px 0 11px; text-align: center; }
    .publication-note { color: #655e53; font: .75rem/1.5 Arial, sans-serif; margin: 10px 0 0; text-align: center; }
    html[lang="zh-CN"] body { line-height: 1.7; }
    html[lang="zh-CN"] .summary { line-height: 1.65; }
    html[lang="zh-CN"] .masthead h1 { line-height: 1.08; letter-spacing: -.035em; text-wrap: balance; }
    html[lang="zh-CN"] .lead-story h2, html[lang="zh-CN"] .story h2 { line-height: 1.2; }
    .evidence { grid-column: 1 / -1; min-width: 0; margin-top: 14px; border-top: 1px solid #918879; font: .88rem/1.6 Arial, sans-serif; overflow-wrap: anywhere; }
    .evidence summary { cursor: pointer; padding: 12px 0; min-height: 44px; font-weight: 700; }
    .evidence summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
    .evidence-block { border-top: 1px solid #c7beaf; padding: 12px 0; }
    .evidence h3 { font-size: .85rem; }
    .evidence h3 span { color: #7d2720; font-size: .75rem; margin-left: 8px; }
    .evidence figure { margin: 12px 0 0; }
    .evidence blockquote { border-left: 2px solid var(--accent); margin: 0; padding: 4px 12px; white-space: pre-wrap; }
    .evidence figcaption { color: #655e53; font-size: .7rem; margin: 6px 0 0; }
    .material-note { color: #655e53; font: .75rem/1.5 Arial, sans-serif; margin: 8px 0; }
    .front-page { border-bottom: 2px solid var(--rule); padding: 22px 0; }
    .lead-story { column-gap: 34px; display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(190px, .65fr); }
    .lead-story .kicker { grid-column: 1 / -1; }
    h2 { margin: 0; }
    .lead-story h2 { font-size: clamp(2.2rem, 5.2vw, 5rem); letter-spacing: -.045em; line-height: .92; }
    .lead-story h2 { grid-column: 1; grid-row: 2; }
    .lead-story .summary { grid-column: 2; grid-row: 2; border-left: 1px solid var(--rule); font-size: 1.14rem; line-height: 1.35; margin: 0; padding-left: 20px; }
    .kicker { color: var(--accent); font: 800 .67rem/1 Arial, sans-serif; letter-spacing: .14em; margin: 0 0 7px; text-transform: uppercase; }
    .why { align-self: end; font-size: .88rem; grid-column: 1 / -1; margin: 8px 0 0; }
    .why span { font: 800 .65rem/1 Arial, sans-serif; letter-spacing: .09em; margin-right: 8px; text-transform: uppercase; }
    .sources { font: .72rem/1.3 Arial, sans-serif; grid-column: 1 / -1; margin: 9px 0 0; }
    a { color: inherit; text-decoration-color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
    .newspaper-grid { column-gap: 24px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding-top: 22px; }
    .news-section { border-left: 1px solid var(--rule); padding-left: 20px; }
    .news-section:first-child { border-left: 0; padding-left: 0; }
    .section-title { border-bottom: 3px solid var(--rule); font: 800 1rem/1 Arial, sans-serif; letter-spacing: .08em; margin: 0; padding: 0 0 6px; text-transform: uppercase; }
    .story { border-bottom: 1px solid #918879; padding: 16px 0; }
    .story:last-child { border-bottom: 0; }
    .story h2 { font-size: 1.45rem; letter-spacing: -.025em; line-height: 1; }
    .story .summary { margin: 7px 0 0; }
    .story .why, .story .sources { margin-bottom: 0; }
    .footer { border-top: 3px double var(--rule); font: .68rem/1.25 Arial, sans-serif; letter-spacing: .04em; margin-top: 26px; padding-top: 9px; text-align: center; text-transform: uppercase; }
    .empty-edition { font-style: italic; }
    .edition-navigation { border-top: 1px solid var(--rule); font: .78rem/1.35 Arial, sans-serif; margin: 28px 0 0; padding: 14px 0 0; }
    .source-link { display: inline-block; font-weight: 700; margin-bottom: 13px; }
    .edition-timeline { display: grid; gap: 8px; }
    .timeline-label { font: 800 .67rem/1 Arial, sans-serif; letter-spacing: .1em; text-transform: uppercase; }
    .timeline { display: flex; flex-wrap: wrap; gap: 7px; }
    .timeline a, .timeline span { border: 1px solid var(--rule); padding: 5px 7px; text-decoration: none; }
    .timeline span { background: var(--ink); color: var(--paper); }
    .page-turn { align-items: center; color: #2020205c; display: flex; flex-direction: column; font-family: Arial, sans-serif; gap: 5px; position: fixed; text-decoration: none; top: 45%; transition: color .15s ease, transform .15s ease; z-index: 2; }
    .page-turn:hover { color: #202020; transform: scale(1.08); }
    .page-turn span { font: 7rem/.65 Georgia, serif; }
    .page-turn small { font-size: .58rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .page-turn-left { left: max(18px, calc(50% - 720px)); }
    .page-turn-right { right: max(18px, calc(50% - 720px)); }
    .template-classic { --ink: #171717; --paper: #e3e1dc; --rule: #292929; --accent: #171717; background-color: var(--paper); background-image: repeating-linear-gradient(0deg, #ffffff20 0, #ffffff20 1px, #1a1a1a0a 1px, #1a1a1a0a 3px), repeating-linear-gradient(90deg, transparent 0, transparent 8px, #1a1a1a08 9px); box-shadow: 0 1px 18px #1111114a; max-width: 1180px; padding: 18px 24px 36px; }
    .template-classic .edition-line { font-family: "Courier New", monospace; }
    .template-classic .masthead { border-bottom-width: 6px; padding: 6px 0 8px; }
    .template-classic .masthead h1 { font-family: "Bodoni 72", Didot, Georgia, serif; font-size: clamp(3.2rem, 9vw, 7.8rem); letter-spacing: -.09em; }
    .template-classic .deck { font-size: clamp(.95rem, 1.7vw, 1.18rem); }
    .template-classic .lead-story h2 { font-family: "Bodoni 72", Didot, Georgia, serif; font-size: clamp(2.5rem, 5vw, 4.7rem); }
    .template-classic .lead-story .summary { border-left: 1px solid var(--rule); border-top: 0; font-size: 1.05rem; margin: 0; padding: 0 0 0 20px; }
    .template-classic .newspaper-grid { column-count: 3; column-gap: 24px; display: block; }
    .template-classic .news-section { border-left: 0; margin: 0 0 22px; padding-left: 0; }
    .template-classic .story { break-inside: avoid; }
    .template-classic .story h2 { font-family: "Bodoni 72", Didot, Georgia, serif; font-size: 1.55rem; }
    .template-classic .kicker { color: var(--ink); font-family: "Courier New", monospace; }
    @media (max-width: 1440px) { .page-turn { display: none; } }
    @media (max-width: 900px) and (min-width: 721px) {
      .newspaper-grid { grid-template-columns: 1fr; }
      .news-section { border-bottom: 2px solid var(--rule); border-left: 0; padding: 20px 0; }
      .news-section:last-child { border-bottom: 0; }
    }
    @media (max-width: 720px) {
      .newspaper { margin: 0; padding: 14px 16px 30px; }
      .masthead h1 { letter-spacing: -.055em; }
      .lead-story, .newspaper-grid { display: block; }
      .lead-story .summary { border-left: 0; border-top: 1px solid var(--rule); margin-top: 13px; padding: 12px 0 0; }
      .news-section { border-bottom: 2px solid var(--rule); border-left: 0; padding: 20px 0; }
      .news-section:last-child { border-bottom: 0; }
      .template-classic .newspaper-grid { column-count: 1; }
      .page-turn { display: none; background: var(--paper); border: 1px solid var(--rule); bottom: 15px; flex-direction: row; padding: 6px 9px; position: fixed; top: auto; }
      .page-turn span { font-size: 2rem; }
      .page-turn small { display: none; }
      .page-turn-left { left: 12px; } .page-turn-right { right: 12px; }
    }
  </style>
</head>
<body>
  <main class="newspaper template-${selectedTemplate}">
    ${renderReadingContext(readingContext, issue)}
    <div class="edition-line"><span>${escapeHtml(issue.date)}</span><span>${zh ? "每日刊" : "Daily Edition"}</span><span>${zh ? "独立日报" : "Independent Daily Edition"}</span></div>
    <header class="masthead"><h1>${escapeHtml(masthead)}</h1></header>
    ${readingContext?.story ? "" : `<p class="deck"><strong>${zh ? "本期导读" : "TODAY&#039;S EDITION"}</strong> — ${escapeHtml(issue.editorNote)}</p>`}
    <p class="publication-note">${escapeHtml(publicationNote)}</p>
    <section class="front-page" aria-label="${zh ? "头条" : "Lead story"}">${leadMarkup}</section>
    <div class="newspaper-grid">${sections}</div>
    ${renderEditionNavigation(navigation)}
    <footer class="footer">${zh ? "依据可追溯来源编写" : "Generated from attributable sources"} · ${escapeHtml(displayUpdate(issue.generatedAt ?? issue.date, zh))}</footer>
  </main>
</body>
</html>`;
}
