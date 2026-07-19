const categories = new Set(["Technology", "Business", "Ideas"]);
const minimumSummaryLength = 40;
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

export function validateIssue(issue) {
  const errors = [];
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

export function assertValidIssue(issue) {
  const errors = validateIssue(issue);
  if (errors.length) throw new Error(`Issue validation failed:\n- ${errors.join("\n- ")}`);
}
