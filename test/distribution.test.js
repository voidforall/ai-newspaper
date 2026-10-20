import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
import { renderFeed, shareMetadata, renderMetadata, siteConfig } from "../src/distribution.js";
import { renderShareImage } from "../src/share-image.js";

const demo = JSON.parse(await readFile(new URL("../samples/demo-issue.json", import.meta.url), "utf8"));
const site = siteConfig({ SITE_URL: "https://example.com/ai-newspaper" });
function issue(date, extra = {}) { return { ...structuredClone(demo), id: `${date}-ai-builder`, date, status: "published", publishedAt: `${date}T08:12:00Z`, recipe: { id: "ai-builder" }, ...extra }; }

test("RSS is valid escaped XML containing only published main snapshots with stable GUIDs and actual publication times", () => {
  const published = issue("2026-10-19", { editionTitle: '接口 & 模型 <版本> "发布"', editorNote: "资料 A & B，含 <标签> 与控制符\u0000。" });
  const xml = renderFeed([published, issue("2026-10-20", { status: "draft" }), issue("2026-10-20", { editorial: { method: "fallback", status: "complete" } }), issue("2026-10-20", { recipe: { id: "other" } })], site);
  const document = new JSDOM(xml, { contentType: "text/xml" }).window.document;
  assert.equal(document.querySelectorAll("item").length, 1);
  assert.equal(document.querySelector("item title").textContent, published.editionTitle);
  assert.equal(document.querySelector("item guid").textContent, "https://example.com/ai-newspaper/editions/2026-10-19-ai-builder/");
  assert.equal(document.querySelector("item pubDate").textContent, "Mon, 19 Oct 2026 08:12:00 GMT");
  assert.equal(xml, renderFeed([published], site));
  assert.doesNotMatch(renderFeed([], site), /<item>/);
  assert.throws(() => renderFeed([issue("2026-10-19", { publishedAt: undefined })], site), /actual publication time/);
});

test("metadata uses the same snapshot, absolute repository URLs and an honest demo/legacy description", () => {
  const snapshot = issue("2026-10-19");
  const story = snapshot.stories[0];
  const metadata = shareMetadata(snapshot, site, { path: "stories/2026-10-19-ai-builder/story-123/", story });
  assert.equal(metadata.description, story.summary);
  assert.equal(metadata.url, "https://example.com/ai-newspaper/stories/2026-10-19-ai-builder/story-123/");
  assert.equal(metadata.image, `${metadata.url}cover.png`);
  const document = new JSDOM(`<head>${renderMetadata(metadata)}</head>`).window.document;
  assert.equal(document.querySelector('meta[property="og:title"]').content, metadata.title);
  assert.equal(document.querySelector('meta[property="og:description"]').content, story.summary);
  assert.equal(document.querySelector('meta[property="og:image:type"]').content, "image/png");
  assert.match(shareMetadata(demo, site, { path: "demo/", demo: true }).description, /非当日新闻或正式主刊/);
  delete snapshot.schemaVersion;
  assert.doesNotMatch(shareMetadata(snapshot, site, { path: "editions/old/", story }).description, new RegExp(story.summary));
  assert.match(shareMetadata(snapshot, site, { path: "editions/old/" }).description, /编辑审阅未记录/);
});

test("share images are deterministic 1200×630 PNGs without platform fonts or network requests", () => {
  const args = { title: "开发者可核对原文的模型发布与兼容性说明", date: "2026-10-19", url: site.url };
  const first = renderShareImage(args);
  assert.deepEqual(first, renderShareImage(args));
  assert.equal(first.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(first.readUInt32BE(16), 1200);
  assert.equal(first.readUInt32BE(20), 630);
});

test("deployment URL normalization rejects ambiguous or unsafe canonical bases", () => {
  assert.equal(site.url, "https://example.com/ai-newspaper/");
  for (const value of ["/relative/", "ftp://example.com/", "https://example.com/?secret=1", "https://user:pass@example.com/", "https://example.com/#fragment"]) assert.throws(() => siteConfig({ SITE_URL: value }));
});

test("an HTTP metadata crawler can fetch feed, canonical story and cover below the repository prefix", async (t) => {
  const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createServer } = await import("node:http");
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { fileURLToPath } = await import("node:url");
  const { storyIdFor } = await import("../src/render-issue.js");
  const directory = await mkdtemp(join(tmpdir(), "ai-newspaper-distribution-"));
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url, "http://localhost").pathname;
      if (!path.startsWith("/ai-newspaper/")) { response.writeHead(404).end(); return; }
      const relative = path.slice("/ai-newspaper/".length);
      const body = await readFile(join(directory, "public", relative, path.endsWith("/") ? "index.html" : ""));
      response.setHeader("Content-Type", path.endsWith(".png") ? "image/png" : path.endsWith(".xml") ? "application/rss+xml" : "text/html; charset=utf-8");
      response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}/ai-newspaper/`;
  await mkdir(join(directory, "issues"));
  const snapshot = issue("2026-10-19");
  await writeFile(join(directory, "issues", `${snapshot.id}.json`), JSON.stringify(snapshot));
  await writeFile(join(directory, "issues", "2026-10-20-private.json"), JSON.stringify(issue("2026-10-20", { status: "draft", editionTitle: "PRIVATE-DRAFT" })));
  const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  await promisify(execFile)(process.execPath, [cli, "build"], { cwd: directory, env: { ...process.env, SITE_URL: base } });
  const feed = await (await fetch(`${base}feed.xml`)).text();
  const xml = new JSDOM(feed, { contentType: "text/xml" }).window.document;
  assert.equal(xml.querySelectorAll("item").length, 1);
  assert.doesNotMatch(feed, /PRIVATE-DRAFT/);
  const editionUrl = xml.querySelector("item link").textContent;
  const paths = [base, editionUrl, `${base}stories/${snapshot.id}/${storyIdFor(snapshot.stories[0])}/`, `${base}demo/`];
  for (const url of paths) {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const document = new JSDOM(await response.text(), { url }).window.document;
    assert.equal(document.querySelector('link[rel="canonical"]').href, url);
    assert.equal(document.querySelector('link[type="application/rss+xml"]').href, `${base}feed.xml`);
    const image = await fetch(document.querySelector('meta[property="og:image"]').content);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/png");
    assert.equal(Buffer.from(await image.arrayBuffer()).readUInt32BE(16), 1200);
    if (url === editionUrl) assert.equal(document.querySelector('meta[property="og:description"]').content, xml.querySelector("item description").textContent);
  }
});
