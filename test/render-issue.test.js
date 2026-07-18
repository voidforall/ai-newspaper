import test from "node:test";
import assert from "node:assert/strict";
import { renderIssue } from "../src/render-issue.js";

test("renders a daily issue with editorial context and attributable stories", () => {
  const html = renderIssue({
    date: "2026-07-18",
    editionTitle: "The Daily Signal",
    editorNote: "AI infrastructure dominated today's discussion.",
    stories: [
      {
        headline: "A useful launch",
        summary: "A concise account of the launch.",
        category: "Technology",
        importance: 9,
        whyItMatters: "It changes how teams ship software.",
        sourceLinks: [{ name: "Hacker News", url: "https://news.ycombinator.com/item?id=1" }]
      },
      {
        headline: "A second story",
        summary: "A second concise account.",
        category: "Ideas",
        importance: 7,
        whyItMatters: "It frames a wider conversation.",
        sourceLinks: [
          { name: "Hacker News", url: "https://news.ycombinator.com/item?id=2" },
          { name: "Unsafe source", url: "javascript:alert(1)" }
        ]
      }
    ]
  });

  assert.match(html, /class="masthead"/);
  assert.match(html, /THE DAILY SIGNAL/);
  assert.match(html, /class="lead-story"/);
  assert.match(html, /TODAY&#039;S EDITION/);
  assert.match(html, /class="newspaper-grid"/);
  assert.match(html, /The Daily Signal/);
  assert.match(html, /AI infrastructure dominated today&#039;s discussion\./);
  assert.match(html, /A useful launch/);
  assert.match(html, /It changes how teams ship software\./);
  assert.match(html, /https:\/\/news\.ycombinator\.com\/item\?id=1/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, />Unsafe source<\/span>/);
  assert.doesNotMatch(html, /Vol\. 01/);
});

test("renders the classic template with a paper texture and traditional columns", () => {
  const html = renderIssue({
    date: "2026-07-18",
    editionTitle: "The Daily Signal",
    editorNote: "A printed edition.",
    stories: [{
      headline: "A classic headline",
      summary: "A story set in a paper-like layout.",
      category: "Ideas",
      importance: 1,
      whyItMatters: "It offers a print-oriented presentation.",
      sourceLinks: []
    }]
  }, { template: "classic" });

  assert.match(html, /class="newspaper template-classic"/);
  assert.match(html, /repeating-linear-gradient/);
  assert.match(html, /column-count: 3/);
  assert.doesNotMatch(html, /template-classic \.front-page \{ column-count:/);
  assert.doesNotMatch(html, /template-classic \.lead-story \{ display: block;/);
  assert.doesNotMatch(html, /template-classic \.news-section \{ break-inside: avoid;/);
});
