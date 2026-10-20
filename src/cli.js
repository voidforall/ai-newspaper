import { link, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { createIssue } from "./create-issue.js";
import { fetchConfiguredArticles } from "./source-adapters.js";
import { loadEditionRecipe } from "./edition-recipes.js";
import { editIssueWithAi, selectArticlesWithAi } from "./edit-issue.js";
import { hasEditorialMaterial, investigateArticles } from "./investigate-content.js";
import { renderIssue } from "./render-issue.js";
import { renderCollection, renderSourceTimeline, sourceFor } from "./render-collection.js";
import { assertValidIssue, isValidIssueDate, validateIssue } from "./validate-issue.js";

const outputDirectory = "public";
const issueDirectory = "issues";
const researchDirectory = "research";
const today = () => new Date().toISOString().slice(0, 10);

function argumentValue(name) {
  const argument = process.argv.slice(3).find((value) => value.startsWith(`--${name}=`));
  return argument?.slice(name.length + 3);
}

function templateArgument() {
  return argumentValue("template");
}

function issueDate() {
  const date = argumentValue("date") ?? today();
  if (!isValidIssueDate(date)) {
    throw new Error(`Invalid --date value: ${date}`);
  }
  return date;
}

function editionSlug(recipe) {
  const slug = argumentValue("edition") ?? recipe.id;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Edition slug must contain lowercase letters, numbers, and separating hyphens.");
  return slug;
}

function editionId(date, recipe) {
  return `${date}-${editionSlug(recipe)}`;
}

function sourceWindow() {
  const date = argumentValue("date");
  return date ? { date } : { since: new Date(Date.now() - 86_400_000).toISOString(), until: new Date().toISOString() };
}

async function writeEdition(issue, { navigation, output = outputDirectory } = {}) {
  const id = issue.id ?? issue.date;
  const htmlPath = join(output, "editions", id, "index.html");
  await mkdir(dirname(htmlPath), { recursive: true });
  const renderedIssue = renderIssue(issue, { template: templateArgument() ?? issue.template ?? "standard", navigation });
  await writeFile(htmlPath, renderedIssue);
}

async function readIssues() {
  try {
    const files = (await readdir(issueDirectory)).filter((file) => file.endsWith(".json"));
    return Promise.all(files.map(async (file) => {
      const issue = JSON.parse(await readFile(join(issueDirectory, file), "utf8"));
      return { ...issue, id: issue.id ?? file.slice(0, -5) };
    }));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeCollection(issues, output = outputDirectory) {
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "index.html"), renderCollection(issues));
  const groups = new Map();
  for (const issue of issues) {
    const source = sourceFor(issue);
    const group = groups.get(source.slug) ?? { source, issues: [] };
    group.issues.push(issue);
    groups.set(source.slug, group);
  }
  await Promise.all([...groups.values()].map(async ({ source, issues: sourceIssues }) => {
    const path = join(output, "sources", source.slug, "index.html");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, renderSourceTimeline(source, sourceIssues));
  }));
}

async function generate() {
  const { recipe, sources } = await loadEditionRecipe(argumentValue("recipe"), { recipeFile: argumentValue("recipe-file") });
  const date = issueDate();
  const id = editionId(date, recipe);
  const started = Date.now();
  const report = { id: `${id}-${randomUUID()}`, editionId: id, startedAt: new Date().toISOString(), sources: [], modelCalls: [] };
  let issue;
  let createdPublication = false;
  try {
    // Do not spend model budget or rewrite a published snapshot on a repeated run.
    try {
      await readFile(join(issueDirectory, `${id}.json`));
      report.outcome = "skipped";
      report.reason = "edition-already-exists";
      process.exitCode = 2;
      console.warn(`Edition ${id} already exists. Use a different --edition slug for a separate publication.`);
      return;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const timeWindow = sourceWindow();
    report.timeWindow = timeWindow;
    const articles = await fetchConfiguredArticles(sources, { ...timeWindow, sourceReport: report.sources, run: report });
    report.policyVersion = recipe.editorialPolicy?.version;
    const selectedArticles = await selectArticlesWithAi(articles, process.env, recipe.maxStories, { run: report, policy: recipe.editorialPolicy });
    const investigatedArticles = await investigateArticles(selectedArticles);
    report.selected = selectedArticles.length;
    report.extracted = investigatedArticles.filter((article) => article.investigation?.status === "complete").length;
    const usableArticles = investigatedArticles.filter(hasEditorialMaterial);
    report.materials = investigatedArticles.map(({ id: articleId, investigation, publishedAt, fetchedAt }) => ({ articleId, ...investigation, publishedAt, fetchedAt }));
    report.usable = usableArticles.length;
    issue = await editIssueWithAi(createIssue({ date, id, articles: usableArticles, maxStories: recipe.maxStories, recipe, sources }), usableArticles, process.env, { run: report, policy: recipe.editorialPolicy });
    const errors = validateIssue(issue);
    const missingRequired = sources.some((source) => source.required && !report.sources.some((entry) => entry.id === source.id && entry.status === "success"));
    if (issue.editorial.status !== "complete" || errors.length || missingRequired) {
      issue.status = "draft";
      issue.publicationErrors = errors;
      report.outcome = "draft";
      report.reason = missingRequired ? "required-source-unavailable" : errors.length ? "publication-validation-failed" : issue.editorial.reason;
      await saveJson(join("drafts", `${id}.json`), issue);
      process.exitCode = 2;
      console.warn(`Saved draft ${id}: ${report.reason}. The published site is unchanged.`);
      return;
    }
    issue.status = "published";
    issue.publishedAt = new Date().toISOString();
    assertValidIssue(issue);
    await saveJson(join(issueDirectory, `${id}.json`), issue, { exclusive: true });
    createdPublication = true;
    await build();
    report.outcome = "published";
    console.log(`Published ${id}`);
  } catch (error) {
    report.outcome = "failed";
    report.reason = error.code === "EEXIST" ? "edition-already-exists" : "generation-failed";
    if (createdPublication) await rm(join(issueDirectory, `${id}.json`));
    if (issue) await saveJson(join("drafts", `${id}.json`), { ...issue, status: "draft" });
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.durationMs = Date.now() - started;
    await saveJson(join("runs", `${report.id}.json`), report);
  }
}

async function saveJson(path, value, { exclusive = false } = {}) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
    // A hard link publishes complete bytes atomically without clobbering an existing edition.
    if (exclusive) await link(temporary, path);
    else await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function research() {
  const { recipe, sources } = await loadEditionRecipe(argumentValue("recipe"), { recipeFile: argumentValue("recipe-file") });
  const date = issueDate();
  const articles = await fetchConfiguredArticles(sources, sourceWindow());
  const selectedArticles = await selectArticlesWithAi(articles, process.env, recipe.maxStories, { policy: recipe.editorialPolicy });
  const investigatedArticles = await investigateArticles(selectedArticles);
  const path = join(researchDirectory, `${editionId(date, recipe)}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ date, recipe: { id: recipe.id, name: recipe.name }, sources: sources.map(({ id, name, type }) => ({ id, name, type })), articles: investigatedArticles }, null, 2)}\n`);
  console.log(`Saved research ${path}`);
}

async function validateRecipe() {
  const { recipe, sources } = await loadEditionRecipe(argumentValue("recipe"), { recipeFile: argumentValue("recipe-file") });
  console.log(`Valid recipe ${recipe.id}: ${sources.map((source) => `${source.id} (${source.type})`).join(", ")}; maxStories=${recipe.maxStories}`);
}

async function preview() {
  const { recipe, sources } = await loadEditionRecipe(argumentValue("recipe"), { recipeFile: argumentValue("recipe-file") });
  const date = issueDate();
  const articles = await fetchConfiguredArticles(sources, sourceWindow());
  const selectedArticles = await selectArticlesWithAi(articles, process.env, recipe.maxStories, { policy: recipe.editorialPolicy });
  const path = join(researchDirectory, `${editionId(date, recipe)}-preview.json`);
  await mkdir(dirname(path), { recursive: true });
  const report = sources.map((source) => ({ id: source.id, type: source.type, candidates: articles.filter((article) => article.sourceId === source.id).length, selected: selectedArticles.filter((article) => article.sourceId === source.id).length }));
  await writeFile(path, `${JSON.stringify({ date, recipe: { id: recipe.id, name: recipe.name }, sourceRunReport: report, articles: selectedArticles }, null, 2)}\n`);
  console.log(`Saved preview ${path}`);
}

async function build() {
  const issues = (await readIssues()).filter((issue) => issue.status !== "draft");
  issues.forEach((issue) => assertValidIssue(issue, { archive: true }));
  const groups = new Map();
  for (const issue of issues) {
    const source = sourceFor(issue);
    const group = groups.get(source.slug) ?? { source, issues: [] };
    group.issues.push(issue);
    groups.set(source.slug, group);
  }
  const staging = `.public-build-${randomUUID()}`;
  const previous = `.public-previous-${randomUUID()}`;
  let movedPrevious = false;
  let installed = false;
  try {
    const results = await Promise.allSettled([...groups.values()].flatMap(({ source, issues: sourceIssues }) => {
      const ordered = [...sourceIssues].sort((left, right) => String(right.date).localeCompare(String(left.date)) || String(right.id).localeCompare(String(left.id)));
      return ordered.map((issue, index) => writeEdition(issue, {
        output: staging,
        navigation: {
          source: { name: source.name, href: `../../sources/${source.slug}/` },
          newer: ordered[index - 1] ? { date: ordered[index - 1].date, href: `../${ordered[index - 1].id}/` } : undefined,
          older: ordered[index + 1] ? { date: ordered[index + 1].date, href: `../${ordered[index + 1].id}/` } : undefined,
          timeline: ordered.map((edition) => ({ date: edition.date, href: edition.id === issue.id ? "./" : `../${edition.id}/`, current: edition.id === issue.id }))
        }
      }));
    }));
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
    await writeCollection(issues, staging);
    try {
      await rename(outputDirectory, previous);
      movedPrevious = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    try {
      await rename(staging, outputDirectory);
      installed = true;
    } catch (error) {
      if (movedPrevious) await rename(previous, outputDirectory);
      throw error;
    }
    console.log(`Built ${issues.length} published editions.`);
  } finally {
    await rm(staging, { recursive: true, force: true });
    if (installed && movedPrevious) {
      await rm(previous, { recursive: true, force: true }).catch(() => console.warn(`Previous build retained at ${previous}; cleanup was unsuccessful.`));
    }
  }
}

const command = process.argv[2];
if (command === "generate") await generate();
else if (command === "research") await research();
else if (command === "validate-recipe") await validateRecipe();
else if (command === "preview") await preview();
else if (command === "build") await build();
else throw new Error("Usage: node src/cli.js <generate|research|build> [--recipe=id|--recipe-file=path] [--date=YYYY-MM-DD] [--edition=slug] [--template=standard|classic]");
