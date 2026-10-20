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
  const policyMode = ["ai-builder", "wrong-language", "untranslated-title", "mixed-language", "missing-caveat", "oversized"].includes(mode);
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
    recipe: { id: "ai-builder", name: "AI Builder", sources: ["launches"], maxStories: 8,
      ...(policyMode ? { editorialPolicy: { version: "ai-builder-v1", language: "zh-CN", audience: "AI 应用开发者", maxPerSource: 3, maxPerTopic: 3, maxCharacters: 2200, readingMinutes: 5 } } : {}) },
    sources: [{ id: "launches", name: "Official launches", type: "rss", adapter: "rss", feedUrl: "https://example.com/feed.xml", ...(policyMode ? { role: "primary", kind: "release" } : {}) }]
  }));
  // Drive the actual CLI with deterministic external HTTP responses, not mocked pipeline internals.
  const preload = join(directory, "http-fixture.mjs");
  await writeFile(preload, `
    let calls = 0;
    globalThis.fetch = async (url, options = {}) => {
      if (String(url) === 'https://example.com/feed.xml') return new Response('<rss><channel><item><title>A useful developer release</title><link>https://example.com/launch</link><pubDate>Mon, 19 Oct 2026 08:00:00 GMT</pubDate><description>' + (${JSON.stringify(mode)} === 'feed-fallback' ? 'The official release introduces a stable API for batched operations. The maintainers document a version requirement that existing users must check before migrating.' : 'A documented developer release with clear limitations.') + '</description></item></channel></rss>');
      if (String(url) === 'https://example.com/launch' && ${JSON.stringify(mode)} === 'feed-fallback') return new Response('unavailable', {status:503});
      if (String(url) === 'https://example.com/launch') return new Response(${JSON.stringify(mode)} === 'no-material' ? '<html><body><form>Sign in to continue reading. Save your edits before closing the window. Download the application to sign in and subscribe.</form></body></html>' : '<html><body><main><div class="advertisement">Advertisement. Subscribe to everything.</div><div role="dialog">Save your edits? Sign in to continue.</div><p>The maintainers released a documented SDK with compatibility notes and a stable public API. The new API supports batched operations; existing users must check their deployed version before migrating.</p></main></body></html>', {headers:{'content-type':'text/html'}});
      if (String(url) === 'https://api.openai.com/v1/responses') {
        calls++;
        if (${JSON.stringify(mode)} === 'http-failure') return new Response('secret echo must never be logged', {status:503});
        const request = JSON.parse(options.body);
        const selection = request.input.includes('articleIds');
        if (!selection) await (await import('node:fs/promises')).writeFile('editorial-input.json', request.input);
        const articleId = 'launches-https-example-com-launch';
        const data = selection ? {articleIds:[articleId],topics:{[articleId]:'SDK'}} : {
          editionTitle:'A documented SDK arrives', editorNote:'A small release with specific migration implications.',
          stories:[{articleId,headline:'A documented SDK arrives',summary:'The SDK adds a stable API for batched operations. Existing users should check compatibility before migrating.',whyItMatters:'Teams can evaluate the new API against their deployed SDK version.',category:'Technology'}]
        };
        if (!selection && ${JSON.stringify(policyMode)}) {
          data.stories[0].caveat = 'Independent evaluation is not supplied.';
          if (${JSON.stringify(mode)} !== 'wrong-language') {
            data.editionTitle = '批量接口进入稳定版本';
            data.editorNote = '本期关注一个已经开放的开发接口，以及迁移前需要核对的兼容条件。';
            Object.assign(data.stories[0], {headline:'SDK 开放稳定批量接口',summary:'维护者发布了带兼容说明的稳定开发接口，支持批量操作。已有应用在迁移前应先核对当前部署的 SDK 版本，再评估是否采用新接口。',whyItMatters:'团队可以开始验证新接口与现有部署的兼容性。',caveat:'现有材料没有提供独立性能评测。'});
          }
          if (${JSON.stringify(mode)} === 'missing-caveat') delete data.stories[0].caveat;
          if (${JSON.stringify(mode)} === 'untranslated-title') data.stories[0].headline = 'A stable SDK now supports batching';
          if (${JSON.stringify(mode)} === 'mixed-language') data.stories[0].summary = 'The maintainers released a stable SDK supporting batched operations. Existing applications need to inspect their deployed version before migrating. 中文';
          if (${JSON.stringify(mode)} === 'oversized') data.stories[0].summary = '这是过长的实现说明，不能作为五分钟日报。'.repeat(200);
        }
        if (!selection) {
          const feedOnly = ${JSON.stringify(mode)} === 'feed-fallback';
          data.stories[0].evidence = [{id:'e1',quote:feedOnly ? 'The official release introduces a stable API for batched operations.' : 'The new API supports batched operations; existing users must check their deployed version before migrating.'}];
          data.stories[0].attribution = {
            headline:{kind:'vendor-claim',evidenceIds:['e1']},
            summary:{kind:'vendor-claim',evidenceIds:['e1']},
            whyItMatters:{kind:'editorial-judgment',evidenceIds:[]},
            ...(data.stories[0].caveat ? {caveat:{kind:'unknown',evidenceIds:[]}} : {})
          };
          if (${JSON.stringify(mode)} === 'fabricated-quote') data.stories[0].evidence[0].quote = 'The SDK doubles throughput in every deployed production application.';
          if (${JSON.stringify(mode)} === 'missing-evidence-id') data.stories[0].attribution.summary.evidenceIds = ['e9'];
        }
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
  assert.equal(issue.evidenceVersion, 1);
  assert.equal(issue.stories[0].evidence[0].url, "https://example.com/launch");
  assert.ok(issue.stories[0].evidence[0].location.start >= 0);
  assert.equal(issue.stories[0].attribution.summary.kind, "vendor-claim");
  assert.equal(issue.stories[0].sourceMaterial.publishedAt, "2026-10-19T08:00:00.000Z");
  assert.ok(issue.stories[0].sourceMaterial.fetchedAt);
  assert.match(await readFile(join(directory, "public", "editions", issue.id, "index.html"), "utf8"), /A documented SDK arrives/);
  const editorialInput = await readFile(join(directory, "editorial-input.json"), "utf8");
  assert.doesNotMatch(editorialInput, /Advertisement|Save your edits|Subscribe to everything/);
  assert.match(editorialInput, /existing users must check their deployed version/);
  const reports = await readdir(join(directory, "runs"));
  assert.equal(reports.length, 1);
  const report = JSON.parse(await readFile(join(directory, "runs", reports[0])));
  assert.equal(report.outcome, "published");
  assert.equal(report.sources[0].status, "success");
  assert.equal(report.materials[0].publishedAt, "2026-10-19T08:00:00.000Z");
  assert.ok(report.materials[0].fetchedAt);
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

test("unusable source material never reaches the AI editor or becomes a publication", async (t) => {
  const { directory, args, environment } = await newsroom(t, "no-material");
  const env = { ...environment, OPENAI_API_KEY: "fixture-key-not-a-real-secret", OPENAI_MODEL: "fixture-model" };
  await assert.rejects(run(process.execPath, args, { cwd: directory, env }), (error) => error.code === 2);
  assert.deepEqual(await readdir(join(directory, "issues")), ["2026-10-18-ai-builder.json"]);
  await assert.rejects(readFile(join(directory, "editorial-input.json")), { code: "ENOENT" });
  const files = await readdir(join(directory, "runs"));
  const report = JSON.parse(await readFile(join(directory, "runs", files[0])));
  assert.equal(report.usable, 0);
});

test("feed-only fallback provenance survives extraction, AI input, publication, and reader rendering", async (t) => {
  const { directory, args, environment } = await newsroom(t, "feed-fallback");
  const env = { ...environment, OPENAI_API_KEY: "fixture-key-not-a-real-secret", OPENAI_MODEL: "fixture-model" };
  await run(process.execPath, args, { cwd: directory, env });
  const issue = JSON.parse(await readFile(join(directory, "issues", "2026-10-19-ai-builder.json")));
  assert.equal(issue.stories[0].sourceMaterial.status, "fallback");
  assert.equal(issue.stories[0].sourceMaterial.method, "feed-summary");
  assert.equal(issue.stories[0].sourceMaterial.url, "https://example.com/feed.xml");
  assert.ok(issue.stories[0].sourceMaterial.fetchedAt);
  const input = await readFile(join(directory, "editorial-input.json"), "utf8");
  assert.match(input, /"status":"fallback"/);
  assert.match(input, /https:\/\/example.com\/feed.xml/);
  const html = await readFile(join(directory, "public", "editions", issue.id, "index.html"), "utf8");
  assert.match(html, /Based on a feed summary · Original article unavailable/);
});

test("the Chinese AI Builder edition may publish one useful story with its source and explicit caveat", async (t) => {
  const { directory, args, environment } = await newsroom(t, "ai-builder");
  await run(process.execPath, args, { cwd: directory, env: { ...environment, OPENAI_API_KEY: "fixture-key", OPENAI_MODEL: "fixture-model" } });
  const issue = JSON.parse(await readFile(join(directory, "issues", "2026-10-19-ai-builder.json")));
  assert.equal(issue.language, "zh-CN");
  assert.equal(issue.policyVersion, "ai-builder-v1");
  assert.equal(issue.stories.length, 1);
  assert.equal(issue.stories[0].kind, "release");
  assert.match(issue.stories[0].caveat, /没有提供独立性能评测/);
  const html = await readFile(join(directory, "public", "editions", issue.id, "index.html"), "utf8");
  assert.match(html, /lang="zh-CN"/);
  assert.match(html, /限制与未知/);
  assert.match(html, /SDK 开放稳定批量接口/);
});

test("wrong-language, missing-caveat and over-budget AI output remain drafts", async (t) => {
  for (const mode of ["wrong-language", "untranslated-title", "mixed-language", "missing-caveat", "oversized"]) {
    const { directory, args, environment } = await newsroom(t, mode);
    await assert.rejects(run(process.execPath, args, { cwd: directory, env: { ...environment, OPENAI_API_KEY: "fixture-key", OPENAI_MODEL: "fixture-model" } }), (error) => error.code === 2);
    assert.deepEqual(await readdir(join(directory, "issues")), ["2026-10-18-ai-builder.json"]);
    const draft = JSON.parse(await readFile(join(directory, "drafts", "2026-10-19-ai-builder.json")));
    assert.equal(draft.editorial.reason, "editorial-policy-not-met");
  }
});


test("fabricated excerpts and nonexistent evidence IDs block publication through the real CLI", async (t) => {
  for (const mode of ["fabricated-quote", "missing-evidence-id"]) {
    const { directory, args, environment } = await newsroom(t, mode);
    await assert.rejects(run(process.execPath, args, { cwd: directory, env: { ...environment, OPENAI_API_KEY: "fixture-key", OPENAI_MODEL: "fixture-model" } }), (error) => error.code === 2);
    assert.deepEqual(await readdir(join(directory, "issues")), ["2026-10-18-ai-builder.json"]);
    const draft = JSON.parse(await readFile(join(directory, "drafts", "2026-10-19-ai-builder.json")));
    assert.equal(draft.editorial.reason, "invalid-evidence");
  }
});
