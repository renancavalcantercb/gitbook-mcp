# Implementation Workflow — Code Quality Refactor

Source: thermo-nuclear-code-quality-review of `src/index.ts` (2026-06-30). Plan only — no code execution here. Run with `/sc:implement` phase by phase.

Findings being addressed:
1. 15 copy-pasted response envelopes (7 tool returns + 6 prompt returns + 2 resources) → extract `jsonResult()` / `promptResult()` helpers
2. `resolveSpaceId` / `resolveOrganizationId` on `GitBookAPIClient` — identical logic, different field names → collapse to one `resolveRequired()`
3. File at 1200 lines, single module, 6+ unrelated concerns stacked → split into `types.ts`, `client.ts`, `config.ts`, `tools.ts`, `prompts.ts`, `index.ts`
4. Type boundary leak — `getPageContent`/`getPageByPath`/`searchContent` return `Promise<any>` despite `GitBookContent`/`GitBookPage` already defined and unused

Each phase is mechanical and individually verifiable against a real GitBook space — no behavior should change until Phase 3.

## Dependency graph

```
Phase 0 (baseline) ──► Phase 1 (dedup helpers, same file) ──► Phase 2 (module split) ──► Phase 3 (type boundaries) ──► Phase 4 (verify + docs)
```
Strictly sequential. Phase 2 must not start until Phase 1's helpers exist — relocating duplicated code first would mean fixing the duplication in 5 files instead of 1.

---

## Phase 0 — Baseline safety net

| Task | Detail |
|---|---|
| 0.1 | `npm run test` (tsc --noEmit) on current `main` — confirm clean, record as baseline |
| 0.2 | `npm run build && npm start`, call `list_organizations` and `get_page_by_path` (known real path) against test space, save raw JSON output as reference |

**Checkpoint 0:** Clean baseline build + two real tool-call outputs saved for diffing later. Nothing proceeds until both exist.

---

## Phase 1 — Mechanical de-dup (in-place, single file)

| Task | Detail | Depends on |
|---|---|---|
| 1.1 | Add `jsonResult(data)` helper near top of file; replace all 7 tool-handler return blocks (`list_organizations`, `list_spaces`, `get_space`, `get_space_content`, `get_page_content`, `get_page_by_path`, `search_content`) | 0.1 |
| 1.2 | Replace the 2 `server.resource` return blocks (`default-space`, `organizations`) with the same helper shape if structurally identical, otherwise leave — resources use `contents`/`uri`/`mimeType`, not `content`/`type`, confirm before forcing reuse | 1.1 |
| 1.3 | Add `promptResult(description, text)` helper; replace all 6 prompt return blocks (`fetch_documentation`, `analyze_content_gaps`, `content_audit`, `documentation_summary`, `content_optimization`, `propose_page_edit`) — `propose_page_edit`'s excluded-space early return also collapses through the same helper | 1.1 |
| 1.4 | On `GitBookAPIClient`, add `resolveRequired(explicit, fallback, label, flag)`; reimplement `resolveSpaceId`/`resolveOrganizationId` as 1-line callers | 1.1 |

**Checkpoint 1:** `npm run test` clean. Rerun the two calls from 0.2 — output byte-identical to saved reference. File line count should drop by ~120-150 lines with zero functional diff.

---

## Phase 2 — Module split (mechanical relocation only)

| Task | Detail | Depends on |
|---|---|---|
| 2.1 | `src/types.ts` — move `GitBook*` interfaces, `GitBookErrorResponse`, `GitBookAPIError` | Checkpoint 1 |
| 2.2 | `src/client.ts` — move `GitBookAPIClient` (imports from `types.ts`) | 2.1 |
| 2.3 | `src/config.ts` — move CLI argv parsing, env-file loading loop, `resolveConfiguration`, the missing-token diagnostic block (currently inline at module scope) wrapped in a named function | Checkpoint 1 |
| 2.4 | `src/tools.ts` — move all 6 `server.tool(...)` registrations + `jsonResult`; export a `registerTools(server, client)` function | 2.1, 2.2 |
| 2.5 | `src/prompts.ts` — move all 6 `server.prompt(...)` registrations + `promptResult`; export `registerPrompts(server, client, excludedSpaceIds)` | 2.1, 2.2 |
| 2.6 | `src/index.ts` shrinks to: load config → build client → `registerTools`/`registerPrompts` → 2 resources → `main()` | 2.3, 2.4, 2.5 |

**Checkpoint 2:** `npm run build` clean, no circular imports. Rerun Phase 0's two calls — byte-identical output. Each new file under ~350 lines; `index.ts` under ~150.

---

## Phase 3 — Type boundary cleanup

| Task | Detail | Depends on |
|---|---|---|
| 3.1 | `GitBookAPIClient.getPageContent` — type return as `GitBookContent \| string` (markdown format returns plain text, document format returns `GitBookContent`) instead of `any` | Checkpoint 2 |
| 3.2 | `GitBookAPIClient.getPageByPath` — same page-shape typing as 3.1 | Checkpoint 2 |
| 3.3 | `GitBookAPIClient.searchContent` — define a `GitBookSearchResult` type from the OpenAPI spec (`openapi.json` has the schema) instead of `any` | Checkpoint 2 |
| 3.4 | Update the 3 affected tool handlers in `tools.ts` to drop their own `any` typing now that the client returns real types | 3.1, 3.2, 3.3 |

**Checkpoint 3:** `npm run test` clean with no new `any` introduced. Remaining `any` only on genuinely undocumented OpenAPI fields (`plan?: any`, `billing?: any`, `details?: any`) — those stay, not in scope.

---

## Phase 4 — Verify & docs

| Task | Detail | Depends on |
|---|---|---|
| 4.1 | Full smoke pass: all 6 tools + `propose_page_edit` prompt against real test space, compare against Phase 0 reference where applicable | Checkpoint 3 |
| 4.2 | `npm run format:check` clean across new files | 4.1 |
| 4.3 | Update `DESIGN.md` references to `src/index.ts` (lines 3, 266 currently say `propose_page_edit` "shipped in `src/index.ts`") to point at `src/prompts.ts` | 4.1 |
| 4.4 | Cold-clone check: `git clone` to temp dir, `npm ci && npm run build`, confirm it starts clean | 4.2, 4.3 |

**Checkpoint 4:** Cold clone builds and runs. DESIGN.md no longer points at a file structure that doesn't exist.

---

## Next step

`/sc:implement` — execute Phase 0 first. Stop at each checkpoint for a go/no-go before continuing.
