import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createIssue } from "./create-issue.js";
import { editIssueWithAi } from "./edit-issue.js";
import { fetchTopStories } from "./hacker-news.js";
import { renderIssue } from "./render-issue.js";

const outputDirectory = "public";
const issueDirectory = "issues";
const today = () => new Date().toISOString().slice(0, 10);

async function writeIssue(issue) {
  const jsonPath = join(issueDirectory, `${issue.date}.json`);
  const htmlPath = join(outputDirectory, issue.date, "index.html");
  await Promise.all([mkdir(dirname(jsonPath), { recursive: true }), mkdir(dirname(htmlPath), { recursive: true })]);
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(issue, null, 2)}\n`),
    writeFile(htmlPath, renderIssue(issue)),
    writeFile(join(outputDirectory, "index.html"), renderIssue(issue))
  ]);
  console.log(`Published ${htmlPath}`);
}

async function generate() {
  const articles = await fetchTopStories();
  const issue = await editIssueWithAi(createIssue({ date: today(), articles }));
  await writeIssue(issue);
}

async function build() {
  const issue = JSON.parse(await readFile(join(issueDirectory, `${today()}.json`), "utf8"));
  await writeIssue(issue);
}

const command = process.argv[2];
if (command === "generate") await generate();
else if (command === "build") await build();
else throw new Error("Usage: node src/cli.js <generate|build>");
