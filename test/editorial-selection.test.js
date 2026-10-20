import test from "node:test";
import assert from "node:assert/strict";
import { selectArticlesWithAi } from "../src/edit-issue.js";

const policy = {
  version: "ai-builder-v1", language: "zh-CN", audience: "AI 应用开发者",
  maxPerSource: 2, maxPerTopic: 2
};

function article(id, sourceId, title, options = {}) {
  const url = options.url ?? `https://example.com/${id}`;
  return { id, sourceId, title, url, rawSummary: "A documented technical change with limitations.",
    publishedAt: "2026-10-20T08:00:00.000Z", score: 1,
    sourceLinks: [{ name: sourceId, url: `https://example.com/${sourceId}/feed` }, { name: "Original source", url }], ...options };
}

test("URL duplicates merge before selection, retain attribution, and do not consume story slots", async () => {
  const selected = await selectArticlesWithAi([
    article("community", "hn", "AI SDK release", { url: "https://example.com/sdk?version=2&utm_source=hn#news", sourceRole: "community", score: 900 }),
    article("official", "releases", "Official AI SDK release", { url: "https://example.com/sdk?version=2", sourceRole: "primary", kind: "release", score: 1 }),
    article("next", "papers", "An AI model evaluation paper", { kind: "paper", sourceRole: "primary" }),
    article("other-version", "releases", "AI SDK next release", { url: "https://example.com/sdk?version=3", kind: "release", sourceRole: "primary" })
  ], {}, 3, { policy });
  assert.equal(selected.length, 3);
  const merged = selected.find((item) => item.id === "official");
  assert.deepEqual(new Set(merged.articleIds), new Set(["community", "official"]));
  assert.ok(merged.sourceLinks.some((link) => link.name === "hn"));
  assert.ok(merged.sourceLinks.some((link) => link.name === "releases"));
  assert.ok(selected.some((item) => item.url.endsWith("version=3")));
});

test("rule-based fallback balances sources without comparing HN votes to feed positions or padding the edition", async () => {
  const selected = await selectArticlesWithAi([
    article("politics", "hn", "Local mayor wins election", { score: 9000 }),
    article("promo", "hn", "AI launch: limited-time discount, claim your free credits", { score: 8000 }),
    article("waitlist", "hn", "Introducing our revolutionary AI platform—join the waitlist", { score: 7000 }),
    article("sdk", "official", "AI SDK stable release", { kind: "release", sourceRole: "primary", score: 1 }),
    article("agents", "papers", "An agent evaluation paper", { kind: "paper", sourceRole: "primary", score: 1 }),
    article("rag", "hn", "RAG retrieval failure analysis", { sourceRole: "community", score: 600 })
  ], {}, 8, { policy });
  assert.equal(selected.length, 3);
  assert.equal(selected[0].sourceRole, "primary");
  assert.deepEqual(new Set(selected.map((item) => item.id)), new Set(["sdk", "agents", "rag"]));
});

test("a release discovered through the community retains release-specific editorial treatment", async () => {
  const selected = await selectArticlesWithAi([
    article("community-release", "hn", "A new SDK version", { url: "https://github.com/example/sdk/releases/tag/v2.0", sourceRole: "community" })
  ], {}, 8, { policy });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].kind, "release");
});

test("AI ordering is constrained by source and topic caps, and may intentionally select nothing", async (t) => {
  const candidates = [
    article("a", "one", "AI model A"), article("b", "one", "AI model B"),
    article("c", "two", "AI model C"), article("d", "three", "AI agent SDK")
  ];
  let response = { articleIds: ["a", "b", "c", "d"], topics: { a: "models", b: "models", c: "models", d: "agents" } };
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const input = JSON.parse(options.body).input;
    assert.match(input, /technical usefulness|技术实用性/);
    assert.match(input, /maxPerTopic/);
    assert.doesNotMatch(input, /"score":/);
    return new Response(JSON.stringify({ status: "completed", output_text: JSON.stringify(response) }));
  });
  const env = { OPENAI_API_KEY: "fixture-key", OPENAI_MODEL: "fixture-model" };
  const selected = await selectArticlesWithAi(candidates, env, 8, { policy });
  assert.deepEqual(selected.map((item) => item.id), ["a", "b", "d"]);
  response = { articleIds: [], topics: {} };
  assert.deepEqual(await selectArticlesWithAi(candidates, env, 8, { policy }), []);
});
