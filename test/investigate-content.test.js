import test from "node:test";
import assert from "node:assert/strict";
import { investigateArticle } from "../src/investigate-content.js";
import { createIssue } from "../src/create-issue.js";
import { createEditorialBrief } from "../src/edit-issue.js";

test("investigates an original article and produces a readable digest input", async () => {
  const article = {
    id: "hn-1",
    title: "An important launch",
    url: "https://example.com/launch",
    rawSummary: "HN discussion context.",
    sourceLinks: []
  };
  const investigated = await investigateArticle(article, async () => ({
    ok: true,
    headers: new Headers({ "content-type": "text/html" }),
    text: async () => `<!doctype html><html><head><title>Ignore this title</title><style>.ad { display:none }</style></head>
      <body><nav>Subscribe to everything</nav><main><h1>Launch details</h1><p>The team released a new tool for small teams.</p><p>It reduces setup time from days to minutes.</p></main><script>alert('ignore')</script></body></html>`
  }));

  assert.match(investigated.rawSummary, /The team released a new tool/);
  assert.match(investigated.content, /It reduces setup time from days to minutes/);
  assert.doesNotMatch(investigated.content, /Subscribe|alert|display:none/);
  assert.equal(investigated.investigation.status, "complete");
  const issue = createIssue({ date: "2026-07-18", articles: [{ ...investigated, score: 10 }] });
  assert.doesNotMatch(issue.stories[0].summary, /Read the discussion and original source/);
  assert.match(issue.stories[0].summary, /The team released a new tool/);
  assert.equal("content" in issue.stories[0], false);
});

test("retains HN context when original article investigation fails", async () => {
  const article = { id: "hn-2", url: "https://example.com/unavailable", rawSummary: "HN context.", sourceLinks: [] };
  const investigated = await investigateArticle(article, async () => { throw new Error("network blocked"); });

  assert.equal(investigated.rawSummary, "HN context.");
  assert.equal(investigated.investigation.status, "unavailable");
});

test("does not investigate local-network URLs", async () => {
  let requested = false;
  const article = { id: "hn-unsafe", url: "http://127.0.0.1/private", rawSummary: "HN context.", sourceLinks: [] };
  const investigated = await investigateArticle(article, async () => {
    requested = true;
    throw new Error("should not run");
  });

  assert.equal(requested, false);
  assert.deepEqual(investigated.investigation, { status: "skipped", reason: "unsafe-url" });
});

test("keeps full investigated material out of the issue but passes it to the AI editor", () => {
  const issue = {
    stories: [{ articleIds: ["hn-3"], headline: "A report", summary: "Short fallback.", category: "Ideas" }]
  };
  const brief = createEditorialBrief(issue, [{ id: "hn-3", content: "First reported fact. Second reported fact." }]);

  assert.equal(brief[0].sourceText, "First reported fact. Second reported fact.");
  assert.equal("content" in issue.stories[0], false);
});
