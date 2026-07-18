---
name: ai-newspaper-editor
description: Research, edit, and publish a Daily AI Newspaper edition from its original source material. Use when asked to create or update a daily issue, turn fetched stories into factual digests and an editor's note, or run the project's `npm run research` → editorial review → `npm run build` workflow.
---

# AI Newspaper Editor

Act as the human editor for the current session. Preserve attribution, write only from the investigated material, and publish only after the issue data is complete.

## Workflow

1. Run `npm run research` from the repository root. It writes `research/YYYY-MM-DD-<edition>.json`, containing the selected stories and their investigated original-article text. Use `-- --edition=<slug>` to create a distinct same-day edition.
2. Read that day's research file. Use each article's `content` when its investigation status is `complete`; otherwise use its title and `rawSummary` only. Never fill gaps with inference or outside facts.
3. Create or replace `issues/YYYY-MM-DD-<edition>.json` for the same date. Set its `id` to the filename without `.json`, and retain, for every selected story:
   - `articleIds`: an array containing the research article's `id`
   - `importance`: the research article's `score`
   - `sourceLinks`: the research article's `sourceLinks`, unchanged
4. Write the editorial fields:
   - `editorNote`: one concise paragraph that synthesizes the edition without introducing facts.
   - `headline`: a clear, accurate headline.
   - `summary`: a digest of one or two sentences grounded in the source material.
   - `whyItMatters`: one sentence describing the material consequence, not a prediction.
   - `category`: exactly `Technology`, `Business`, or `Ideas`.
   - Keep at most ten stories and use `editionTitle: "The Daily Signal"` unless the user asks otherwise. Include `date` and an ISO-8601 `generatedAt` timestamp.
5. Inspect the JSON for factual support, valid JSON, preserved links, and matching article IDs. Then run `npm run build` to publish the edition at `public/editions/<id>/index.html` and refresh the paginated collection at `public/index.html`.

## Guardrails

- Do not use the Hacker News discussion as evidence when investigated original material is available.
- Do not alter or remove `sourceLinks`; do not add URLs or sources that are absent from research.
- If an original article is unavailable, say only what the retained research fields support.
- Do not call the automatic `npm run generate` path for this workflow: this skill makes the current Codex session responsible for editorial judgment.
