import { publishedMainIssues, shareMetadata } from "./distribution.js";
import { renderIssue, storyIdFor } from "./render-issue.js";

export function latestMainIssue(issues) {
  return publishedMainIssues(issues)[0];
}

export function renderHome(issues, demo, { today = new Date().toISOString().slice(0, 10), site } = {}) {
  const latest = latestMainIssue(issues);
  const issue = latest ?? demo;
  const metadata = site ? shareMetadata(issue, site, { path: "./", demo: !latest }) : undefined;
  if (metadata) metadata.image = shareMetadata(issue, site, { path: latest ? `editions/${issue.id}/` : "demo/", demo: !latest }).image;
  return renderIssue(issue, {
    metadata,
    readingContext: { home: true, demo: !latest, today, homeHref: "./", archiveHref: "archive/", builderHref: "builder/", editionHref: latest ? `editions/${latest.id}/` : "demo/" },
    storyLink: (story) => latest ? `stories/${latest.id}/${storyIdFor(story)}/` : `demo/#${storyIdFor(story)}`
  });
}
