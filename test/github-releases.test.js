import test from "node:test";
import assert from "node:assert/strict";
import { fetchGitHubReleases } from "../src/github-releases.js";

test("normalizes public GitHub releases with source attribution", async () => {
  const articles = await fetchGitHubReleases({
    source: { id: "example-releases", name: "Example releases", repository: "example/project" },
    limit: 1,
    fetchImpl: async () => new Response(JSON.stringify([{
      id: 42,
      tag_name: "v1.2.0",
      name: "Version 1.2",
      body: "A useful release with a detailed changelog.",
      html_url: "https://github.com/example/project/releases/tag/v1.2.0",
      published_at: "2026-07-19T08:00:00Z",
      prerelease: false,
      draft: false
    }]))
  });

  assert.deepEqual(articles, [{
    id: "github-release-42",
    sourceId: "example-releases",
    title: "Version 1.2",
    url: "https://github.com/example/project/releases/tag/v1.2.0",
    publishedAt: "2026-07-19T08:00:00.000Z",
    rawSummary: "A useful release with a detailed changelog.",
    score: 1,
    sourceLinks: [
      { name: "Example releases", url: "https://github.com/example/project/releases" },
      { name: "Original source", url: "https://github.com/example/project/releases/tag/v1.2.0" }
    ]
  }]);
});

test("paginates GitHub releases when collecting a historical date", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const page = new URL(url).searchParams.get("page");
    const releases = page === "2" ? [
      { id: 40, tag_name: "v1.0", html_url: "https://github.com/example/project/releases/tag/v1.0", published_at: "2026-07-19T08:00:00Z", draft: false, prerelease: false },
      { id: 39, tag_name: "v0.9", html_url: "https://github.com/example/project/releases/tag/v0.9", published_at: "2026-07-18T08:00:00Z", draft: false, prerelease: false }
    ] : [
      { id: 41, tag_name: "v1.1", html_url: "https://github.com/example/project/releases/tag/v1.1", published_at: "2026-07-20T08:00:00Z", draft: false, prerelease: false }
    ];
    return new Response(JSON.stringify(releases));
  };

  const articles = await fetchGitHubReleases({
    source: { id: "example-releases", name: "Example releases", repository: "example/project" },
    date: "2026-07-19",
    fetchImpl
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(articles.map((article) => article.id), ["github-release-40"]);
});
