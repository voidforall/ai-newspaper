function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderStory(story) {
  const sources = story.sourceLinks
    .map((source) => `<a href="${escapeHtml(source.url)}" rel="noreferrer">${escapeHtml(source.name)}</a>`)
    .join(" · ");

  return `<article>
    <p class="category">${escapeHtml(story.category)}</p>
    <h2>${escapeHtml(story.headline)}</h2>
    <p>${escapeHtml(story.summary)}</p>
    <p class="why"><strong>Why it matters:</strong> ${escapeHtml(story.whyItMatters)}</p>
    <p class="sources">Sources: ${sources}</p>
  </article>`;
}

export function renderIssue(issue) {
  const stories = issue.stories.map(renderStory).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(issue.editionTitle)} — ${escapeHtml(issue.date)}</title>
  <style>
    body { background: #f7f2e8; color: #1e1c18; font: 18px/1.55 Georgia, serif; margin: 0; }
    main { margin: 0 auto; max-width: 760px; padding: 48px 24px; }
    header { border-bottom: 3px solid #1e1c18; padding-bottom: 20px; }
    h1, h2 { font-family: Arial, sans-serif; line-height: 1.1; }
    h1 { font-size: clamp(2.3rem, 8vw, 4.6rem); margin: 0; }
    article { border-bottom: 1px solid #aaa092; padding: 24px 0; }
    .category { color: #8b2f1f; font: bold .78rem/1 Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
    .why { font-style: italic; }
    .sources { font: .85rem/1.4 Arial, sans-serif; }
    a { color: #8b2f1f; }
  </style>
</head>
<body><main>
  <header><p>${escapeHtml(issue.date)}</p><h1>${escapeHtml(issue.editionTitle)}</h1><p>${escapeHtml(issue.editorNote)}</p></header>
  ${stories}
</main></body>
</html>`;
}
