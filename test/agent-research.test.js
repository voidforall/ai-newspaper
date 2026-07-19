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
      return new Response(JSON.stringify({ output_text: JSON.stringify({ candidates: [
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
