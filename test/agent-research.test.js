import test from "node:test";
import assert from "node:assert/strict";
import { fetchAgentResearch } from "../src/agent-research.js";

test("normalizes only allowed, attributable research candidates", async () => {
  const requests = [];
  const articles = await fetchAgentResearch({
    source: { id: "policy", name: "Policy Watch", topic: "AI policy", allowedDomains: ["gov.uk"], maxCandidates: 2, maxSearches: 1, maxOutputTokens: 500 },
    environment: { OPENAI_API_KEY: "key", OPENAI_MODEL: "model" },
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ status: "completed", output_text: JSON.stringify({ candidates: [
        { title: "UK AI update", url: "https://www.gov.uk/ai-update", summary: "Official policy update." },
        { title: "Rejected", url: "https://example.com/post", summary: "Not allowed." }
      ] }), output: [{ content: [{ type: "output_text", annotations: [{ type: "url_citation", url: "https://www.gov.uk/ai-update" }] }] }] }));
    }
  });

  assert.equal(requests[0].tools[0].filters.allowed_domains[0], "gov.uk");
  assert.equal(requests[0].max_tool_calls, 1);
  assert.deepEqual(articles, [{
    id: "agent-policy-https-www-gov-uk-ai-update",
    sourceId: "policy",
    title: "UK AI update",
    url: "https://www.gov.uk/ai-update",
    publishedAt: undefined,
    rawSummary: "Official policy update.",
    score: 2,
    sourceLinks: [{ name: "Policy Watch", url: "https://gov.uk/" }, { name: "Original source", url: "https://www.gov.uk/ai-update" }]
  }]);
});

test("returns no articles when research credentials are unavailable", async () => {
  const articles = await fetchAgentResearch({ source: { id: "policy", name: "Policy Watch", topic: "AI policy", allowedDomains: ["gov.uk"] }, environment: {} });
  assert.deepEqual(articles, []);
});

test("failed research reports its source state and observed model usage without exposing response content", async () => {
  const sourceResult = { status: "pending" };
  const run = { modelCalls: [] };
  const articles = await fetchAgentResearch({
    source: { id: "policy", name: "Policy Watch", topic: "AI policy", allowedDomains: ["gov.uk"] },
    environment: { OPENAI_API_KEY: "not-a-real-key", OPENAI_MODEL: "research-model" }, sourceResult, run,
    fetchImpl: async () => new Response(JSON.stringify({ status: "incomplete", model: "research-model-snapshot", usage: { input_tokens: 100, output_tokens: 30, total_tokens: 130 }, output_text: "private response content" }))
  });
  assert.deepEqual(articles, []);
  assert.equal(sourceResult.status, "failed");
  assert.equal(run.modelCalls.length, 1);
  assert.equal(run.modelCalls[0].model, "research-model-snapshot");
  assert.equal(run.modelCalls[0].usage.total_tokens, 130);
  assert.equal(run.modelCalls[0].status, "failed");
  assert.doesNotMatch(JSON.stringify(run), /not-a-real-key|private response content/);
});
