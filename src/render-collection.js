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
      :root { --paper:#cbd5d6; --ink:#14282d; --soft-ink:#4d6267; --rule:#789095; --accent:#e8602d; --night:#193b46; --cream:#e9efed; --signal:#f5d94e; }
      * { box-sizing:border-box; }
      body { background:var(--paper); color:var(--ink); font:16px/1.45 Georgia, 'Times New Roman', serif; margin:0; }
      a { color:inherit; }
      .page { margin:0 auto; max-width:1240px; padding:26px clamp(20px, 5vw, 64px) 72px; }
      .masthead { align-items:stretch; border-bottom:1px solid var(--ink); display:grid; gap:0; grid-template-columns:minmax(0, 1fr) 275px; }
      .masthead__title { align-items:end; background:var(--night); color:var(--cream); display:flex; font-family:'Arial Narrow', 'Helvetica Neue', Arial, sans-serif; font-size:clamp(3.1rem, 8vw, 7.3rem); font-stretch:condensed; font-weight:900; letter-spacing:-.09em; line-height:.74; margin:0; padding:24px 25px 18px; text-transform:uppercase; }
      .masthead__note { align-self:stretch; border-left:1px solid var(--ink); color:var(--ink); font-size:1rem; margin:0; padding:24px 22px; }
      .masthead__note .kicker { display:block; }
      .kicker { color:var(--accent); font:700 .69rem/1.2 'Courier New', monospace; letter-spacing:.11em; margin:0 0 8px; text-transform:uppercase; }
      .section-header { align-items:baseline; border-bottom:1px solid var(--ink); display:flex; justify-content:space-between; margin:46px 0 13px; padding-bottom:8px; }
      .section-header h2 { font-family:'Arial Narrow', Arial, sans-serif; font-size:1.15rem; font-stretch:condensed; letter-spacing:.02em; margin:0; text-transform:uppercase; }
      .section-header span { background:var(--signal); font:700 .66rem/1 'Courier New', monospace; letter-spacing:.07em; padding:5px 7px; text-transform:uppercase; }
      .shelf { display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); }
      .book { background:var(--cream); border:1px solid var(--ink); color:var(--ink); display:flex; flex-direction:column; justify-content:space-between; min-height:230px; padding:18px; position:relative; text-decoration:none; transition:background 130ms ease, transform 130ms ease; }
      .book::before { background:var(--accent); clip-path:polygon(0 0,100% 0,76% 100%,0 100%); color:var(--ink); content:'FILE'; font:700 .59rem/1 'Courier New', monospace; letter-spacing:.12em; padding:7px 25px 7px 8px; position:absolute; right:-1px; top:-1px; }
      .book:hover { background:#f8f8f1; transform:translateY(-3px); }
      .book:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible { outline:3px solid var(--accent); outline-offset:3px; }
      .book__type { color:var(--soft-ink); font:700 .66rem/1 'Courier New', monospace; letter-spacing:.09em; text-transform:uppercase; }
      .book strong { font-family:'Arial Narrow', Arial, sans-serif; font-size:clamp(1.9rem, 3vw, 2.8rem); font-stretch:condensed; letter-spacing:-.06em; line-height:.84; max-width:80%; text-transform:uppercase; }
      .book__meta { border-top:1px solid var(--rule); color:var(--soft-ink); display:flex; font:700 .66rem/1.35 'Courier New', monospace; justify-content:space-between; padding-top:9px; text-transform:uppercase; }
      .empty { border:1px dashed var(--rule); color:var(--soft-ink); margin:0; padding:22px; }
      .return { color:var(--accent); font:700 .75rem/1 'Courier New', monospace; letter-spacing:.07em; text-decoration:none; text-transform:uppercase; }
      .timeline-title { font-family:'Arial Narrow', Arial, sans-serif; font-size:clamp(3.2rem, 9vw, 7rem); font-stretch:condensed; letter-spacing:-.08em; line-height:.8; margin:28px 0 38px; text-transform:uppercase; }
      .timeline { list-style:none; margin:0; padding:0; }
      .timeline li { border-top:1px solid var(--rule); }
      .timeline a { display:grid; gap:12px; grid-template-columns:130px minmax(0, 1fr) minmax(180px, .9fr); padding:19px 0; text-decoration:none; }
      .timeline a:hover strong { color:var(--accent); }
      .timeline time { color:var(--soft-ink); font:700 .68rem/1.25 'Courier New', monospace; letter-spacing:.04em; padding-top:4px; }
      .timeline strong { font-family:'Arial Narrow', Arial, sans-serif; font-size:1.55rem; font-stretch:condensed; letter-spacing:-.035em; line-height:.95; text-transform:uppercase; transition:color 150ms ease; }
      .timeline span { color:var(--soft-ink); font-size:.9rem; }
      @media (max-width:650px) { .masthead { grid-template-columns:1fr; } .masthead__title { min-height:150px; } .masthead__note { border-left:0; border-top:1px solid var(--ink); } .book__meta { flex-direction:column; gap:5px; } .timeline a { grid-template-columns:1fr; gap:6px; } .timeline-title { margin-bottom:28px; } }
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
      <header class="masthead"><h1 class="masthead__title">AI Newspaper</h1><p class="masthead__note"><span class="kicker">Issue index</span>A source-led archive for people who prefer to decide what enters their reading desk.</p></header>
      <section aria-labelledby="source-shelf"><div class="section-header"><h2 id="source-shelf">Filed editions</h2><span>${groups.size} source${groups.size === 1 ? "" : "s"}</span></div>${cards}</section>
      ${renderRecipeBuilder()}
    </main>
  </body></html>`;
}

export function renderSourceTimeline(source, issues) {
  const editions = newestFirst(issues).map((issue) => `<li><a href="../../editions/${encodeURIComponent(issue.id)}/"><time>${escapeHtml(issue.date)}</time><strong>${escapeHtml(issue.editionTitle)}</strong><span>${escapeHtml(issue.editorNote)}</span></a></li>`).join("\n") || '<li class="empty">No editions published yet.</li>';
  return `<!doctype html><html lang="en">${pageHead(source.name)}<body><main class="page"><a class="return" href="../../">← All source desks</a><h1 class="timeline-title">${escapeHtml(source.name)}</h1><ol class="timeline">${editions}</ol></main></body></html>`;
}
