import test from "node:test";
import assert from "node:assert/strict";
import { renderIssue } from "../src/render-issue.js";

test("renders a daily issue with editorial context and attributable stories", () => {
  const html = renderIssue({
    date: "2026-07-18",
    editionTitle: "The Daily Signal",
    editorNote: "AI infrastructure dominated today's discussion.",
    stories: [
      {
        headline: "A useful launch",
        summary: "A concise account of the launch.",
        category: "Technology",
        importance: 9,
        whyItMatters: "It changes how teams ship software.",
        sourceLinks: [{ name: "Hacker News", url: "https://news.ycombinator.com/item?id=1" }]
      }
    ]
  });

  assert.match(html, /The Daily Signal/);
  assert.match(html, /AI infrastructure dominated today&#039;s discussion\./);
  assert.match(html, /A useful launch/);
  assert.match(html, /It changes how teams ship software\./);
  assert.match(html, /https:\/\/news\.ycombinator\.com\/item\?id=1/);
});
