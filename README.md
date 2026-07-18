# Daily AI Newspaper

A static daily newspaper generated from Hacker News. It always attributes each story to Hacker News and its original URL.

## Run

Requires Node.js 20+.

```sh
npm test
npm run generate
```

`npm run generate` fetches up to 30 current HN top stories, retains items from the last 24 hours, deduplicates original URLs, selects the ten highest-scoring stories, and publishes:

- `issues/YYYY-MM-DD.json` — durable editorial data
- `public/YYYY-MM-DD/index.html` — dated edition
- `public/index.html` — newest edition

Without AI credentials it uses a deterministic editorial fallback, so generation still succeeds. To enable AI editing, provide both environment variables before generating:

```sh
export OPENAI_API_KEY="..."
export OPENAI_MODEL="your-model-id"
npm run generate
```

The AI editor may only rewrite the title, summary, category, and “why it matters” field. It receives no source-creation ability and the pipeline retains the original source links.

## Extend

- Add a new source adapter that returns the normalized article shape used by `createIssue`.
- Replace the fallback categorizer with a richer editor prompt or a review queue.
- Deploy `public/` through any static host and schedule `npm run generate` daily.
