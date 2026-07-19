# AI Newspaper — Project Context

## Purpose

AI Newspaper turns configured news sources into dated, attributable static newspaper editions. It is currently an MVP centred on Hacker News and deployed through GitHub Pages.

## Current product shape

- The home page is a source bookshelf: each source opens its own edition collection.
- A source page presents its available dates as a chronological reading list.
- An edition is a responsive newspaper page with source attribution, digest, editorial context, and links to original reporting.
- The reader can move between adjacent editions without returning to the collection:
  - desktop: semi-transparent left/right arrows sit in the outer page margins;
  - mobile: compact fixed controls sit at the bottom;
  - all layouts: a date timeline is placed beneath the newspaper content.
- Two templates are available: `standard` and print-inspired `classic` (neutral ink-and-newsprint texture, rather than yellow paper).

## Editorial pipeline

```text
configured source → normalized articles → selection → original-article investigation
                  → editorial digest → issue JSON → static HTML collection
```

- `npm run research [-- --date=YYYY-MM-DD]` fetches, selects, and investigates material into `research/` for an editor session.
- `$ai-newspaper-editor` is the intended Codex workflow for turning that research into a reviewed issue JSON.
- `npm run build [-- --template=standard|classic]` renders all saved issues, source collections, and in-edition navigation.
- `npm run generate` runs the whole automated path. With `OPENAI_API_KEY` and `OPENAI_MODEL` it uses AI selection/editing; otherwise it uses deterministic fallback behavior.

## Important repository locations

| Location | Responsibility |
| --- | --- |
| `src/cli.js` | Commands, issue IDs, rendering, collection generation, edition navigation data |
| `src/hacker-news.js` | Hacker News fetching and normalization |
| `src/source-adapters.js` | Registry for enabled source adapters |
| `src/investigate-content.js` | Original-article extraction with safety checks |
| `src/edit-issue.js` | AI and deterministic editorial output |
| `src/render-issue.js` | Newspaper templates and reader controls |
| `src/render-collection.js` | Source bookshelf and source timeline pages |
| `issues/` | Durable edition data; preserve as the publication archive |
| `sources.json` | Enabled source configuration |
| `.github/workflows/publish-pages.yml` | Daily generation and GitHub Pages deployment |

## Deployment and operations

- Repository: `https://github.com/voidforall/ai-newspaper` (public).
- Site: `https://voidforall.github.io/ai-newspaper/`.
- GitHub Actions builds/deploys on pushes to `main`, daily at 07:00 UTC, and by manual dispatch. Scheduled/manual runs can archive a new issue, so pull/rebase before pushing if the workflow has committed meanwhile.
- The project requires Node.js 20+; validate changes with `npm test && npm run build`.

## Current MVP boundaries

- Only Hacker News is implemented as a source adapter.
- The site is static: no accounts, saved reading state, search, or server database.
- The chronology is date/edition-ID based. Multiple same-day editions are supported through `--edition`, but collection labels and editorial controls remain intentionally simple.
- Browser presentation is the current output target; there is no PDF/print production path yet.

## Next plan

### 1. Strengthen editorial quality (next priority)

1. Define a small, repeatable editorial rubric: story diversity, primary-source preference, duplicate handling, factual/attribution checks, and a clear editorial voice.
2. Add validation for generated issue JSON so malformed AI output, missing source links, and unreasonably short digests are caught before publishing.
3. Add an optional review queue or `--draft` mode: research → editable issue → explicit publish, while retaining the fully automated daily route.
4. Expand tests with representative source failures and editorial-output edge cases.

### 2. Add a second source

1. Choose a source with a stable public feed/API and clear licensing/attribution expectations.
2. Implement it behind `src/source-adapters.js`, normalize it to the existing article shape, and add fixture-driven tests.
3. Validate that the bookshelf, source timeline, timeline navigation, and mixed-source issue IDs all work without source-specific UI code.

### 3. Make the reader feel more like a publication

1. Add keyboard navigation (`←` / `→`) and clear focus styles for the side arrows and timeline.
2. Improve timeline scale for longer archives: month grouping, newest/oldest shortcuts, and an accessible compact selector on narrow screens.
3. Add browser-level visual regression checks for standard, classic, desktop, and mobile layouts.

### 4. Decide on distribution beyond the website

1. Evaluate print CSS and a PDF export path for a true printable newspaper artifact.
2. Consider RSS/email delivery only after editorial review and archive quality are dependable.

## Suggested first ticket

**Editorial validation and draft workflow:** add a schema validator for issue JSON, a `--draft`/review state, and tests proving that invalid or insufficiently attributed AI output cannot be deployed.
