const fields = ["headline", "summary", "whyItMatters", "caveat"];
const factualKinds = new Set(["source-statement", "vendor-claim", "community-report"]);
const kinds = new Set([...factualKinds, "editorial-judgment", "unknown"]);

function safeUrl(value) {
  try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; }
}

// Checks provenance and reference integrity, not truth or entailment of a claim.
export function evidenceErrors(story) {
  if (!story || typeof story !== "object") return ["Story evidence requires a story object."];
  const errors = [];
  if (!Array.isArray(story.evidence) || story.evidence.length < 1 || story.evidence.length > 6) return ["One to six short source excerpts are required."];
  const ids = new Set();
  let characters = 0;
  for (const item of story.evidence) {
    if (!/^e[1-6]$/.test(item?.id) || ids.has(item.id)) errors.push("Evidence IDs must be unique e1–e6 values.");
    ids.add(item?.id);
    if (typeof item?.quote !== "string" || item.quote.trim().length < 20 || item.quote.length > 240) errors.push("Evidence must be a short excerpt (20–240 characters).");
    characters += item?.quote?.length ?? 0;
    if (!safeUrl(item?.url) || !Number.isFinite(Date.parse(item?.fetchedAt))) errors.push("Evidence must have a source URL and retrieval time.");
    const location = item?.location;
    if (!location || location.unit !== "utf16" || !Number.isSafeInteger(location.start) || location.start < 0 || location.end !== location.start + item?.quote?.length) errors.push("Evidence must locate its excerpt in the extracted material.");
  }
  if (characters > 480) errors.push("Evidence excerpts exceed the per-story publication budget.");
  const used = new Set();
  for (const field of fields.filter((field) => story[field])) {
    const attribution = story.attribution?.[field];
    if (!kinds.has(attribution?.kind) || !Array.isArray(attribution?.evidenceIds)) {
      errors.push(`${field} must declare its attribution.`);
      continue;
    }
    const refs = attribution.evidenceIds;
    if (new Set(refs).size !== refs.length || refs.some((id) => !ids.has(id))) errors.push(`${field} references missing or repeated evidence.`);
    refs.forEach((id) => used.add(id));
    if (factualKinds.has(attribution.kind) && refs.length === 0) errors.push(`${field} factual claims require evidence.`);
    if (attribution.kind === "unknown" && refs.length) errors.push(`${field} unknown must not pretend to have supporting evidence.`);
    if (["headline", "summary"].includes(field) && !factualKinds.has(attribution.kind)) errors.push(`${field} must report attributed source material.`);
  }
  if ([...ids].some((id) => !used.has(id))) errors.push("Unused evidence must not be published.");
  return errors;
}

export function attachEvidence(edit, material) {
  if (!material || typeof material.sourceText !== "string" || !material.sourceMaterial) throw new Error("Missing evidence material.");
  if (!Array.isArray(edit.evidence)) throw new Error("Missing evidence excerpts.");
  const evidence = edit.evidence.map(({ id, quote }) => {
    if (typeof quote !== "string") throw new Error("Invalid source excerpt.");
    const start = material.sourceText.indexOf(quote);
    if (start < 0) throw new Error("Excerpt not present in the supplied source material.");
    return {
      id, quote, url: material.sourceMaterial.url, fetchedAt: material.sourceMaterial.fetchedAt,
      method: material.sourceMaterial.method,
      location: { start, end: start + quote.length, unit: "utf16" }
    };
  });
  const attribution = Object.fromEntries(fields.filter((field) => edit[field]).map((field) => [field, {
    kind: edit.attribution?.[field]?.kind,
    evidenceIds: edit.attribution?.[field]?.evidenceIds
  }]));
  const result = { ...edit, evidence, attribution };
  if (evidenceErrors(result).length) throw new Error("Invalid evidence references.");
  return { evidence, attribution };
}
