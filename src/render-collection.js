function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function sourceFor(issue) {
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
    return `<a class="book" href="sources/${group.slug}/"><span class="spine">${escapeHtml(group.name)}</span><strong>${escapeHtml(group.name)}</strong><small>${group.issues.length} edition${group.issues.length === 1 ? "" : "s"}</small><em>Latest: ${escapeHtml(latest.date)}</em></a>`;
  }).join("\n") || "<p>No sources have published an edition yet.</p>";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AI Newspaper</title><style>
    body{background:#d4d1ca;color:#171717;font:16px/1.45 Georgia,serif;margin:0}main{max-width:1100px;margin:0 auto;padding:42px 28px}h1{font-size:clamp(3rem,9vw,7rem);letter-spacing:-.08em;line-height:.82;margin:0}.deck{font-style:italic;margin:14px 0 34px}.shelf{display:grid;gap:28px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}.book{background:linear-gradient(105deg,#24221e,#454039 75%,#292723);box-shadow:8px 10px 16px #2225;color:#eee8d8;display:grid;min-height:300px;padding:26px;text-decoration:none}.book:hover{transform:translateY(-4px)}.book strong{font-size:2rem;line-height:1}.book small{font:700 .75rem Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase}.book em{align-self:end}.spine{font:700 .7rem Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}@media(max-width:600px){main{padding:30px 18px}}
  </style></head><body><main><h1>AI Newspaper</h1><p class="deck">Choose a source to browse its editions.</p><section class="shelf" aria-label="Newspaper sources">${cards}</section></main></body></html>`;
}

export function renderSourceTimeline(source, issues) {
  const editions = newestFirst(issues).map((issue) => `<li><a href="../../editions/${encodeURIComponent(issue.id)}/"><time>${escapeHtml(issue.date)}</time><strong>${escapeHtml(issue.editionTitle)}</strong><span>${escapeHtml(issue.editorNote)}</span></a></li>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(source.name)} · AI Newspaper</title><style>body{background:#e3e1dc;color:#171717;font:16px/1.5 Georgia,serif;margin:0}main{margin:auto;max-width:900px;padding:38px 24px}a{color:inherit}h1{font-size:clamp(3rem,8vw,6rem);letter-spacing:-.07em;line-height:.85}ol{border-left:2px solid #222;list-style:none;margin:34px 0;padding-left:28px}li{margin:0 0 26px;position:relative}li:before{background:#222;border-radius:50%;content:"";height:12px;left:-35px;position:absolute;top:8px;width:12px}li a{display:grid;gap:5px;text-decoration:none}time{font:700 .75rem Arial,sans-serif;letter-spacing:.1em}strong{font-size:1.7rem;line-height:1}</style></head><body><main><a href="../../">← All sources</a><h1>${escapeHtml(source.name)}</h1><p>Select an edition from the timeline.</p><ol>${editions}</ol></main></body></html>`;
}
