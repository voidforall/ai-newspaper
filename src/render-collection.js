function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
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
    return `<a class="book" href="sources/${group.slug}/"><span class="spine">${escapeHtml(group.name)}</span><strong>${escapeHtml(group.name)}</strong><small>${group.issues.length} edition${group.issues.length === 1 ? "" : "s"}</small><em>Latest: ${escapeHtml(latest.date)}</em></a>`;
  }).join("\n") || "<p>No sources have published an edition yet.</p>";
  const builder = `<section class="builder"><h2>Recipe builder</h2><p>Choose sources and export a shareable recipe. This page never stores credentials.</p><label>Recipe name <input id="recipe-name" value="My AI Briefing"></label><label>Sources <input id="recipe-sources" value="hacker-news" placeholder="hacker-news,rss-source"></label><label>RSS URL <input id="rss-url" placeholder="https://example.com/feed.xml"></label><label>GitHub repository <input id="github-repository" placeholder="owner/repository"></label><label>Research topic <input id="research-topic" placeholder="AI policy"></label><label>Allowed domains <input id="research-domains" placeholder="gov.uk,ec.europa.eu"></label><button id="export-recipe" type="button">Export recipe JSON</button><textarea id="recipe-output" readonly aria-label="Recipe JSON"></textarea></section><script>document.getElementById('export-recipe').onclick=()=>{const name=document.getElementById('recipe-name').value.trim();const ids=document.getElementById('recipe-sources').value.split(',').map(x=>x.trim()).filter(Boolean);const rss=document.getElementById('rss-url').value.trim(),repo=document.getElementById('github-repository').value.trim(),topic=document.getElementById('research-topic').value.trim(),domains=document.getElementById('research-domains').value.split(',').map(x=>x.trim()).filter(Boolean);const sources=[];if(rss){if(!/^https?:\/\//.test(rss))return alert('RSS URL must be HTTP(S).');sources.push({id:'custom-rss',name:'Custom RSS',type:'rss',adapter:'rss',feedUrl:rss});ids.push('custom-rss')}if(repo){if(!/^[\w.-]+\/[\w.-]+$/.test(repo))return alert('GitHub repository must be owner/repository.');sources.push({id:'custom-releases',name:'Custom releases',type:'api',adapter:'github-releases',repository:repo});ids.push('custom-releases')}if(topic){if(!domains.length)return alert('Research requires allowed domains.');sources.push({id:'custom-research',name:'Custom research',type:'agent-research',adapter:'agent-research',topic,allowedDomains:domains,maxCandidates:4,maxSearches:1,maxOutputTokens:900});ids.push('custom-research')}if(!name||!ids.length)return alert('Recipe name and at least one source are required.');document.getElementById('recipe-output').value=JSON.stringify({recipe:{id:name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name,sources:ids,maxStories:10},sources},null,2)}</script>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AI Newspaper</title><style>
    body{background:#d4d1ca;color:#171717;font:16px/1.45 Georgia,serif;margin:0}main{max-width:1100px;margin:0 auto;padding:42px 28px}h1{font-size:clamp(3rem,9vw,7rem);letter-spacing:-.08em;line-height:.82;margin:0}.deck{font-style:italic;margin:14px 0 34px}.shelf{display:grid;gap:28px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}.book{background:linear-gradient(105deg,#24221e,#454039 75%,#292723);box-shadow:8px 10px 16px #2225;color:#eee8d8;display:grid;min-height:300px;padding:26px;text-decoration:none}.book:hover{transform:translateY(-4px)}.book strong{font-size:2rem;line-height:1}.book small{font:700 .75rem Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase}.book em{align-self:end}.spine{font:700 .7rem Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}@media(max-width:600px){main{padding:30px 18px}}
  </style></head><body><main><h1>AI Newspaper</h1><p class="deck">Choose a source to browse its editions.</p><section class="shelf" aria-label="Newspaper sources">${cards}</section>${builder}</main></body></html>`;
}

export function renderSourceTimeline(source, issues) {
  const editions = newestFirst(issues).map((issue) => `<li><a href="../../editions/${encodeURIComponent(issue.id)}/"><time>${escapeHtml(issue.date)}</time><strong>${escapeHtml(issue.editionTitle)}</strong><span>${escapeHtml(issue.editorNote)}</span></a></li>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(source.name)} · AI Newspaper</title><style>body{background:#e3e1dc;color:#171717;font:16px/1.5 Georgia,serif;margin:0}main{margin:auto;max-width:900px;padding:38px 24px}a{color:inherit}h1{font-size:clamp(3rem,8vw,6rem);letter-spacing:-.07em;line-height:.85}ol{border-left:2px solid #222;list-style:none;margin:34px 0;padding-left:28px}li{margin:0 0 26px;position:relative}li:before{background:#222;border-radius:50%;content:"";height:12px;left:-35px;position:absolute;top:8px;width:12px}li a{display:grid;gap:5px;text-decoration:none}time{font:700 .75rem Arial,sans-serif;letter-spacing:.1em}strong{font-size:1.7rem;line-height:1}</style></head><body><main><a href="../../">← All sources</a><h1>${escapeHtml(source.name)}</h1><p>Select an edition from the timeline.</p><ol>${editions}</ol></main></body></html>`;
}
