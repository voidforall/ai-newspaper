import { renderIssue, storyIdFor } from "./render-issue.js";

export function latestMainIssue(issues) {
  return issues.filter((issue) => issue.recipe?.id === "ai-builder" && issue.status === "published")
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0];
}

export function renderHome(issues, demo, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const latest = latestMainIssue(issues);
  const issue = latest ?? demo;
  return renderIssue(issue, {
    readingContext: { home: true, demo: !latest, today, homeHref: "./", archiveHref: "archive/", builderHref: "builder/", editionHref: latest ? `editions/${latest.id}/` : "demo/" },
    storyLink: (story) => latest ? `stories/${latest.id}/${storyIdFor(story)}/` : `demo/#${storyIdFor(story)}`
  });
}
