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
    <meta name="theme-color" content="#dfc986">
    <title>${escapeHtml(title === "AI Newspaper" ? title : `${title} · AI Newspaper`)}</title>
    <style>
      :root { --paper:#dfc986; --ink:#28251f; --soft-ink:#67593e; --rule:#907a4c; --accent:#2e4765; --night:#2c2b27; --cream:#f6e9bd; --signal:#cda63a; }
      * { box-sizing:border-box; }
      body { background:var(--paper); color:var(--ink); font:16px/1.45 Georgia, 'Times New Roman', serif; margin:0; }
      a { color:inherit; }
      .page { margin:0 auto; max-width:1240px; padding:26px clamp(20px, 5vw, 64px) 72px; }
      .masthead { align-items:end; border-bottom:4px double var(--ink); display:grid; gap:22px; grid-template-columns:minmax(0, 1fr) 275px; padding:8px 0 17px; }
      .masthead__title { color:var(--ink); font-family:'Palatino Linotype', 'Book Antiqua', Georgia, serif; font-size:clamp(3.3rem, 8vw, 7.1rem); font-weight:700; letter-spacing:-.075em; line-height:.78; margin:0; }
      .masthead__note { border-left:1px solid var(--rule); color:var(--soft-ink); font-size:1rem; font-style:italic; margin:0; padding:4px 0 4px 20px; }
      .masthead__note .kicker { display:block; }
      .kicker { color:var(--accent); font:700 .68rem/1.2 Arial, sans-serif; letter-spacing:.12em; margin:0 0 8px; text-transform:uppercase; }
      .section-header { align-items:baseline; border-bottom:1px solid var(--ink); display:flex; justify-content:space-between; margin:46px 0 13px; padding-bottom:8px; }
      .section-header h2 { font-family:'Palatino Linotype', 'Book Antiqua', Georgia, serif; font-size:1.45rem; letter-spacing:-.04em; margin:0; }
      .section-header span { color:var(--soft-ink); font:700 .66rem/1 Arial, sans-serif; letter-spacing:.08em; text-transform:uppercase; }
      .shelf { display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); }
      .book { background:var(--cream); border:1px solid var(--ink); border-left:10px solid var(--accent); color:var(--ink); display:flex; flex-direction:column; justify-content:space-between; min-height:230px; padding:18px; position:relative; text-decoration:none; transition:background 130ms ease, transform 130ms ease; }
      .book::before { color:var(--soft-ink); content:'SOURCE EDITIONS'; font:700 .58rem/1 Arial, sans-serif; letter-spacing:.1em; position:absolute; right:18px; top:20px; }
      .book:hover { background:#fff1c5; box-shadow:5px 5px 0 rgba(101,79,35,.22); transform:translate(-2px,-2px); }
      .book:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible { outline:3px solid var(--accent); outline-offset:3px; }
      .book__type { color:var(--soft-ink); font:700 .66rem/1 Arial, sans-serif; letter-spacing:.09em; text-transform:uppercase; }
      .book strong { font-family:'Palatino Linotype', 'Book Antiqua', Georgia, serif; font-size:clamp(2rem, 3vw, 3rem); letter-spacing:-.06em; line-height:.88; max-width:80%; }
      .book__meta { border-top:1px solid var(--rule); color:var(--soft-ink); display:flex; font:700 .66rem/1.35 Arial, sans-serif; justify-content:space-between; padding-top:9px; text-transform:uppercase; }
      .empty { border:1px dashed var(--rule); color:var(--soft-ink); margin:0; padding:22px; }
      .return { color:var(--accent); font:700 .75rem/1 Arial, sans-serif; letter-spacing:.07em; text-decoration:none; text-transform:uppercase; }
      .timeline-title { font-family:'Palatino Linotype', 'Book Antiqua', Georgia, serif; font-size:clamp(3.2rem, 9vw, 7rem); letter-spacing:-.08em; line-height:.8; margin:28px 0 38px; }
      .timeline { list-style:none; margin:0; padding:0; }
      .timeline li { border-top:1px solid var(--rule); }
      .timeline a { display:grid; gap:12px; grid-template-columns:130px minmax(0, 1fr) minmax(180px, .9fr); padding:19px 0; text-decoration:none; }
      .timeline a:hover strong { color:var(--accent); }
      .timeline time { color:var(--soft-ink); font:700 .68rem/1.25 Arial, sans-serif; letter-spacing:.06em; padding-top:4px; }
      .timeline strong { font-family:'Palatino Linotype', 'Book Antiqua', Georgia, serif; font-size:1.6rem; letter-spacing:-.04em; line-height:.95; transition:color 150ms ease; }
      .timeline span { color:var(--soft-ink); font-size:.9rem; }
      @media (max-width:650px) { .masthead { align-items:start; gap:16px; grid-template-columns:1fr; } .masthead__note { border-left:0; border-top:1px solid var(--rule); padding:14px 0 0; } .book__meta { flex-direction:column; gap:5px; } .timeline a { grid-template-columns:1fr; gap:6px; } .timeline-title { margin-bottom:28px; } }
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
