# Daily AI Newspaper

A static daily newspaper generated from configurable sources. The first configured source is Hacker News; every story retains its supplied attribution links.

## Run

Requires Node.js 20+.

```sh
npm test
npm run generate
```

`npm run generate` reads `sources.json`, fetches its enabled sources, retains HN items from the last 24 hours, deduplicates original URLs, and publishes:

- `issues/YYYY-MM-DD.json` — durable editorial data
- `public/YYYY-MM-DD/index.html` — dated edition
- `public/index.html` — newest edition

Without AI credentials it uses a deterministic editorial fallback, so generation still succeeds. To enable AI editing, provide both environment variables before generating:

```sh
export OPENAI_API_KEY="..."
export OPENAI_MODEL="your-model-id"
npm run generate
```

When credentials are present, AI first selects and orders up to ten candidate stories, then rewrites the title, summary, category, and “why it matters” field. Invalid/unavailable AI output falls back to the top-scoring stories and deterministic copy. It receives no source-creation ability and the pipeline retains the original source links.

## Extend

- Add a new source adapter in `src/source-adapters.js`, then enable it in `sources.json`. Its normalized articles must carry `sourceLinks`, so attribution is never guessed downstream.
- Replace the fallback categorizer with a richer editor prompt or a review queue.
- Deploy `public/` through any static host and schedule `npm run generate` daily.
