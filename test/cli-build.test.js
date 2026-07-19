import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const cliPath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.js");

test("build stops before publishing an invalid saved issue", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "ai-newspaper-build-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "issues"));
  await writeFile(join(directory, "issues", "2026-07-19-hacker-news.json"), JSON.stringify({
    date: "2026-07-19",
    stories: [{
      headline: "Missing source",
      summary: "This otherwise complete summary is long enough for publication.",
      category: "Technology",
      whyItMatters: "Readers cannot verify a story without an attributable source.",
      sourceLinks: []
    }]
  }));

  await assert.rejects(
    run(process.execPath, [cliPath, "build"], { cwd: directory }),
    /Issue validation failed:\n- Story 1 must include an attributable source link\./
  );
});
