import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createIssue } from "./create-issue.js";
import { fetchConfiguredArticles } from "./source-adapters.js";
import { editIssueWithAi, selectArticlesWithAi } from "./edit-issue.js";
import { investigateArticles } from "./investigate-content.js";
import { renderIssue } from "./render-issue.js";
import { renderCollection } from "./render-collection.js";

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
  const pageSize = 12;
  const pages = Math.max(1, Math.ceil(issues.length / pageSize));
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(Array.from({ length: pages }, async (_, index) => {
    const page = index + 1;
    const path = page === 1 ? join(outputDirectory, "index.html") : join(outputDirectory, "page", String(page), "index.html");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, renderCollection(issues, { page, pageSize }));
  }));
}

async function generate() {
  const sources = JSON.parse(await readFile("sources.json", "utf8"));
  const articles = await fetchConfiguredArticles(sources);
  const selectedArticles = await selectArticlesWithAi(articles);
  const investigatedArticles = await investigateArticles(selectedArticles);
  const issue = await editIssueWithAi(createIssue({ date: today(), id: editionId(today(), sources), articles: investigatedArticles }), investigatedArticles);
  await writeEdition(issue);
  await build();
}

async function research() {
  const sources = JSON.parse(await readFile("sources.json", "utf8"));
  const articles = await fetchConfiguredArticles(sources);
  const selectedArticles = await selectArticlesWithAi(articles);
  const investigatedArticles = await investigateArticles(selectedArticles);
  const path = join(researchDirectory, `${editionId(today(), sources)}.json`);
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
else throw new Error("Usage: node src/cli.js <generate|research|build> [--template=standard|classic]");
