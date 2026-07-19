import test from "node:test";
import assert from "node:assert/strict";
import { validateIssue } from "../src/validate-issue.js";

const validIssue = {
  date: "2026-07-19",
  source: "Hacker News",
  stories: [{
    headline: "A useful launch",
    summary: "This summary contains enough detail to meet the publication minimum.",
    category: "Technology",
    whyItMatters: "It changes how teams approach software delivery.",
    sourceLinks: [{ name: "Hacker News", url: "https://news.ycombinator.com/item?id=1" }]
  }]
};

test("accepts a complete attributable issue", () => {
  assert.deepEqual(validateIssue(validIssue), []);
});

test("reports incomplete stories and unsupported source links", () => {
  const errors = validateIssue({
    ...validIssue,
    date: "not-a-date",
    stories: [{
      headline: "",
      summary: "Too short.",
      category: "News",
      whyItMatters: "",
      sourceLinks: [{ name: "Untrusted", url: "javascript:alert(1)" }]
    }]
  });

  assert.deepEqual(errors, [
    "Issue date must be a valid YYYY-MM-DD value.",
    "Story 1 must have a headline.",
    "Story 1 summary must be at least 40 characters.",
    "Story 1 must use a supported category.",
    "Story 1 must explain why it matters.",
    "Story 1 must include an attributable source link."
  ]);
});

test("rejects dates that do not exist on the calendar", () => {
  const errors = validateIssue({ ...validIssue, date: "2026-02-30" });

  assert.deepEqual(errors, ["Issue date must be a valid YYYY-MM-DD value."]);
});

test("rejects stories that repeat an original source", () => {
  const errors = validateIssue({
    ...validIssue,
    stories: [
      { ...validIssue.stories[0], sourceLinks: [{ name: "Original source", url: "https://example.com/report" }] },
      { ...validIssue.stories[0], sourceLinks: [{ name: "Original source", url: "https://example.com/report" }] }
    ]
  });

  assert.deepEqual(errors, ["Story 2 repeats an original source URL."]);
});
