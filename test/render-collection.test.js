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

test("renders a paginated, newest-first collection of editions", () => {
  const html = renderCollection([
    issue("2026-07-16-hacker-news", "2026-07-16", "Older edition"),
    issue("2026-07-18-hacker-news", "2026-07-18", "Latest edition"),
    issue("2026-07-17-research", "2026-07-17", "Middle edition")
  ], { page: 1, pageSize: 2 });

  assert.match(html, /Latest edition/);
  assert.match(html, /Middle edition/);
  assert.doesNotMatch(html, /Older edition/);
  assert.match(html, /editions\/2026-07-18-hacker-news\//);
  assert.match(html, /page\/2\//);
});
