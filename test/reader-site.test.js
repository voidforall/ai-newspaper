import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { JSDOM } from "jsdom";
import { storyIdFor } from "../src/render-issue.js";
import { latestMainIssue, renderHome } from "../src/render-home.js";

const run = promisify(execFile);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const demo = JSON.parse(await readFile(join(root, "samples/demo-issue.json"), "utf8"));
const main = (date, status = "published") => ({ ...structuredClone(demo), id: `${date}-ai-builder`, date, status, recipe: { id: "ai-builder", name: "AI Builder 日报" }, editionTitle: `主刊 ${date}` });

test("homepage reads the latest published main edition and labels a missing day's update honestly", () => {
  const issues = [main("2026-10-18"), main("2026-10-19"), main("2026-10-20", "draft"), { ...main("2026-10-20"), recipe: { id: "another-desk" } }];
  assert.equal(latestMainIssue(issues).date, "2026-10-19");
  const html = renderHome(issues, demo, { today: "2026-10-20" });
  assert.match(html, /今日主刊尚未发布，以下为最近一期/);
  assert.match(html, /主刊 2026-10-19/);
  assert.doesNotMatch(html, /主刊 2026-10-20/);
  assert.match(html, /stories\/2026-10-19-ai-builder\/story-/);
  assert.match(renderHome([], demo), /主刊尚未正式发布/);
  assert.match(renderHome([], demo), /示例刊 · 人工审阅/);
});

test("story identity survives headline and order changes, with a URL identity for legacy archives", () => {
  const story = demo.stories[0];
  assert.equal(storyIdFor(story), storyIdFor({ ...story, headline: "A completely revised headline" }));
  const legacy = { sourceLinks: [{ name: "Original source", url: "https://example.com/article?version=2&utm_source=feed#top" }] };
  assert.equal(storyIdFor(legacy), storyIdFor({ sourceLinks: [{ name: "Original source", url: "https://example.com/article?version=2" }] }));
  assert.notEqual(storyIdFor(legacy), storyIdFor({ sourceLinks: [{ name: "Original source", url: "https://example.com/article?version=3" }] }));
});

test("the actual build emits standalone stories, archives, demo and builder with working repository-prefix links", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "ai-newspaper-reader-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "issues"));
  const issue = main("2026-10-19");
  await writeFile(join(directory, "issues", `${issue.id}.json`), JSON.stringify(issue));
  await run(process.execPath, [join(root, "src/cli.js"), "build"], { cwd: directory });
  const id = storyIdFor(issue.stories[0]);
  const files = ["index.html", "archive/index.html", "builder/index.html", "demo/index.html", `editions/${issue.id}/index.html`, `stories/${issue.id}/${id}/index.html`, "sources/ai-builder/index.html"];
  for (const file of files) {
    const html = await readFile(join(directory, "public", file), "utf8");
    const url = new URL(file.replace(/index.html$/, ""), "https://example.com/ai-newspaper/");
    const document = new JSDOM(html, { url }).window.document;
    for (const anchor of document.querySelectorAll('a[href]')) {
      const target = new URL(anchor.href);
      if (target.origin !== url.origin) continue;
      assert.ok(target.pathname.startsWith("/ai-newspaper/"), `${file}: escaped repository prefix`);
      const relative = target.pathname.slice("/ai-newspaper/".length);
      const page = await readFile(join(directory, "public", relative, "index.html"), "utf8");
      if (target.hash) assert.ok(new JSDOM(page).window.document.getElementById(target.hash.slice(1)), `${file}: missing story anchor`);
    }
  }
  const storyPage = await readFile(join(directory, "public", "stories", issue.id, id, "index.html"), "utf8");
  assert.match(storyPage, /https:\/\/github.com\/huggingface\/transformers\/releases\/tag\/v5.20.2/);
  assert.match(storyPage, /本期固定链接/);
  assert.doesNotMatch(storyPage, /class="deck"/);
});


test("legacy feed-only stories get distinct title/order-independent pages and skip unsafe original identities", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "ai-newspaper-legacy-links-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "issues"));
  const issue = main("2026-10-19");
  delete issue.evidenceVersion; delete issue.schemaVersion;
  issue.stories = ["First distinct source summary.", "Second distinct source summary."].map((summary, index) => ({headline:`Legacy ${index}`,summary,category:"Technology",whyItMatters:"Retained archive.",sourceLinks:[{name:"Original source",url:"ftp://example.com/article"},{name:"News feed",url:"https://example.com/feed"}]}));
  const path = join(directory, "issues", `${issue.id}.json`);
  await writeFile(path, JSON.stringify(issue));
  await run(process.execPath, [join(root, "src/cli.js"), "build"], { cwd: directory });
  const ids = issue.stories.map(storyIdFor);
  assert.notEqual(ids[0], ids[1]);
  assert.equal(storyIdFor({...issue.stories[0],headline:"Changed title"}),ids[0]);
  for (const [index,id] of ids.entries()) assert.match(await readFile(join(directory,"public","stories",issue.id,id,"index.html"),"utf8"),new RegExp(`Legacy ${index}`));
  const before = await readFile(join(directory,"public","index.html"),"utf8");
  issue.stories[1].summary = issue.stories[0].summary;
  await writeFile(path, JSON.stringify(issue));
  await assert.rejects(run(process.execPath, [join(root, "src/cli.js"), "build"], { cwd: directory }), /ambiguous story identities/);
  assert.equal(await readFile(join(directory,"public","index.html"),"utf8"),before);
});
