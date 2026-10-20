# v0.1 execution record

Goal: implement and verify the approved release tickets 01–09, including the actual AI run and seven real publication days. A passing build or release candidate does not complete that goal.

## Baseline reconciliation — ticket #1

- Local feature baseline: `613a90c`.
- Remote fetched baseline: `ffc2fa0`; common ancestor `ee5f16c`.
- Remote changes after the ancestor contain only 91 new daily issue JSON files. They merge without conflicts into the local feature work.
- All 95 issue files in `origin/main` match their Git blob hashes after integration. Local total is 97, retaining the two additional local recipe editions as well.
- Initial user-facing command `npm run build` failed because 25 archived editions contain summaries shorter than the newer 40-character publication minimum. Original published text must not be padded or rewritten to pass a new validator.
- Fix: archive rebuilding accepts nonblank summaries in unversioned legacy issues; new/versioned editions and generation retain the publication minimum. Source and date checks still apply.
- Focused proof: CLI regression reproduces legacy failure, verifies saved JSON is unchanged, and rejects the same short summary in a versioned edition. CLI and validator tests: 7/7 pass. Complete archive build succeeds.
- Full integrated test suite: 28/28 pass. Standards and Spec code reviews found no blocking implementation defects; the historical exception must remain bounded by versioning all newly generated issues in ticket #2.
- Browser proof against local HTTP server: recipe index and builder visible; latest remote edition 2026-10-19 and oldest 2026-07-17 render, including their original story content. This is local validation, not a new deployment.

### Rebuild and rollback

Use `npm test` and `npm run build` from the integrated commit; serve the generated `public/` under the Pages repository prefix when checking deployment links. The original remote baseline remains reachable as `ffc2fa0`.

If a future deployment must be rolled back, create a detached worktree at the previously verified product commit, bring the complete current `issues/` archive into that worktree, rebuild and inspect the output before deploying it. Do not reset `main`, remove historical issues, or rerun an old scheduled generation job merely to restore presentation. Restoring presentation must not overwrite daily editorial data.

## External prerequisites

- Observed at execution start: GitHub repository has zero configured secrets; local `OPENAI_API_KEY` is absent and `OPENAI_MODEL` unset. Asked the user to choose safe configuration without pasting credentials into chat. No real API run claimed.
- Seven actual publication days have not started for the new candidate. Historical low-quality fallback editions do not count toward the new acceptance gate.
- No product deployment or GitHub release has been performed in this implementation run.

## Next frontier

Ticket #2: prevent fallback or incomplete drafts from entering the published site, preserve the last published edition, record honest model/run state, and verify a real configured AI run once credentials are available. Tickets #3, #4, and #6 can also proceed after the baseline.

## Generation state — ticket #2 (implementation complete; actual provider run pending)

- All newly created issues use schema version 1, draft/published state and explicit editorial provenance. Legacy renders visibly state that their editorial review was not tracked.
- Missing credentials, incomplete/invalid model output, duplicate edits, required-source failure and invalid publication fields retain a draft, emit a run record and exit nonzero. Drafts never enter the site; repeat publication IDs cannot overwrite historical JSON.
- JSON persistence uses complete temporary bytes and an exclusive link for new publications. Site rendering happens in a staging directory and only replaces the previous output after all renders succeed. A rendering failure removes the attempted new publication and retains the previous complete site.
- CLI regressions drive the actual command with external HTTP fixtures for missing-key, successful generation, invalid edits, provider failure, overwrite prevention and render rollback. The successful fixture is not a real model run.
- Direct local HTTP tests prove bounded transient retry, no credential retry and timeout of an unresponsive server. The optional research model also reports observed usage, actual model and failed/skipped source state. Provider response bodies, keys and full source materials are not written to run records.
- Actions keeps failure diagnostics and drafts in artifacts for 14 days, outside Pages and editorial Git history. A failed generation blocks deployment, preserving the current public site.
- Actual no-key CLI exercise: `npm run generate -- --recipe=sdk-releases --edition=release-check --date=2026-10-19` exited 2 and saved a draft; the site/archive remained unchanged.
- OpenAI implementation checked against official [text generation guidance](https://developers.openai.com/api/docs/guides/text) and [Responses create reference](https://developers.openai.com/api/reference/resources/responses/methods/create). Requests remain model-configured; no model availability, cost or quality claim is inferred from fixtures.
- Code-review findings about lost Actions drafts and omitted research usage were fixed. The real-provider criterion remains unchecked until credentials are safely configured and a complete actual run is inspected.

## Extraction investigation — ticket #3 next

The current extractor was replayed against original URLs from the October 19 issue. Lazarus still extracts navigation and a sign-in/edit dialog; GitHub extracts branch/file-list chrome rather than project documentation. WJCL returned an unavailable/non-HTML response during the replay. Local captured before-results are in ignored research files, not public artifacts. These establish concrete failure cases for the next extraction change.
