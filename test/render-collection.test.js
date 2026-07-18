import test from "node:test";
import assert from "node:assert/strict";
import { renderCollection } from "../src/render-collection.js";

const issue = (id, date, title) => ({
  id,
  date,
  editionTitle: title,
  generatedAt: `${date}T08:00:00.000Z`,
  editorNote: "A concise edition.",
  stories: [{ headline: "Lead story", sourceLinks: [{ name: "Hacker News", url: "https://news.ycombinator.com" }] }]
});

test("renders a source bookshelf that links to each source timeline", () => {
  const html = renderCollection([
    issue("2026-07-16-hacker-news", "2026-07-16", "Older edition"),
    issue("2026-07-18-hacker-news", "2026-07-18", "Latest edition")
  ]);

  assert.match(html, /Latest: 2026-07-18/);
  assert.match(html, /Hacker News/);
  assert.match(html, /2 editions/);
  assert.match(html, /sources\/hacker-news\//);
});
