export function renderRecipeBuilder() {
  return `<section class="builder" aria-labelledby="recipe-builder-title">
    <div class="builder__heading"><div><p class="kicker">Make your own desk</p><h2 id="recipe-builder-title">Compose an edition</h2></div><p>Pick dependable inputs, then take the recipe with you. No credentials are saved here.</p></div>
    <div class="builder__steps" aria-hidden="true"><span>01 &nbsp; Name it</span><span>02 &nbsp; Add sources</span><span>03 &nbsp; Export</span></div>
    <div class="builder__form">
      <label class="field field--wide"><span>Recipe name</span><input id="recipe-name" value="My AI Briefing"></label>
      <label class="field field--wide"><span>Included source IDs <i>Comma-separated</i></span><input id="recipe-sources" value="hacker-news"></label>
      <label class="field"><span>RSS or Atom URL <i>Optional</i></span><input id="rss-url" inputmode="url" placeholder="https://example.com/feed.xml"></label>
      <label class="field"><span>GitHub releases <i>Optional</i></span><input id="github-repository" placeholder="owner/repository"></label>
      <label class="field"><span>Research topic <i>Optional</i></span><input id="research-topic" placeholder="e.g. AI safety research"></label>
      <label class="field"><span>Allowed domains <i>Required for research</i></span><input id="research-domains" placeholder="arxiv.org, openai.com"></label>
    </div>
    <div class="builder__actions"><button class="button button--primary" id="export-recipe" type="button">Prepare recipe</button><button class="button" id="copy-recipe" type="button">Copy CLI command</button><button class="button" id="download-recipe" type="button">Download JSON</button><output id="recipe-status" aria-live="polite"></output></div>
    <textarea id="recipe-output" aria-label="Generated recipe JSON" readonly placeholder="Your recipe JSON will appear here."></textarea>
    <style>
      .builder { border-top:3px double var(--ink); margin-top:58px; padding-top:17px; }
      .builder__heading { align-items:end; display:flex; gap:30px; justify-content:space-between; }
      .builder__heading h2 { font-size:clamp(2.2rem, 4.5vw, 4rem); letter-spacing:-.07em; line-height:.86; margin:0; }
      .builder__heading > p { color:var(--soft-ink); margin:0; max-width:25rem; }
      .builder__steps { border-bottom:1px solid var(--ink); border-top:1px solid var(--ink); display:grid; font:700 .68rem/1 Arial,sans-serif; grid-template-columns:repeat(3, 1fr); letter-spacing:.1em; margin-top:26px; text-transform:uppercase; }
      .builder__steps span { padding:10px 0; } .builder__steps span + span { border-left:1px solid var(--rule); padding-left:12px; }
      .builder__form { display:grid; gap:17px 20px; grid-template-columns:repeat(2, minmax(0, 1fr)); margin:26px 0 20px; }
      .field { display:grid; gap:7px; } .field--wide { grid-column:span 1; }
      .field span { font:700 .74rem/1 Arial,sans-serif; letter-spacing:.06em; text-transform:uppercase; } .field i { color:var(--soft-ink); font:400 .72rem Georgia,serif; letter-spacing:0; text-transform:none; }
      .field input, #recipe-output { background:var(--cream); border:1px solid var(--rule); border-radius:0; color:var(--ink); font:1rem/1.3 Georgia,serif; min-width:0; padding:10px 11px; width:100%; }
      .field input::placeholder, #recipe-output::placeholder { color:#858176; font-style:italic; }
      .builder__actions { align-items:center; display:flex; flex-wrap:wrap; gap:8px; }
      .button { background:transparent; border:1px solid var(--ink); border-radius:0; color:var(--ink); cursor:pointer; font:700 .7rem/1 Arial,sans-serif; letter-spacing:.08em; padding:11px 13px; text-transform:uppercase; }
      .button:hover { background:var(--ink); color:var(--cream); } .button--primary { background:var(--red); border-color:var(--red); color:white; } .button--primary:hover { background:#7d211d; border-color:#7d211d; }
      #recipe-status { color:var(--soft-ink); font-size:.85rem; margin-left:4px; } #recipe-output { display:block; height:178px; margin-top:16px; resize:vertical; white-space:pre; }
      @media (max-width:650px) { .builder__heading { align-items:start; flex-direction:column; gap:12px; } .builder__form { grid-template-columns:1fr; } .builder__steps { font-size:.58rem; } .builder__steps span + span { padding-left:6px; } }
    </style>
    <script>
      const out = document.getElementById('recipe-output');
      const status = document.getElementById('recipe-status');
      const read = (id) => document.getElementById(id).value.trim();
      const announce = (message) => { status.textContent = message; };
      document.getElementById('export-recipe').onclick = () => {
        const name = read('recipe-name'); const ids = read('recipe-sources').split(',').map((item) => item.trim()).filter(Boolean);
        const rss = read('rss-url'); const repository = read('github-repository'); const topic = read('research-topic');
        const domains = read('research-domains').split(',').map((item) => item.trim()).filter(Boolean); const sources = [];
        if (rss) { if (!/^https?:\\/\\//.test(rss)) return announce('Use an HTTP(S) URL for RSS.'); sources.push({ id:'custom-rss', name:'Custom RSS', type:'rss', adapter:'rss', feedUrl:rss }); ids.push('custom-rss'); }
        if (repository) { if (!/^[\\w.-]+\\/[\\w.-]+$/.test(repository)) return announce('Use owner/repository for GitHub.'); sources.push({ id:'custom-releases', name:'Custom releases', type:'api', adapter:'github-releases', repository }); ids.push('custom-releases'); }
        if (topic) { if (!domains.length) return announce('Research needs at least one allowed domain.'); sources.push({ id:'custom-research', name:'Custom research', type:'agent-research', adapter:'agent-research', topic, allowedDomains:domains, maxCandidates:4, maxSearches:1, maxOutputTokens:900 }); ids.push('custom-research'); }
        if (!name || !ids.length) return announce('Add a recipe name and at least one source.');
        out.value = JSON.stringify({ recipe:{ id:name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, sources:ids, maxStories:10 }, sources }, null, 2); announce('Recipe is ready to export.');
      };
      document.getElementById('copy-recipe').onclick = async () => { try { await navigator.clipboard.writeText('npm run generate -- --recipe-file=recipe.json'); announce('CLI command copied.'); } catch { announce('Copy is unavailable in this browser.'); } };
      document.getElementById('download-recipe').onclick = () => { if (!out.value) return announce('Prepare a recipe before downloading.'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([out.value], { type:'application/json' })); link.download = 'recipe.json'; link.click(); URL.revokeObjectURL(link.href); announce('Download started.'); };
    </script>
  </section>`;
}
