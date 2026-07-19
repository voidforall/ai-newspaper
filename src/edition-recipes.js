import { readFile } from "node:fs/promises";

const defaultMaxStories = 10;

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertCatalog(catalog) {
  if (!Array.isArray(catalog?.sources)) throw new Error("Source catalog must contain a sources array.");
  const sourceIds = new Set();
  for (const source of catalog.sources) {
    if (![source?.id, source?.name, source?.type, source?.adapter].every(isNonEmptyString)) {
      throw new Error("Each catalog source must define id, name, type, and adapter.");
    }
    if (sourceIds.has(source.id)) throw new Error(`Source catalog contains a duplicate source id: ${source.id}`);
    sourceIds.add(source.id);
  }
}

function assertRecipe(recipe) {
  if (!isNonEmptyString(recipe?.id) || !isNonEmptyString(recipe?.name) || !Array.isArray(recipe?.sources) || recipe.sources.length === 0) {
    throw new Error("Each edition recipe must define id, name, and at least one source.");
  }
  if (!recipe.sources.every(isNonEmptyString)) throw new Error(`Recipe ${recipe.id} contains an invalid source id.`);
  if (new Set(recipe.sources).size !== recipe.sources.length) throw new Error(`Recipe ${recipe.id} contains duplicate source ids.`);
  if (recipe.maxStories !== undefined && (!Number.isSafeInteger(recipe.maxStories) || recipe.maxStories < 1)) {
    throw new Error(`Recipe ${recipe.id} must define a positive maxStories value.`);
  }
}

export async function loadEditionRecipe(recipeId, { catalogPath = "source-catalog.json", recipesPath = "edition-recipes.json" } = {}) {
  const [catalog, recipeConfig] = await Promise.all([readJson(catalogPath), readJson(recipesPath)]);
  assertCatalog(catalog);
  if (!Array.isArray(recipeConfig?.recipes)) throw new Error("Edition recipes must contain a recipes array.");
  const recipeIds = new Set();
  for (const candidate of recipeConfig.recipes) {
    assertRecipe(candidate);
    if (recipeIds.has(candidate.id)) throw new Error(`Edition recipes contain a duplicate recipe id: ${candidate.id}`);
    recipeIds.add(candidate.id);
  }

  const selectedId = recipeId ?? recipeConfig.defaultRecipeId;
  const recipe = recipeConfig.recipes.find((candidate) => candidate.id === selectedId);
  if (!recipe) throw new Error(`No edition recipe is configured for: ${selectedId ?? "default"}`);

  const sourcesById = new Map(catalog.sources.map((source) => [source.id, source]));
  const sources = recipe.sources.map((sourceId) => {
    const source = sourcesById.get(sourceId);
    if (!source) throw new Error(`Recipe ${recipe.id} references an unknown source: ${sourceId}`);
    return source;
  });
  return { recipe: { ...recipe, maxStories: recipe.maxStories ?? defaultMaxStories }, sources };
}
