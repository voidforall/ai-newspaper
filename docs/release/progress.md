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

## Source materials — ticket #3

The pre-change extractor was replayed against original URLs from the October 19 issue. It extracted navigation and a sign-in/edit dialog from Lazarus and branch/file-list chrome from GitHub rather than project documentation. WJCL returned an unavailable/non-HTML response during the replay. Local captured before-results are in ignored research files, not public artifacts.

- Replaced regex article extraction with Mozilla Readability 0.6.0 and jsdom 29.1.1, following the [Readability Node.js documentation](https://github.com/mozilla/readability#nodejs-usage). jsdom 30 requires a newer Node patch than this environment; locked version 29 supports the selected Node 22 runtime. Scripts and remote resource loading remain disabled. Locked dependencies are installed in Actions via `npm ci`.
- Real after-replays: Lazarus extracts 7,121 characters of its article rather than dialog/navigation; the GitHub example reads the actual README via the raw GitHub API; arXiv extracts its 1,562-character abstract without author/navigation chrome.
- Release sources carry original release-note material. RSS candidates carry explicitly attributed feed-summary material; an unavailable original can use a sufficiently detailed feed summary, while an HN discussion excerpt cannot stand in for source facts. Candidates without usable material never reach the AI editor.
- Both the AI input and persisted story now carry source material method/status/URL, genuine publication time when available, fetch time and truncation status. Readers see a notice for feed-only fallback. The run report retains both timestamps as well. Research query date is never manufactured into a source publication date.
- Sentence segmentation preserves decimal versions. Up to 12,000 characters reach the editor (formerly 4,000); oversized sources retain a marked head/tail excerpt rather than silently dropping all later limitations. Retrieval and DOM size are bounded; literal private/local redirect destinations are rejected. This is not a claim of DNS-rebinding protection.
- Actual captured sources rendered into an explicitly labelled local draft preview; browser checked all three clean summaries and no horizontal overflow. This was extraction verification, not an AI quality or publication claim.
- CLI regression checks the actual material passed to the mocked external editor and confirms a source-only login page does not trigger editing or publication. A feed-only end-to-end case verifies provenance through extraction, AI input, persisted JSON and reader rendering.
- Standards/Spec reviews found provenance loss in the initial patch; both findings were fixed and re-reviewed with no further defects found.
- Full current suite: 44/44 pass; build renders all 97 integrated publications.

## Implementation frontier

Ticket #1 is complete. Ticket #2 has its code and deterministic fault checks complete but remains open for actual configured-model acceptance. Ticket #3 is implemented and verified locally. Next: #4 AI Builder editorial policy and #6 direct reader experience, then evidence and distribution. No deployment, real API run or seven-day candidate acceptance is being implied by these local checks.

## AI Builder editorial policy — ticket #4

- The default recipe now targets Chinese-speaking AI application builders, with a maximum of eight stories, three per source and three per topic, and a 2,200-character/five-minute editorial budget. Primary release/research sources are distinguished from analysis and community discovery.
- Canonical URLs merge before selection while retaining meaningful query parameters and all attribution links. Non-AI selection round-robins sources and compares scores only within each source. Both paths enforce source/topic limits and may select fewer than five stories or none.
- Source retrieval respects either the explicit edition date or a rolling 24-hour window. The real October 20 preview selected five items (one release, three papers and one AI tooling story); irrelevant generic software was excluded after inspecting the initial preview. This is a source-selection check, not a model-quality claim.
- Editing instructions distinguish paper results/settings, release availability/compatibility, and news consequences. Every policy story requires a caveat; English output, token Chinese suffixes, untranslated headlines, omitted caveats and oversized editions remain drafts. Reader labels and article kinds are localized.
- Standards and Spec follow-up reviews found no remaining blocking findings. Full suite: 52/52 pass; all 97 published editions rebuild; git diff whitespace check passes. Real-provider wording and seven-day quality review remain open in #2/#9.

## Inspectable source evidence — ticket #5 (code complete; formal edition review pending)

- Every newly AI-edited story now includes bounded, verbatim excerpts and block-level attribution for headline, summary, impact and caveat. Factual blocks require references; unknown and editorial interpretation have distinct labels. Source URLs, retrieval timestamps and UTF-16 offsets in extracted material come from code, never model-selected URLs.
- Integrity checks require existing unique IDs, actual substrings of the supplied material, and no unused evidence; excerpts are at most 240 characters each and 480 combined per story. Whole source bodies remain outside published issues. These checks do not establish entailment or independently verify facts.
- The real CLI rejects fabricated quotations and nonexistent IDs before publication, retaining the previous published site. Published evidence validation also rejects invalid references. Legacy editions need no new fields. Editing prompt version is now editorial-v2; high-priority untrusted-material instructions remain in place.
- Native details/summary disclosure exposes attribution, source excerpts, links, retrieval time and locations. Actual browser proof: 390×844 mobile/touch viewport, focused summary activated with Enter, disclosure open, document width and scroll width both 390. Captured local draft uses the genuine Transformers v5.20.2 notes and was checked against both its excerpts and the full 632-character supplied notes. It is explicitly a manual, unpublished local preview, not a model/publication claim.
- Human consistency regression case: test/fixtures/evidence-consistency.json records a rejected unsupported 2× throughput/production-capacity claim conflicting with an absent-performance-evaluation caveat, and the reviewed correction. This is a manual-review fixture, not an automated semantic verifier. Future edition checks must compare summary, impact and caveat with the source together.
- Spec review found no blocking code defects. Standards review found malformed story objects could crash evidence validation; guarded and covered by regression. A real formally published edition still needs story-by-story review after #2's actual provider run, so #5 remains open.

Ticket #5 final deterministic verification: 57/57 tests pass, 97 published editions rebuild and whitespace check passes.

## Direct reading and standalone stories — ticket #6

- Homepage now renders the latest published ai-builder edition directly; it ignores newer drafts and secondary recipes, displays edition date and generation time, and explicitly identifies the last available edition when today is missing. With no formal main edition yet, it renders a clearly labelled, human-reviewed demo based on genuine Transformers v5.20.2 release notes. Demo remains outside issues/ and does not count as a publication or toward seven-day acceptance.
- Archive is at archive/, source timelines and all existing editions/ paths remain, and the recipe builder has a separate builder/ entry. Demo also has demo/. No key or account is required to read. Relative routes retain the repository deployment prefix.
- Each real archived or new story has a standalone stories/<edition>/<stable-story-id>/ page with original source links and a return link to its exact edition anchor. IDs derive from article identity or canonical original URL; feed-only legacy records include their immutable summary and never their display headline/order. Ambiguous IDs fail before output writes instead of overwriting pages. Unsafe original URLs do not block fallback to a valid source.
- Main view is bounded by editorial policy; evidence expands on demand. Single-story pages show the story once under the publication masthead, omitting the unrelated whole-edition editor note. Visible focus and native disclosure remain. Adjacent floating arrows are hidden where they could cover the paper; timeline navigation remains available.
- Browser QA on the real generated site mounted at /ai-newspaper/: home/demo and archive at 375 px, legacy edition at 375/390 px, standalone story at 390/1280 px, builder at 375 px. Long Chinese headline and long unbroken URL stress checks, including expanded evidence, yield scroll width equal to viewport width at both 375 and 390. Desktop screenshot inspected at 1280 px; headline and summary grid share the intended row, and no overlay navigation covers content.
- Standards review found two legacy identity edge cases; both reproduced through actual CLI builds, corrected and re-reviewed. Spec review found source-index return navigation pointed at the new homepage; corrected to archive/. Final focused reader/render tests pass 7/7; full suite result recorded below. All 97 original published issues still rebuild.

Ticket #6 final verification: 61/61 tests pass, all 97 published editions rebuild and git diff whitespace check passes. No deployment or release tag yet.
