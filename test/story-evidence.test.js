import test from "node:test";
import assert from "node:assert/strict";
import { attachEvidence, evidenceErrors } from "../src/story-evidence.js";
import { renderIssue } from "../src/render-issue.js";
import { validateIssue } from "../src/validate-issue.js";

const quote = "The new API supports batched operations; existing users must check their deployed version before migrating.";
const material = { sourceText: `Release notes. ${quote}`, sourceMaterial: { url: "https://example.com/release", fetchedAt: "2026-10-20T09:00:00Z", method: "release-notes" } };
function edit() {
  return { headline: "SDK 支持批量操作", summary: "维护者发布了稳定开发接口，支持批量操作。已有应用迁移前需要核对部署版本，并根据现有集成评估兼容性。", whyItMatters: "可以开始验证批量接口与现有部署的兼容性。", caveat: "材料没有提供性能评测结果。", category: "Technology", sourceLinks: [{ name: "Original source", url: material.sourceMaterial.url }],
    evidence: [{ id: "e1", quote }], attribution: { headline: { kind: "vendor-claim", evidenceIds: ["e1"] }, summary: { kind: "vendor-claim", evidenceIds: ["e1"] }, whyItMatters: { kind: "editorial-judgment", evidenceIds: [] }, caveat: { kind: "unknown", evidenceIds: [] } } };
}
function issue(story) {
  return { schemaVersion: 1, evidenceVersion: 1, status: "published", editorial: { method: "manual", status: "complete" }, id: "2026-10-20", date: "2026-10-20", language: "zh-CN", editionTitle: "批量接口更新", editorNote: "关注实际兼容条件。", stories: [story] };
}

test("evidence stores only bounded excerpts with code-derived source, time and exact extracted-text offsets", () => {
  const story = { ...edit(), ...attachEvidence(edit(), material) };
  assert.equal(story.evidence[0].location.start, 15);
  assert.equal(material.sourceText.slice(story.evidence[0].location.start, story.evidence[0].location.end), quote);
  assert.deepEqual(validateIssue(issue(story)), []);
  assert.doesNotMatch(JSON.stringify(story), /Release notes/);
  const invalid = structuredClone(story);
  invalid.attribution.summary.evidenceIds = ["e9"];
  assert.match(validateIssue(issue(invalid)).join(" "), /references missing/);
});

test("non-verbatim, duplicate, oversized and unused excerpts are rejected", () => {
  for (const change of [
    (e) => e.evidence[0].quote = "The SDK is now guaranteed to double throughput.",
    (e) => e.evidence.push({ ...e.evidence[0] }),
    (e) => e.evidence.push({ id: "e2", quote }),
    (e) => e.attribution.summary = { kind: "source-statement", evidenceIds: [] },
    (e) => e.attribution.caveat = { kind: "unknown", evidenceIds: ["e1"] }
  ]) {
    const changed = edit(); change(changed);
    assert.throws(() => attachEvidence(changed, material));
  }
  const long = "x".repeat(241);
  const changed = edit(); changed.evidence[0].quote = long;
  assert.throws(() => attachEvidence(changed, { ...material, sourceText: long }));
});

test("reader uses native disclosure, clear attribution and escaped excerpts; legacy needs no evidence", () => {
  const story = { ...edit(), ...attachEvidence(edit(), material) };
  const html = renderIssue(issue(story));
  assert.match(html, /<details class="evidence"><summary>查看原文依据与编辑判断/);
  assert.match(html, /厂商／作者主张/);
  assert.match(html, /编辑判断/);
  assert.match(html, /不代表独立事实核验/);
  assert.match(html, /2026-10-20T09:00:00Z/);
  const malicious = { ...story, evidence: [{ ...story.evidence[0], quote: '<script>alert("source")</script>' }] };
  assert.doesNotMatch(renderIssue(issue(malicious)), /<script>alert/);
  const legacy = issue(edit()); delete legacy.evidenceVersion;
  assert.deepEqual(validateIssue(legacy), []);
  delete legacy.stories[0].evidence; delete legacy.stories[0].attribution;
  assert.doesNotMatch(renderIssue(legacy), /<details class="evidence">/);
  assert.ok(evidenceErrors(story).length === 0);
});


test("malformed story objects report validation errors instead of crashing the build validator", () => {
  for (const value of [null, undefined, 42]) {
    assert.ok(validateIssue(issue(value)).length > 0);
  }
});
