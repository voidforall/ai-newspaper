const categories = new Set(["Technology", "Business", "Ideas"]);
const originalSourceName = "Original source";

export function isValidIssueDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validSourceLink(link) {
  if (!isText(link?.name) || !isText(link?.url)) return false;
  try {
    return ["http:", "https:"].includes(new URL(link.url).protocol);
  } catch {
    return false;
  }
}

export function validateIssue(issue, { archive = false } = {}) {
  const errors = [];
  // Preserve already published, unversioned text when rebuilding the archive.
  // Generation and all versioned editions retain the publication minimum.
  const minimumSummaryLength = archive && issue?.schemaVersion === undefined ? 1 : 40;
  if (issue?.schemaVersion !== undefined && issue.schemaVersion !== 1) errors.push("Unsupported issue schema version.");
  if (issue?.schemaVersion === 1) {
    if (!["draft", "published"].includes(issue.status)) errors.push("Versioned issue must declare draft or published status.");
    if (!["ai", "manual", "fallback"].includes(issue.editorial?.method)) errors.push("Issue must declare its editorial method.");
    if (issue.status === "published" && (issue.editorial?.status !== "complete" || issue.editorial.method === "fallback")) {
      errors.push("Published issue requires completed AI or manual editing.");
    }
  }
  if (issue?.id !== undefined && (typeof issue.id !== "string" || !/^\d{4}-\d{2}-\d{2}(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(issue.id) || !issue.id.startsWith(issue.date))) {
    errors.push("Issue id must be its date with an optional safe edition slug.");
  }
  if (!isValidIssueDate(issue?.date)) errors.push("Issue date must be a valid YYYY-MM-DD value.");
  if (!Array.isArray(issue?.stories) || issue.stories.length === 0) {
    errors.push("Issue must contain at least one story.");
    return errors;
  }

  const originalUrls = new Set();
  issue.stories.forEach((story, index) => {
    const label = `Story ${index + 1}`;
    if (!isText(story?.headline)) errors.push(`${label} must have a headline.`);
    if (!isText(story?.summary) || story.summary.trim().length < minimumSummaryLength) {
      errors.push(`${label} summary must be at least ${minimumSummaryLength} characters.`);
    }
    if (!categories.has(story?.category)) errors.push(`${label} must use a supported category.`);
    if (!isText(story?.whyItMatters)) errors.push(`${label} must explain why it matters.`);
    if (!Array.isArray(story?.sourceLinks) || story.sourceLinks.length === 0 || !story.sourceLinks.some(validSourceLink)) {
      errors.push(`${label} must include an attributable source link.`);
    }

    for (const link of story?.sourceLinks ?? []) {
      if (link.name !== originalSourceName || !validSourceLink(link)) continue;
      if (originalUrls.has(link.url)) errors.push(`${label} repeats an original source URL.`);
      originalUrls.add(link.url);
    }
  });
  return errors;
}

export function assertValidIssue(issue, options) {
  const errors = validateIssue(issue, options);
  if (errors.length) throw new Error(`Issue validation failed:\n- ${errors.join("\n- ")}`);
}
