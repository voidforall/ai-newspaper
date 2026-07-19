import { renderRecipeBuilder } from "./recipe-builder.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pageHead(title) {
  return `<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#eeeae0">
    <title>${escapeHtml(title === "AI Newspaper" ? title : `${title} · AI Newspaper`)}</title>
    <style>
      :root { --paper:#eeeae0; --ink:#20201c; --soft-ink:#626157; --rule:#bdb9ae; --red:#9f2c26; --night:#272721; --cream:#f5f1e8; }
      * { box-sizing:border-box; }
      body { background:var(--paper); color:var(--ink); font:16px/1.45 Georgia, 'Times New Roman', serif; margin:0; }
      a { color:inherit; }
      .page { margin:0 auto; max-width:1240px; padding:26px clamp(20px, 5vw, 64px) 72px; }
      .masthead { align-items:end; border-bottom:3px double var(--ink); display:flex; gap:24px; justify-content:space-between; padding-bottom:15px; }
      .masthead__title { font-size:clamp(2.6rem, 7vw, 6rem); letter-spacing:-.075em; line-height:.75; margin:0; }
      .masthead__note { color:var(--soft-ink); font-size:.78rem; font-style:italic; margin:0; max-width:18rem; text-align:right; }
      .kicker { color:var(--red); font:700 .69rem/1.2 Arial, sans-serif; letter-spacing:.13em; margin:0 0 8px; text-transform:uppercase; }
      .section-header { align-items:baseline; border-bottom:1px solid var(--ink); display:flex; justify-content:space-between; margin:52px 0 18px; padding-bottom:8px; }
      .section-header h2 { font-size:1.45rem; letter-spacing:-.03em; margin:0; }
      .section-header span { color:var(--soft-ink); font:700 .68rem/1 Arial,sans-serif; letter-spacing:.1em; text-transform:uppercase; }
      .shelf { display:grid; gap:18px; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); }
      .book { background:var(--night); color:var(--cream); display:flex; flex-direction:column; justify-content:space-between; min-height:260px; padding:22px; position:relative; text-decoration:none; transition:transform 150ms ease, box-shadow 150ms ease; }
      .book::before { background:var(--red); content:''; height:100%; left:0; position:absolute; top:0; width:5px; }
      .book:hover { box-shadow:8px 9px 0 rgba(32,32,28,.2); transform:translate(-3px,-3px); }
      .book:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible { outline:3px solid var(--red); outline-offset:3px; }
      .book__type { color:#c8c2b2; font:700 .68rem/1 Arial,sans-serif; letter-spacing:.11em; text-transform:uppercase; }
      .book strong { font-size:clamp(1.6rem, 3vw, 2.35rem); letter-spacing:-.055em; line-height:.94; }
      .book__meta { border-top:1px solid #747167; color:#d9d3c5; display:flex; font-size:.84rem; justify-content:space-between; padding-top:10px; }
      .empty { border:1px solid var(--rule); color:var(--soft-ink); margin:0; padding:22px; }
      .return { color:var(--red); font:700 .75rem/1 Arial,sans-serif; letter-spacing:.09em; text-decoration:none; text-transform:uppercase; }
      .timeline-title { font-size:clamp(3.2rem, 9vw, 7rem); letter-spacing:-.08em; line-height:.8; margin:26px 0 38px; }
      .timeline { list-style:none; margin:0; padding:0; }
      .timeline li { border-top:1px solid var(--rule); }
      .timeline a { display:grid; gap:12px; grid-template-columns:130px minmax(0, 1fr) minmax(180px, .9fr); padding:19px 0; text-decoration:none; }
      .timeline a:hover strong { color:var(--red); }
      .timeline time { color:var(--soft-ink); font:700 .75rem/1.25 Arial,sans-serif; letter-spacing:.08em; padding-top:4px; }
      .timeline strong { font-size:1.35rem; letter-spacing:-.03em; line-height:1.05; transition:color 150ms ease; }
      .timeline span { color:var(--soft-ink); font-size:.9rem; }
      @media (max-width:650px) { .masthead { align-items:start; flex-direction:column; gap:14px; } .masthead__note { text-align:left; } .book__meta { flex-direction:column; gap:5px; } .timeline a { grid-template-columns:1fr; gap:6px; } .timeline-title { margin-bottom:28px; } }
    </style>
  </head>`;
}

export function sourceFor(issue) {
  if (issue.recipe?.id && issue.recipe?.name) return { name: issue.recipe.name, slug: issue.recipe.id };
  const source = issue.stories.flatMap((story) => story.sourceLinks ?? []).find((link) => link.name !== "Original source");
  const name = source?.name ?? "Independent edition";
  return { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "edition" };
}

function newestFirst(issues) {
  return [...issues].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
}

export function renderCollection(issues) {
  const groups = new Map();
  for (const issue of issues) {
    const source = sourceFor(issue);
    const group = groups.get(source.slug) ?? { ...source, issues: [] };
    group.issues.push(issue);
    groups.set(source.slug, group);
  }

  const cards = [...groups.values()].map((group) => {
    const latest = newestFirst(group.issues)[0];
    return `<a class="book" href="sources/${group.slug}/">
      <span class="book__type">Source desk</span>
      <strong>${escapeHtml(group.name)}</strong>
      <span class="book__meta"><span>${group.issues.length} editions</span><span>Latest: ${escapeHtml(latest.date)}</span></span>
    </a>`;
  }).join("\n") || '<p class="empty">No sources have published an edition yet.</p>';

  return `<!doctype html><html lang="en">${pageHead("AI Newspaper")}<body>
    <main class="page">
      <header class="masthead"><div><p class="kicker">Independent machine intelligence desk</p><h1 class="masthead__title">AI Newspaper</h1></div><p class="masthead__note">A small, readable record of the sources you choose to follow.</p></header>
      <section aria-labelledby="source-shelf"><div class="section-header"><h2 id="source-shelf">Published desks</h2><span>${groups.size} source${groups.size === 1 ? "" : "s"}</span></div>${cards}</section>
      ${renderRecipeBuilder()}
    </main>
  </body></html>`;
}

export function renderSourceTimeline(source, issues) {
  const editions = newestFirst(issues).map((issue) => `<li><a href="../../editions/${encodeURIComponent(issue.id)}/"><time>${escapeHtml(issue.date)}</time><strong>${escapeHtml(issue.editionTitle)}</strong><span>${escapeHtml(issue.editorNote)}</span></a></li>`).join("\n") || '<li class="empty">No editions published yet.</li>';
  return `<!doctype html><html lang="en">${pageHead(source.name)}<body><main class="page"><a class="return" href="../../">← All source desks</a><h1 class="timeline-title">${escapeHtml(source.name)}</h1><ol class="timeline">${editions}</ol></main></body></html>`;
}
