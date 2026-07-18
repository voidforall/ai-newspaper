# AI Newspaper

A static daily newspaper generated from configurable sources. The first configured source is Hacker News; every story retains its supplied attribution links.

## Run

Requires Node.js 20+.

```sh
npm test
npm run generate
```

To edit an edition in the current Codex session, run `npm run research`. It writes the selected, investigated source material to `research/YYYY-MM-DD.json`; use `$ai-newspaper-editor` to turn that material into `issues/YYYY-MM-DD.json`, then run `npm run build`.

## Render templates

Use the standard responsive layout by default, or select the print-inspired `classic` template when building:

```sh
npm run build -- --template=classic
```

The classic template uses a warm paper texture, a traditional masthead, and multi-column story sections. Store `"template": "classic"` in an issue JSON file to make it that issue's default; `--template` overrides the saved choice for a single build.

## Daily GitHub Pages publishing

The `Publish daily newspaper` workflow builds and deploys `public/` to GitHub Pages whenever `main` changes, every day at 07:00 UTC, or when manually run from the Actions tab. In the repository's **Settings → Pages**, select **GitHub Actions** as the publishing source.

The workflow works without credentials using deterministic selection and copy. To enable AI selection and editing, add the `OPENAI_API_KEY` and `OPENAI_MODEL` repository secrets.

`npm run generate` reads `sources.json`, fetches its enabled sources, retains HN items from the last 24 hours, deduplicates original URLs, then investigates each selected original article before publishing:

- `issues/YYYY-MM-DD.json` — durable editorial data
- `public/YYYY-MM-DD/index.html` — dated edition
- `public/index.html` — newest edition

Without AI credentials it uses a deterministic editorial fallback, so generation still succeeds. To enable AI editing, provide both environment variables before generating:

```sh
export OPENAI_API_KEY="..."
export OPENAI_MODEL="your-model-id"
npm run generate
```

When credentials are present, AI first selects and orders up to ten candidate stories, then uses extracted original-article text to write the digest, category, and “why it matters” field. Invalid/unavailable AI output falls back to the extracted text; an unavailable original article retains its HN context. The pipeline retains the original source links.

## Extend

- Add a new source adapter in `src/source-adapters.js`, then enable it in `sources.json`. Its normalized articles must carry `sourceLinks`, so attribution is never guessed downstream.
- Replace the fallback categorizer with a richer editor prompt or a review queue.
- Deploy `public/` through any static host and schedule `npm run generate` daily.
