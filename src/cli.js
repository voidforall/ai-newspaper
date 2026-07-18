import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createIssue } from "./create-issue.js";
import { fetchConfiguredArticles } from "./source-adapters.js";
import { editIssueWithAi, selectArticlesWithAi } from "./edit-issue.js";
import { investigateArticles } from "./investigate-content.js";
import { renderIssue } from "./render-issue.js";
import { renderCollection, renderSourceTimeline, sourceFor } from "./render-collection.js";

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) {
    throw new Error(`Invalid --date value: ${date}`);
  }
  return date;
}

function editionSlug(sources) {
  return argumentValue("edition") ?? (sources.filter((source) => source.enabled).map((source) => source.id).join("-") || "edition");
}

function editionId(date, sources) {
  return `${date}-${editionSlug(sources)}`;
}

async function writeEdition(issue, { persist = true } = {}) {
  const id = issue.id ?? issue.date;
  const jsonPath = join(issueDirectory, `${id}.json`);
  const htmlPath = join(outputDirectory, "editions", id, "index.html");
  await Promise.all([mkdir(dirname(htmlPath), { recursive: true }), persist ? mkdir(dirname(jsonPath), { recursive: true }) : Promise.resolve()]);
  const renderedIssue = renderIssue(issue, { template: templateArgument() ?? issue.template ?? "standard" });
  const outputs = [writeFile(htmlPath, renderedIssue)];
  if (persist) outputs.push(writeFile(jsonPath, `${JSON.stringify(issue, null, 2)}\n`));
  await Promise.all(outputs);
  console.log(`Published ${htmlPath}`);
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

async function writeCollection(issues) {
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, "index.html"), renderCollection(issues));
  const groups = new Map();
  for (const issue of issues) {
    const source = sourceFor(issue);
    const group = groups.get(source.slug) ?? { source, issues: [] };
    group.issues.push(issue);
    groups.set(source.slug, group);
  }
  await Promise.all([...groups.values()].map(async ({ source, issues: sourceIssues }) => {
    const path = join(outputDirectory, "sources", source.slug, "index.html");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, renderSourceTimeline(source, sourceIssues));
  }));
}

async function generate() {
  const sources = JSON.parse(await readFile("sources.json", "utf8"));
  const date = issueDate();
  const articles = await fetchConfiguredArticles(sources, { date: argumentValue("date") });
  const selectedArticles = await selectArticlesWithAi(articles);
  const investigatedArticles = await investigateArticles(selectedArticles);
  const issue = await editIssueWithAi(createIssue({ date, id: editionId(date, sources), articles: investigatedArticles }), investigatedArticles);
  await writeEdition(issue);
  await build();
}

async function research() {
  const sources = JSON.parse(await readFile("sources.json", "utf8"));
  const date = issueDate();
  const articles = await fetchConfiguredArticles(sources, { date: argumentValue("date") });
  const selectedArticles = await selectArticlesWithAi(articles);
  const investigatedArticles = await investigateArticles(selectedArticles);
  const path = join(researchDirectory, `${editionId(date, sources)}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ date: today(), articles: investigatedArticles }, null, 2)}\n`);
  console.log(`Saved research ${path}`);
}

async function build() {
  const issues = await readIssues();
  await Promise.all(issues.map((issue) => writeEdition(issue, { persist: false })));
  await writeCollection(issues);
}

const command = process.argv[2];
if (command === "generate") await generate();
else if (command === "research") await research();
else if (command === "build") await build();
else throw new Error("Usage: node src/cli.js <generate|research|build> [--date=YYYY-MM-DD] [--edition=slug] [--template=standard|classic]");
