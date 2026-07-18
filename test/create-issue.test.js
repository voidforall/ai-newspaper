import test from "node:test";
import assert from "node:assert/strict";
import { createIssue } from "../src/create-issue.js";

test("creates an attributable issue from normalized HN articles, retaining the strongest duplicate", () => {
  const issue = createIssue({
    date: "2026-07-18",
    articles: [
      {
        id: "hn-1", sourceId: "hacker-news", title: "Launch post", url: "https://example.com/launch",
        publishedAt: "2026-07-18T08:00:00.000Z", rawSummary: "First submission.", score: 42,
        sourceLinks: [{ name: "Hacker News", url: "https://news.ycombinator.com/item?id=1" }, { name: "Original source", url: "https://example.com/launch" }]
      },
      {
        id: "hn-2", sourceId: "hacker-news", title: "Launch post on HN", url: "https://example.com/launch",
        publishedAt: "2026-07-18T09:00:00.000Z", rawSummary: "More discussion.", score: 121,
        sourceLinks: [{ name: "Hacker News", url: "https://news.ycombinator.com/item?id=2" }, { name: "Original source", url: "https://example.com/launch" }]
      },
      {
        id: "hn-3", sourceId: "hacker-news", title: "A database technique", url: "https://example.com/database",
        publishedAt: "2026-07-18T10:00:00.000Z", rawSummary: "An engineering write-up.", score: 87,
        sourceLinks: [{ name: "Hacker News", url: "https://news.ycombinator.com/item?id=3" }, { name: "Original source", url: "https://example.com/database" }]
      }
    ]
  });

  assert.equal(issue.date, "2026-07-18");
  assert.equal(issue.stories.length, 2);
  assert.equal(issue.stories[0].headline, "Launch post on HN");
  assert.deepEqual(issue.stories[0].articleIds, ["hn-2"]);
  assert.deepEqual(issue.stories[0].sourceLinks, [
    { name: "Hacker News", url: "https://news.ycombinator.com/item?id=2" },
    { name: "Original source", url: "https://example.com/launch" }
  ]);
});
