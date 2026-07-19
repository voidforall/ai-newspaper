import test from "node:test";
import assert from "node:assert/strict";
import { fetchRssFeed } from "../src/rss.js";

const atomFeed = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>tag:example.com,2026:1</id>
    <title>New &amp; notable model</title>
    <link rel="self" href="https://example.com/feed.xml" />
    <link rel="alternate" href="https://example.com/posts/model" />
    <updated>2026-07-19T08:00:00Z</updated>
    <summary>A detailed update &amp; practical guide.</summary>
  </entry>
</feed>`;

test("normalizes attributable Atom feed entries", async () => {
  const articles = await fetchRssFeed({
    source: { id: "example-feed", name: "Example Feed", feedUrl: "https://example.com/feed.xml" },
    limit: 1,
    fetchImpl: async () => new Response(atomFeed, { headers: { "content-type": "application/atom+xml" } })
  });

  assert.deepEqual(articles, [{
    id: "example-feed-tag-example-com-2026-1",
    sourceId: "example-feed",
    title: "New & notable model",
    url: "https://example.com/posts/model",
    publishedAt: "2026-07-19T08:00:00.000Z",
    rawSummary: "A detailed update & practical guide.",
    score: 1,
    sourceLinks: [
      { name: "Example Feed", url: "https://example.com/feed.xml" },
      { name: "Original source", url: "https://example.com/posts/model" }
    ]
  }]);
});

test("filters feed entries to an explicitly requested edition date", async () => {
  const articles = await fetchRssFeed({
    source: { id: "example-feed", name: "Example Feed", feedUrl: "https://example.com/feed.xml" },
    date: "2026-07-18",
    fetchImpl: async () => new Response(atomFeed)
  });

  assert.deepEqual(articles, []);
});
