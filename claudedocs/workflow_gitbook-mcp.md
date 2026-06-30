# Implementation Workflow — GitBook MCP

Source: `DESIGN.md`. Plan only — no code execution here. Run with `/sc:implement` phase by phase.

## Dependency graph

```
Phase 0 (verify) ──► Phase 1 (strip/reconfig) ──► Phase 2 (client hardening) ──► Phase 3 (write tools) ──► Phase 4 (test) ──► Phase 5 (package/docs) ──► Phase 6 (rollout)
```
Strictly sequential. Phase 3 cannot start until Phase 0's OpenAPI check resolves (DESIGN.md §4 ⚠️) — wrong body shape = wasted write-tool code.

---

## Phase 0 — Verify before building (de-risk)

| Task | Detail |
|---|---|
| 0.1 | Fetch live OpenAPI spec (`api.gitbook.com/openapi.json` or in-docs "test it" panel) → confirm exact `POST /v1/spaces/{spaceId}/change-requests` request body fields |
| 0.2 | Mint personal GitBook PAT (post Google SSO login → account settings → developer) |
| 0.3 | Pick/confirm a real test space you have write access to — never test against a prod docs space |
| 0.4 | Fork `rickysullivan/gitbook-mcp` into company org (or personal, per your call) |
| 0.5 | Run fork as-is locally against test space, confirm one read tool works end-to-end (`get_page_by_path`) |

**Checkpoint 0:** CR creation body confirmed in writing (paste into DESIGN.md, close the ⚠️) + forked repo's existing read tool returns real data. No proceeding to Phase 1 until both true.

---

## Phase 1 — Strip & reconfigure base

| Task | Detail | Depends on |
|---|---|---|
| 1.1 | Remove file/collection-management tools not needed (DESIGN §8) | 0.4 |
| 1.2 | Keep: `search_content`, `list_spaces`, `get_space`, `get_page_by_path` | 1.1 |
| 1.3 | Add `GITBOOK_DEFAULT_SPACE_ID` env, wire as fallback when tool call omits `space_id` | 1.2 |
| 1.4 | Confirm `GITBOOK_API_BASE_URL` configurable (default `https://api.gitbook.com/v1`) | 1.2 |

**Checkpoint 1:** Trimmed server starts, all 4 kept read tools still work against test space.

---

## Phase 2 — API client hardening

| Task | Detail | Depends on |
|---|---|---|
| 2.1 | Add 429 retry with exponential backoff (max 2 retries) | Checkpoint 1 |
| 2.2 | Add typed error mapper: 401/403/404/409 → clear tool-error messages (DESIGN §6 table) | Checkpoint 1 |
| 2.3 | Smoke-test error paths with bad token (401) and bogus path (404) | 2.1, 2.2 |

**Checkpoint 2:** Bad token and bad path both return clear errors, not stack traces.

---

## Phase 3 — Write tools — BLOCKED, descoped from v1 (2026-06-30)

Live-API probe found GitBook has no working endpoint to write inline markdown into a page (see DESIGN.md §9 for the full finding). The only write-shaped endpoints in the spec (`content/import`, `content/page/{pageId}/import`) 404 on every variant tested, regardless of payload. User decision: ship read-only v1, revisit write capability later (GitBook fix, or a git-sync-based redesign). Tasks 3.1–3.4 not built.

---

## Phase 4 — Test — n/a, depended on Phase 3

No write flow to test. Read tools were smoke-tested inline during Phase 0/1/2 (real org: Looqbox, Tech space `K32OUBfz4m5TdUcMdwuS`) — `get_page_by_path` confirmed working, 401/404 error paths confirmed mapped.

---

## Phase 5 — Package & document (read-only v1)

| Task | Detail | Depends on |
|---|---|---|
| 5.1 | README: PAT generation steps (post-SSO), required env vars (`GITBOOK_API_TOKEN`, `GITBOOK_ORGANIZATION_ID`, `GITBOOK_SPACE_ID`, `GITBOOK_API_BASE_URL`), `claude mcp add` example | Checkpoint 2 |
| 5.2 | Example `.mcp.json` snippet for Claude Code local registration | 5.1 |
| 5.3 | Note read-only scope + write-blocked finding from DESIGN §9 in README (sets expectations up front) | 5.1 |

**Checkpoint 5:** A teammate who wasn't involved in building this can follow the README cold and get a working local read-only MCP.

---

## Phase 6 — Rollout

| Task | Detail | Depends on |
|---|---|---|
| 6.1 | One other dev dogfoods it (Checkpoint 5's cold-read test, for real) | Checkpoint 5 |
| 6.2 | Fix friction found in 6.1 | 6.1 |
| 6.3 | Share repo + README with wider team, each mints own PAT | 6.2 |

No Phase 7 — hosted server, scoped tokens, multi-space UI explicitly deferred (DESIGN §8). Revisit only if local-per-dev model hits real friction in practice, not preemptively.

---

## Next step

`/sc:implement` — execute Phase 0 first. Stop at each checkpoint for a go/no-go before continuing to the next phase.
