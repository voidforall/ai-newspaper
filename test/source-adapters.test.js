import test from "node:test";
import assert from "node:assert/strict";
import { fetchConfiguredArticles } from "../src/source-adapters.js";

test("the daily source window excludes old feed items and retains source role and content kind", async () => {
  const sourceReport = [];
  const articles = await fetchConfiguredArticles([{ id: "papers", name: "Papers", type: "rss", adapter: "rss", role: "primary", kind: "paper", feedUrl: "https://example.com/feed" }], {
    since: "2026-10-19T07:00:00.000Z", until: "2026-10-20T07:00:00.000Z", sourceReport,
    fetchImpl: async () => new Response('<rss><channel><item><title>Old paper</title><link>https://example.com/old</link><pubDate>Sun, 18 Oct 2026 08:00:00 GMT</pubDate></item><item><title>Fresh paper</title><link>https://example.com/new</link><pubDate>Mon, 19 Oct 2026 08:00:00 GMT</pubDate></item></channel></rss>')
  });
  assert.deepEqual(articles.map((article) => article.title), ["Fresh paper"]);
  assert.equal(articles[0].sourceRole, "primary");
  assert.equal(articles[0].kind, "paper");
  assert.equal(sourceReport[0].fetched, 2);
  assert.equal(sourceReport[0].candidates, 1);
});
