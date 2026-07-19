function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSources(story) {
  return story.sourceLinks
    .map((source) => isSafeUrl(source.url)
      ? `<a href="${escapeHtml(source.url)}">${escapeHtml(source.name)}</a>`
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

function displayCategory(category) {
  const normalized = String(category).toLowerCase();
  if (/tech|ai|software|security|science/.test(normalized)) return "Technology";
  if (/business|market|economy|company|finance/.test(normalized)) return "Business";
  return "Ideas";
}

function renderStory(story, { lead = false } = {}) {
  const kind = lead ? "lead-story" : "story";
  return `<article class="${kind}">
    <p class="kicker">${escapeHtml(displayCategory(story.category))}</p>
    <h2>${escapeHtml(story.headline)}</h2>
    <p class="summary">${escapeHtml(story.summary)}</p>
    <p class="why"><span>Why it matters</span>${escapeHtml(story.whyItMatters)}</p>
    <p class="sources">${renderSources(story)}</p>
  </article>`;
}

function groupStories(stories) {
  return stories.reduce((groups, story) => {
    const category = displayCategory(story.category);
    const group = groups.get(category) ?? [];
    group.push(story);
    groups.set(story.category, group);
    return groups;
  }, new Map());
}

function renderSections(stories) {
  return [...groupStories(stories).entries()]
    .map(([category, categoryStories]) => `<section class="news-section">
      <h2 class="section-title">${escapeHtml(category)}</h2>
      ${categoryStories.map((story) => renderStory(story)).join("\n")}
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

export function renderIssue(issue, { template = issue.template ?? "standard", navigation } = {}) {
  const selectedTemplate = resolveTemplate(template);
  const [lead, ...remainingStories] = issue.stories;
  const masthead = issue.editionTitle.toUpperCase();
  const leadMarkup = lead ? renderStory(lead, { lead: true }) : "<p class=\"empty-edition\">No stories made this edition.</p>";
  const sections = renderSections(remainingStories);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(issue.editionTitle)} — ${escapeHtml(issue.date)}</title>
  <style>
    :root { --ink: #181715; --paper: #f5f0e5; --rule: #24211c; --accent: #a1261f; }
    * { box-sizing: border-box; }
    body { background: #dcd4c5; color: var(--ink); font: 16px/1.42 Georgia, "Times New Roman", serif; margin: 0; }
    .newspaper { background: var(--paper); box-shadow: 0 1px 16px #5a4c393d; margin: 28px auto; max-width: 1240px; padding: 20px 28px 46px; }
    .edition-line { border-bottom: 1px solid var(--rule); display: flex; font: 700 .68rem/1.2 Arial, sans-serif; justify-content: space-between; letter-spacing: .08em; padding: 0 0 7px; text-transform: uppercase; }
    .masthead { border-bottom: 5px double var(--rule); padding: 8px 0 10px; text-align: center; }
    .masthead h1 { font: 900 clamp(2.6rem, 8vw, 6.7rem)/.82 Georgia, "Times New Roman", serif; letter-spacing: -.07em; margin: 0; text-transform: uppercase; }
    .deck { border-bottom: 1px solid var(--rule); font-size: clamp(1rem, 2vw, 1.35rem); font-style: italic; line-height: 1.25; margin: 0; padding: 9px 0 11px; text-align: center; }
    .front-page { border-bottom: 2px solid var(--rule); padding: 22px 0; }
    .lead-story { column-gap: 34px; display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(190px, .65fr); }
    .lead-story .kicker { grid-column: 1 / -1; }
    h2 { margin: 0; }
    .lead-story h2 { font-size: clamp(2.2rem, 5.2vw, 5rem); letter-spacing: -.045em; line-height: .92; }
    .lead-story .summary { border-left: 1px solid var(--rule); font-size: 1.14rem; line-height: 1.35; margin: 0; padding-left: 20px; }
    .kicker { color: var(--accent); font: 800 .67rem/1 Arial, sans-serif; letter-spacing: .14em; margin: 0 0 7px; text-transform: uppercase; }
    .why { align-self: end; font-size: .88rem; grid-column: 1 / -1; margin: 8px 0 0; }
    .why span { font: 800 .65rem/1 Arial, sans-serif; letter-spacing: .09em; margin-right: 8px; text-transform: uppercase; }
    .sources { font: .72rem/1.3 Arial, sans-serif; grid-column: 1 / -1; margin: 9px 0 0; }
    a { color: inherit; text-decoration-color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
    .newspaper-grid { column-gap: 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); padding-top: 22px; }
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
    @media (max-width: 720px) {
      .newspaper { margin: 0; padding: 14px 16px 30px; }
      .masthead h1 { letter-spacing: -.055em; }
      .lead-story, .newspaper-grid { display: block; }
      .lead-story .summary { border-left: 0; border-top: 1px solid var(--rule); margin-top: 13px; padding: 12px 0 0; }
      .news-section { border-bottom: 2px solid var(--rule); border-left: 0; padding: 20px 0; }
      .news-section:last-child { border-bottom: 0; }
      .template-classic .newspaper-grid { column-count: 1; }
      .page-turn { background: var(--paper); border: 1px solid var(--rule); bottom: 15px; flex-direction: row; padding: 6px 9px; position: fixed; top: auto; }
      .page-turn span { font-size: 2rem; }
      .page-turn small { display: none; }
      .page-turn-left { left: 12px; } .page-turn-right { right: 12px; }
    }
  </style>
</head>
<body>
  <main class="newspaper template-${selectedTemplate}">
    <div class="edition-line"><span>${escapeHtml(issue.date)}</span><span>Daily Edition</span><span>Independent Daily Edition</span></div>
    <header class="masthead"><h1>${escapeHtml(masthead)}</h1></header>
    <p class="deck"><strong>TODAY&#039;S EDITION</strong> — ${escapeHtml(issue.editorNote)}</p>
    <section class="front-page" aria-label="Lead story">${leadMarkup}</section>
    <div class="newspaper-grid">${sections}</div>
    ${renderEditionNavigation(navigation)}
    <footer class="footer">Generated from attributable sources · ${escapeHtml(issue.generatedAt ?? issue.date)}</footer>
  </main>
</body>
</html>`;
}
