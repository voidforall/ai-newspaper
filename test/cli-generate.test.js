import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.js");

async function newsroom(t, mode = "completed") {
  const directory = await mkdtemp(join(tmpdir(), "ai-newspaper-generation-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "issues"));
  const oldIssue = {
    id: "2026-10-18-ai-builder", date: "2026-10-18", editionTitle: "Last published edition",
    recipe: { id: "ai-builder", name: "AI Builder" }, editorNote: "The last known published paper.",
    stories: [{ articleIds: ["old-story"], headline: "Existing published story",
      summary: "The original published summary stays intact when a subsequent run fails.",
      category: "Technology", whyItMatters: "This is the existing publication.",
      sourceLinks: [{ name: "Original source", url: "https://example.com/old" }] }]
  };
  await writeFile(join(directory, "issues", `${oldIssue.id}.json`), JSON.stringify(oldIssue));
  await writeFile(join(directory, "recipe.json"), JSON.stringify({
    recipe: { id: "ai-builder", name: "AI Builder", sources: ["launches"], maxStories: 8 },
    sources: [{ id: "launches", name: "Official launches", type: "rss", adapter: "rss", feedUrl: "https://example.com/feed.xml" }]
  }));
  // Drive the actual CLI with deterministic external HTTP responses, not mocked pipeline internals.
  const preload = join(directory, "http-fixture.mjs");
  await writeFile(preload, `
    let calls = 0;
    globalThis.fetch = async (url, options = {}) => {
      if (String(url) === 'https://example.com/feed.xml') return new Response('<rss><channel><item><title>A useful developer release</title><link>https://example.com/launch</link><pubDate>Mon, 19 Oct 2026 08:00:00 GMT</pubDate><description>A documented developer release with clear limitations.</description></item></channel></rss>');
      if (String(url) === 'https://example.com/launch') return new Response('<html><body><main><p>The maintainers released a documented SDK with compatibility notes and a stable public API. The new API supports batched operations; existing users must check their deployed version before migrating.</p></main></body></html>', {headers:{'content-type':'text/html'}});
      if (String(url) === 'https://api.openai.com/v1/responses') {
        calls++;
        if (${JSON.stringify(mode)} === 'http-failure') return new Response('secret echo must never be logged', {status:503});
        const request = JSON.parse(options.body);
        const selection = request.input.includes('articleIds');
        const articleId = 'launches-https-example-com-launch';
        const data = selection ? {articleIds:[articleId]} : {
          editionTitle:'A documented SDK arrives', editorNote:'A small release with specific migration implications.',
          stories:[{articleId,headline:'A documented SDK arrives',summary:'The SDK adds a stable API for batched operations. Existing users should check compatibility before migrating.',whyItMatters:'Teams can evaluate the new API against their deployed SDK version.',category:'Technology'}]
        };
        if (${JSON.stringify(mode)} === 'invalid-edit' && !selection) data.stories.push({...data.stories[0]});
        return new Response(JSON.stringify({status:'completed',model:'fixture-model',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}],usage:{input_tokens:120,output_tokens:80,total_tokens:200}}));
      }
      throw new Error('Unexpected external request');
    };
  `);
  const args = ["--import", preload, cli, "generate", "--recipe-file=recipe.json", "--date=2026-10-19"];
  const environment = { ...process.env, OPENAI_API_KEY: "", OPENAI_MODEL: "" };
  await run(process.execPath, [cli, "build"], { cwd: directory, env: environment });
  return { directory, args, environment };
}

test("a missing-key generation stays a draft and preserves the published website", async (t) => {
  const { directory, args, environment } = await newsroom(t);
  const before = await readFile(join(directory, "public", "index.html"), "utf8");
  await assert.rejects(run(process.execPath, args, { cwd: directory, env: environment }), (error) => error.code === 2);
  assert.deepEqual(await readdir(join(directory, "issues")), ["2026-10-18-ai-builder.json"]);
  const draft = JSON.parse(await readFile(join(directory, "drafts", "2026-10-19-ai-builder.json")));
  assert.equal(draft.schemaVersion, 1);
  assert.equal(draft.status, "draft");
  assert.equal(draft.editorial.status, "unavailable");
  assert.equal(await readFile(join(directory, "public", "index.html"), "utf8"), before);
  await run(process.execPath, [cli, "build"], { cwd: directory, env: environment });
  assert.doesNotMatch(await readFile(join(directory, "public", "index.html"), "utf8"), /2026-10-19/);
});

test("completed AI editing publishes once, records usage, and cannot overwrite its edition on retry", async (t) => {
  const { directory, args, environment } = await newsroom(t);
  const env = { ...environment, OPENAI_API_KEY: "fixture-key-not-a-real-secret", OPENAI_MODEL: "fixture-model" };
  await run(process.execPath, args, { cwd: directory, env });
  const path = join(directory, "issues", "2026-10-19-ai-builder.json");
  const original = await readFile(path, "utf8");
  const issue = JSON.parse(original);
  assert.equal(issue.schemaVersion, 1);
  assert.equal(issue.status, "published");
  assert.equal(issue.editorial.method, "ai");
  assert.equal(issue.editorial.status, "complete");
  assert.equal(issue.editorial.model, "fixture-model");
  assert.match(await readFile(join(directory, "public", "editions", issue.id, "index.html"), "utf8"), /A documented SDK arrives/);
  const reports = await readdir(join(directory, "runs"));
  assert.equal(reports.length, 1);
  const report = JSON.parse(await readFile(join(directory, "runs", reports[0])));
  assert.equal(report.outcome, "published");
  assert.equal(report.sources[0].status, "success");
  assert.equal(report.modelCalls.length, 2);
  assert.equal(report.modelCalls[1].usage.total_tokens, 200);
  assert.doesNotMatch(JSON.stringify(report), /fixture-key-not-a-real-secret/);
  await assert.rejects(run(process.execPath, args, { cwd: directory, env }), (error) => error.code === 2);
  assert.equal(await readFile(path, "utf8"), original);
});

test("invalid duplicate AI edits and unavailable providers cannot publish fallback text", async (t) => {
  for (const mode of ["invalid-edit", "http-failure"]) {
    const { directory, args, environment } = await newsroom(t, mode);
    const env = { ...environment, OPENAI_API_KEY: "fixture-key-not-a-real-secret", OPENAI_MODEL: "fixture-model" };
    await assert.rejects(run(process.execPath, args, { cwd: directory, env }), (error) => {
      assert.doesNotMatch(error.stderr, /secret echo|fixture-key-not-a-real-secret/);
      return error.code === 2;
    });
    assert.deepEqual(await readdir(join(directory, "issues")), ["2026-10-18-ai-builder.json"]);
    const draft = JSON.parse(await readFile(join(directory, "drafts", "2026-10-19-ai-builder.json")));
    assert.equal(draft.status, "draft");
    assert.equal(draft.editorial.status, "failed");
  }
});

test("a rendering failure leaves the last complete site and published data unchanged", async (t) => {
  const { directory, args, environment } = await newsroom(t);
  const env = { ...environment, OPENAI_API_KEY: "fixture-key-not-a-real-secret", OPENAI_MODEL: "fixture-model" };
  const before = await readFile(join(directory, "public", "index.html"), "utf8");
  await assert.rejects(run(process.execPath, [...args, "--template=unknown"], { cwd: directory, env }), /Unknown render template/);
  assert.deepEqual(await readdir(join(directory, "issues")), ["2026-10-18-ai-builder.json"]);
  assert.equal(await readFile(join(directory, "public", "index.html"), "utf8"), before);
  assert.equal((await readdir(directory)).some((name) => name.startsWith(".public-")), false);
  const draft = JSON.parse(await readFile(join(directory, "drafts", "2026-10-19-ai-builder.json")));
  assert.equal(draft.status, "draft");
});
