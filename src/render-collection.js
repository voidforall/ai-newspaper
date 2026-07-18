function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function editionSources(issue) {
  return [...new Set(issue.stories.flatMap((story) => story.sourceLinks ?? [])
    .map((source) => source.name)
    .filter((name) => name !== "Original source"))].join(" · ");
}

function pageHref(targetPage, currentPage) {
  if (currentPage === 1) return targetPage === 1 ? "./" : `page/${targetPage}/`;
  return targetPage === 1 ? "../../" : `../${targetPage}/`;
}

function editionHref(issue, currentPage) {
  const prefix = currentPage === 1 ? "" : "../../";
  return `${prefix}editions/${encodeURIComponent(issue.id)}/`;
}

export function renderCollection(issues, { page = 1, pageSize = 12 } = {}) {
  const sorted = [...issues].sort((left, right) =>
    String(right.date).localeCompare(String(left.date)) || String(right.id).localeCompare(String(left.id))
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const editions = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const navigation = totalPages > 1
    ? `<nav class="pagination" aria-label="Edition pages">${Array.from({ length: totalPages }, (_, index) => index + 1)
      .map((number) => number === currentPage
        ? `<span aria-current="page">${number}</span>`
        : `<a href="${pageHref(number, currentPage)}">${number}</a>`)
      .join(" ")}</nav>`
    : "";
  const cards = editions.length
    ? editions.map((issue) => `<article class="edition-card">
      <p class="edition-date">${escapeHtml(issue.date)} · ${escapeHtml(editionSources(issue) || "Independent edition")}</p>
      <h2><a href="${editionHref(issue, currentPage)}">${escapeHtml(issue.editionTitle)}</a></h2>
      <p>${escapeHtml(issue.editorNote)}</p>
      <a class="read-edition" href="${editionHref(issue, currentPage)}">Read edition →</a>
    </article>`).join("\n")
    : "<p class=\"empty\">No editions have been published yet.</p>";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Newspaper</title>
  <style>
    :root { --ink: #191919; --paper: #e4e2dc; --rule: #302f2c; }
    * { box-sizing: border-box; }
    body { background: #bdbbb4; color: var(--ink); font: 16px/1.5 Georgia, serif; margin: 0; }
    main { background: var(--paper); box-shadow: 0 2px 18px #1114; margin: 28px auto; max-width: 920px; padding: 26px 30px 38px; }
    header { border-bottom: 5px double var(--rule); text-align: center; }
    h1 { font-size: clamp(3rem, 10vw, 6.5rem); letter-spacing: -.075em; line-height: .82; margin: 0 0 12px; text-transform: uppercase; }
    .deck { font-style: italic; margin: 10px 0 16px; }
    .collection { display: grid; gap: 0; }
    .edition-card { border-bottom: 1px solid #77746d; padding: 20px 0; }
    .edition-date { font: 700 .72rem/1.2 Arial, sans-serif; letter-spacing: .09em; margin: 0 0 7px; text-transform: uppercase; }
    h2 { font-size: clamp(1.7rem, 4vw, 2.7rem); letter-spacing: -.04em; line-height: 1; margin: 0; }
    a { color: inherit; text-decoration-thickness: 1px; text-underline-offset: 3px; }
    .read-edition { font: 700 .75rem/1 Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
    .pagination { display: flex; gap: 8px; justify-content: center; margin-top: 26px; }
    .pagination a, .pagination span { border: 1px solid var(--rule); font: 700 .78rem/1 Arial, sans-serif; min-width: 30px; padding: 8px; text-align: center; }
    .pagination span { background: var(--ink); color: var(--paper); }
    .empty { font-style: italic; }
    @media (max-width: 640px) { main { margin: 0; min-height: 100vh; padding: 22px 18px; } }
  </style>
</head>
<body>
  <main>
    <header><h1>AI Newspaper</h1><p class="deck">A collection of attributable daily editions.</p></header>
    <section class="collection" aria-label="Published editions">${cards}</section>
    ${navigation}
  </main>
</body>
</html>`;
}
