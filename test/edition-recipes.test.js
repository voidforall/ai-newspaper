import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEditionRecipe } from "../src/edition-recipes.js";

test("loads a recipe with its selected catalog sources", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "ai-newspaper-recipes-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const catalogPath = join(directory, "source-catalog.json");
  const recipesPath = join(directory, "edition-recipes.json");
  await writeFile(catalogPath, JSON.stringify({ sources: [
    { id: "hacker-news", name: "Hacker News", type: "api", adapter: "hacker-news" },
    { id: "papers", name: "Papers", type: "rss", adapter: "rss" }
  ] }));
  await writeFile(recipesPath, JSON.stringify({ recipes: [
    { id: "ai-daily", name: "AI Daily", sources: ["hacker-news", "papers"], maxStories: 10 }
  ] }));

  const loaded = await loadEditionRecipe("ai-daily", { catalogPath, recipesPath });

  assert.deepEqual(loaded, {
    recipe: { id: "ai-daily", name: "AI Daily", sources: ["hacker-news", "papers"], maxStories: 10 },
    sources: [
      { id: "hacker-news", name: "Hacker News", type: "api", adapter: "hacker-news" },
      { id: "papers", name: "Papers", type: "rss", adapter: "rss" }
    ]
  });
});

test("rejects a recipe with an invalid global story limit", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "ai-newspaper-recipes-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const catalogPath = join(directory, "source-catalog.json");
  const recipesPath = join(directory, "edition-recipes.json");
  await writeFile(catalogPath, JSON.stringify({ sources: [
    { id: "hacker-news", name: "Hacker News", type: "api", adapter: "hacker-news" }
  ] }));
  await writeFile(recipesPath, JSON.stringify({ defaultRecipeId: "daily", recipes: [
    { id: "daily", name: "Daily", sources: ["hacker-news"], maxStories: 0 }
  ] }));

  await assert.rejects(
    loadEditionRecipe(undefined, { catalogPath, recipesPath }),
    /Recipe daily must define a positive maxStories value\./
  );
});

test("loads the configured mixed-source AI briefing recipe", async () => {
  const { recipe, sources } = await loadEditionRecipe("ai-briefing");

  assert.equal(recipe.name, "AI Briefing");
  assert.deepEqual(sources.map((source) => source.adapter), ["hacker-news", "rss", "github-releases"]);
});

test("loads the configured agent-research policy recipe", async () => {
  const { sources } = await loadEditionRecipe("ai-policy-watch");
  assert.deepEqual(sources.map((source) => source.adapter), ["hacker-news", "agent-research"]);
});

test("loads the configured research-paper, SDK-release, and technology-brief recipes", async () => {
  const papers = await loadEditionRecipe("research-papers");
  const releases = await loadEditionRecipe("sdk-releases");
  const techBrief = await loadEditionRecipe("developer-brief");

  assert.deepEqual(papers.sources.map((source) => source.adapter), ["rss"]);
  assert.deepEqual(releases.sources.map((source) => source.repository), ["huggingface/transformers"]);
  assert.deepEqual(techBrief.sources.map((source) => source.id), ["techmeme"]);
});

test("loads a shareable recipe file with custom sources", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "ai-newspaper-recipes-")); t.after(() => rm(directory, { recursive: true, force: true }));
  const recipeFile = join(directory, "recipe.json");
  await writeFile(recipeFile, JSON.stringify({ recipe: { id: "custom", name: "Custom", sources: ["custom-rss"] }, sources: [{ id: "custom-rss", name: "Custom RSS", type: "rss", adapter: "rss", feedUrl: "https://example.com/feed.xml" }] }));
  const { recipe, sources } = await loadEditionRecipe(undefined, { recipeFile });
  assert.equal(recipe.id, "custom"); assert.equal(sources[0].feedUrl, "https://example.com/feed.xml");
});
