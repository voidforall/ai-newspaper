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

test("editorial input retains later source limitations beyond the old 4,000-character cutoff", () => {
  const content = `A documented release. ${"Additional implementation detail. ".repeat(160)} Limitations: no Apple Silicon support has been validated.`;
  assert.ok(content.length > 4_000);
  const brief = createEditorialBrief({ stories: [{ articleIds: ["release"], headline: "A release", summary: "A short digest.", category: "Technology" }] }, [{ id: "release", content }]);
  assert.match(brief[0].sourceText, /no Apple Silicon support has been validated/);
});

test("article extraction removes dialog/navigation noise and preserves decimal versions and later limitations", async () => {
  const article = { id: "reported-release", url: "https://example.com/dynamic", sourceLinks: [] };
  const result = await investigateArticle(article, async () => new Response(`<!doctype html><html><body>
    <nav>Home Download Sign in</nav><div role="dialog">Save your edits? Sign in to continue.</div>
    <article><h1>A compiler release</h1><div class="advertisement">Advertisement. Subscribe to everything.</div>
    <p>Version 3.6 adds dynamic packages for the compiler and its development environment. Plugins can now be installed without rebuilding the entire application.</p>
    <p>Limitations: packages must use the same compiler version and cannot share a name with a contained unit.</p>
    </article><footer>Contact Advertising</footer></body></html>`, { headers: { "content-type": "text/html" } }));
  assert.equal(result.investigation.status, "complete");
  assert.doesNotMatch(result.content, /Sign in|Save your edits|Advertisement|Subscribe|Advertising/);
  assert.match(result.rawSummary, /Version 3\.6 adds dynamic packages/);
  assert.match(result.content, /Limitations: packages must use the same compiler version/);
  assert.equal(result.investigation.method, "readability");
  assert.ok(result.fetchedAt);
});

test("GitHub project investigation reads the README instead of the file-list shell", async () => {
  const calls = [];
  const result = await investigateArticle({ id: "project", url: "https://github.com/example/project", sourceLinks: [] }, async (url) => {
    calls.push(url);
    assert.equal(url, "https://api.github.com/repos/example/project/readme");
    return new Response("# Project\n\nA documented tool that connects a messaging service to a local developer workflow.\n\n## Limitations\nThe account owner must authorize each integration before it can be used.", { headers: { "content-type": "text/plain" } });
  });
  assert.equal(calls.length, 1);
  assert.equal(result.investigation.method, "github-readme");
  assert.match(result.content, /account owner must authorize/);
  assert.doesNotMatch(result.content, /Branches|Go to file/);
});

test("paper investigation extracts the abstract without author-list and navigation clutter", async () => {
  const result = await investigateArticle({ id: "paper", url: "https://arxiv.org/abs/2610.18861", sourceLinks: [] }, async () => new Response(`
    <html><body><nav>Computer Science Login Help</nav><h1>Title: An agent study</h1><div>Authors: A, B, C</div>
    <blockquote class="abstract"><span class="descriptor">Abstract:</span>We study an agent that performs batched operations using a learned representation. Results are reported on a synthetic benchmark; no production deployment has been evaluated.</blockquote>
    <footer>References Login</footer></body></html>`, { headers: { "content-type": "text/html" } }));
  assert.equal(result.investigation.method, "arxiv-abstract");
  assert.match(result.content, /no production deployment has been evaluated/);
  assert.doesNotMatch(result.content, /Authors:|Login|Abstract:/);
});

test("unavailable originals may use an explicitly attributed feed summary, never HN discussion as source facts", async () => {
  const summary = "The official release introduces a stable API for batched operations. The maintainers document a version requirement that existing users must check before migrating.";
  const article = { id: "feed", url: "https://example.com/release", rawSummary: summary, material: { kind: "feed-summary", text: summary, url: "https://example.com/feed.xml" }, sourceLinks: [] };
  const result = await investigateArticle(article, async () => new Response("unavailable", { status: 503 }));
  assert.equal(result.investigation.status, "fallback");
  assert.equal(result.investigation.method, "feed-summary");
  assert.equal(result.investigation.sourceUrl, "https://example.com/feed.xml");
  assert.equal(result.content, summary);
  const hn = await investigateArticle({ ...article, material: undefined }, async () => { throw new Error("network blocked"); });
  assert.equal(hn.investigation.status, "unavailable");
  assert.equal(hn.content, undefined);
});

test("source redirects cannot bypass the local-network URL restriction", async () => {
  let calls = 0;
  const result = await investigateArticle({ id: "redirect", url: "https://example.com/redirect", sourceLinks: [] }, async () => {
    calls += 1;
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
  });
  assert.equal(calls, 1);
  assert.equal(result.investigation.reason, "unsafe-redirect");
  assert.equal(result.content, undefined);
});
