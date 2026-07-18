import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createIssue } from "./create-issue.js";
import { fetchConfiguredArticles } from "./source-adapters.js";
import { editIssueWithAi, selectArticlesWithAi } from "./edit-issue.js";
import { investigateArticles } from "./investigate-content.js";
import { renderIssue } from "./render-issue.js";

const outputDirectory = "public";
const issueDirectory = "issues";
const researchDirectory = "research";
const today = () => new Date().toISOString().slice(0, 10);

function templateArgument() {
  const argument = process.argv.slice(3).find((value) => value.startsWith("--template="));
  return argument?.slice("--template=".length);
}

async function writeIssue(issue, template = templateArgument() ?? issue.template ?? "standard") {
  const jsonPath = join(issueDirectory, `${issue.date}.json`);
  const htmlPath = join(outputDirectory, issue.date, "index.html");
  await Promise.all([mkdir(dirname(jsonPath), { recursive: true }), mkdir(dirname(htmlPath), { recursive: true })]);
  const renderedIssue = renderIssue(issue, { template });
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(issue, null, 2)}\n`),
    writeFile(htmlPath, renderedIssue),
    writeFile(join(outputDirectory, "index.html"), renderedIssue)
  ]);
  console.log(`Published ${htmlPath}`);
}

async function generate() {
  const sources = JSON.parse(await readFile("sources.json", "utf8"));
  const articles = await fetchConfiguredArticles(sources);
  const selectedArticles = await selectArticlesWithAi(articles);
  const investigatedArticles = await investigateArticles(selectedArticles);
  const issue = await editIssueWithAi(createIssue({ date: today(), articles: investigatedArticles }), investigatedArticles);
  await writeIssue(issue);
}

async function research() {
  const sources = JSON.parse(await readFile("sources.json", "utf8"));
  const articles = await fetchConfiguredArticles(sources);
  const selectedArticles = await selectArticlesWithAi(articles);
  const investigatedArticles = await investigateArticles(selectedArticles);
  const path = join(researchDirectory, `${today()}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ date: today(), articles: investigatedArticles }, null, 2)}\n`);
  console.log(`Saved research ${path}`);
}

async function build() {
  const issue = JSON.parse(await readFile(join(issueDirectory, `${today()}.json`), "utf8"));
  await writeIssue(issue);
}

const command = process.argv[2];
if (command === "generate") await generate();
else if (command === "research") await research();
else if (command === "build") await build();
else throw new Error("Usage: node src/cli.js <generate|research|build> [--template=standard|classic]");
