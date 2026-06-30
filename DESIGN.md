# GitBook MCP — Design

Status: **v1 implemented, read-only. v2 semi-automated drafting (§10) implemented** — `propose_page_edit` prompt shipped in `src/index.ts`. Write capability designed in §4/§5 turned out to be unbuildable against GitBook's real API — see §9. Decisions confirmed by user marked ✅.

## 1. Decisions locked in (brainstorm)

| Area | Decision |
|---|---|
| Auth | ✅ PAT per user (not shared service token) |
| Write safety | ✅ All writes go through GitBook Change Requests, never direct page overwrite — moot for v1, see §9 |
| Scope | ✅ Read + write in v1 → **descoped to read-only**, 2026-06-30 (§9) |
| Deployment | ✅ Local stdio MCP per dev, no hosted server |

## 2. Assumptions made in this design pass (flag if wrong)

| # | Assumption | Default chosen | Why |
|---|---|---|---|
| 1 | Content format | Markdown only, no native GitBook-doc JSON | API's Change Request content endpoint accepts a `markdown` field directly — no block-JSON construction needed for v1. Custom blocks (Mermaid, etc.) may not round-trip; explicitly out of scope. |
| 2 | Space/org scope | Optional `GITBOOK_DEFAULT_SPACE_ID` env, every tool also accepts `space_id` param to override | No hardcoded single-space lock-in, no need for org-wide enumeration UI either |
| 3 | Stack | **Fork [rickysullivan/gitbook-mcp](https://github.com/rickysullivan/gitbook-mcp)** (MIT, TS/Node 20+, modular, stdio MCP, direct fetch calls — no heavy client lib) and add a write module | Ponytail rule: don't rebuild stdio MCP plumbing + read tools that already exist and work. Caveat: last release tagged 2025-06-29, no visible activity since — treat as a frozen scaffold to fork, not a dependency to track upstream. |
| 4 | Page addressing | `path` is always explicit, caller-supplied. No slug auto-generation from title. | Auto-slugging risks silently targeting/overwriting the wrong page. Explicit > implicit for a write path. |

## 3. Architecture

```
┌─────────────────┐   stdio    ┌───────────────────────────┐   HTTPS + Bearer PAT   ┌─────────────┐
│  Claude Code     │ ◄────────► │  gitbook-mcp (forked)     │ ─────────────────────► │ GitBook API │
│  (per-dev local) │            │  - tool registry          │                        │ api.gitbook  │
└─────────────────┘            │  - GitBook API client     │ ◄───────────────────── │ .com/v1     │
                                │  - error mapper           │      JSON responses     └─────────────┘
                                └───────────────────────────┘
                                         │
                                         ▼
                                  GITBOOK_API_TOKEN (env, per-dev PAT)
                                  GITBOOK_DEFAULT_SPACE_ID (env, optional)
```

No database, no server process beyond the stdio child process Claude Code spawns. No token persisted to disk by the MCP itself — lives only in the env var for the session.

### Components

1. **MCP server core** — reused from fork as-is (stdio transport, tool dispatch, config loading via env/CLI args).
2. **GitBook API client** — extend fork's existing direct-fetch pattern with: bearer auth header, base URL config, 429 retry-with-backoff, typed error mapping.
3. **Read tools** — reused from fork, trimmed (dropped file/collection management tools: `get_space_files`, `get_file`, `list_collections`, `get_collection`, `get_collection_spaces` — out of scope for docs-editing use case). Kept: `list_organizations`, `list_spaces`, `get_space`, `get_space_content`, `get_page_content`, `get_page_by_path`, `search_content`.
4. **Write tools — descoped, see §9.** `create_page`/`update_page`/`get_change_request_status` as designed below are not buildable against the live API.
5. **Error mapper** — implemented in the API client: 429 retry w/ exponential backoff (max 2), typed messages for 401/403/404 per §6.

## 4. Write flow (sequence) — ⚠️ DESIGNED BUT NOT BUILDABLE, see §9

```
Agent                gitbook-mcp                          GitBook API
  │ create_page(...)      │                                     │
  │──────────────────────►│                                     │
  │                       │ POST /v1/spaces/{spaceId}/change-requests
  │                       │────────────────────────────────────►│
  │                       │◄──────────────────── {id, status: "draft"}
  │                       │ PUT /v1/spaces/{spaceId}/change-requests/{id}/content
  │                       │   body: [{operation:"insert_page", path, document:{markdown}}]
  │                       │────────────────────────────────────►│
  │                       │◄──────────────────── 200 {revision}  │
  │◄──────────────────────│ {change_request_id, change_request_url, status:"draft"}
  │                       │                                     │
  │   (human reviews + merges change request in GitBook UI — outside MCP scope)
```

`update_page` is identical but uses `operation: "update_page"` against an existing page id/path.

✅ Confirmed against live spec (`api.gitbook.com/openapi.json`, 2026-06-30): `POST .../change-requests` body is `{ subject?: string, template?: ApplySpaceTemplate }` — both optional, no base-revision field (defaults to current main revision), `additionalProperties: true`. `create_page`/`update_page` will send `subject` only (from `title` or `change_summary`); `template` stays unused in v1.

## 5. MCP Tool API Spec

Shipped in v1: `list_organizations`, `list_spaces`, `get_space`, `get_space_content`, `get_page_content`, `get_page_by_path`, `search_content` (read-only, see README for full schemas — these are the fork's base tools, trimmed per §3). Specs below for `create_page`/`update_page`/`get_change_request_status` are the **blocked v2 design**, not shipped — kept for whoever picks this up if GitBook ships real write support.

### `search_content`
```json
{
  "input": {
    "query": "string, required",
    "space_id": "string, optional — falls back to GITBOOK_DEFAULT_SPACE_ID"
  },
  "output": {
    "results": [{ "page_id": "string", "title": "string", "path": "string", "snippet": "string" }]
  }
}
```

### `get_page_by_path`
```json
{
  "input": { "space_id": "string, optional", "path": "string, required" },
  "output": { "page_id": "string", "title": "string", "path": "string", "markdown": "string" }
}
```

### `create_page`
```json
{
  "input": {
    "space_id": "string, optional",
    "path": "string, required — e.g. 'guides/onboarding'",
    "title": "string, required",
    "markdown_content": "string, required",
    "parent_path": "string, optional — nests under existing page"
  },
  "output": {
    "change_request_id": "string",
    "change_request_url": "string",
    "status": "draft"
  }
}
```

### `update_page`
```json
{
  "input": {
    "space_id": "string, optional",
    "path": "string, required — identifies existing page",
    "markdown_content": "string, required",
    "change_summary": "string, optional — used as CR title/description"
  },
  "output": {
    "change_request_id": "string",
    "change_request_url": "string",
    "status": "draft"
  }
}
```

### `get_change_request_status` (new, small addition)
Lets the agent (or user) check whether a previously-opened edit got merged, without leaving Claude Code.
```json
{
  "input": { "space_id": "string, optional", "change_request_id": "string, required" },
  "output": { "status": "draft | open | archived | merged", "url": "string" }
}
```

## 6. Error handling

| GitBook HTTP status | MCP tool error returned to agent |
|---|---|
| 401 | "Invalid or expired token — regenerate PAT in GitBook account settings." |
| 403 | "Token's user has no access to this space." (not a server bug — surfaces GitBook's own permission model) |
| 404 | "Space or page not found at that path." |
| 409 (e.g. `insert_page` on existing path) | "Page already exists at this path — use update_page instead." |
| 429 | Retry with exponential backoff (2 attempts max), then surface "Rate limited, try again shortly." |

No silent failures, no retries on 4xx other than 429.

## 7. Config

```
GITBOOK_API_TOKEN        required   — per-dev PAT, minted post-Google-SSO-login at https://app.gitbook.com/account/developer
GITBOOK_ORGANIZATION_ID  optional   — default org for list_spaces/etc
GITBOOK_SPACE_ID         optional   — default space if tool calls omit spaceId (base repo's existing name, kept as-is — not GITBOOK_DEFAULT_SPACE_ID as originally drafted)
GITBOOK_API_BASE_URL     optional   — default https://api.gitbook.com/v1
```

No other persistence. No setup beyond `claude mcp add` pointing at the forked server with these env vars.

## 8. Explicitly out of scope (v1)

- **Write capability** (`create_page`, `update_page`, `get_change_request_status`) — not a v1 choice, it's blocked. See §9.
- Native GitBook block-JSON content (Markdown only)
- Org-wide space enumeration / discovery UI
- Shared/hosted MCP server
- File/asset upload, collections management (present in forked base, stripped — see §3)

## 9. Write capability — blocked, findings (2026-06-30)

DESIGN §4 assumed a `PUT /spaces/{spaceId}/change-requests/{id}/content` endpoint accepting `{operation, path, document:{markdown}}`. Checked against the live OpenAPI spec (`api.gitbook.com/openapi.json`, bundled in repo root): **that endpoint does not exist** — only `GET` is defined on that path.

The only content-write primitives anywhere in the spec are:
- `POST /spaces/{spaceId}/content/import` (whole-space) and the change-request-scoped twin `POST .../change-requests/{id}/content/import`
- `POST /spaces/{spaceId}/content/page/{pageId}/import` (single page) and its change-request-scoped twin

All four are **URL-fetch importers** (`{url, source}` where `source` ∈ markdown/docx/html/zip/confluence/notion/etc) — not a "set this page's markdown to this string" call. Tested live against the Tech space (`K32OUBfz4m5TdUcMdwuS`), all four combinations (CR-scoped vs space-scoped, `data:` URI vs real public HTTPS URL):

```
POST .../change-requests/{id}/content/page/{pageId}/import  →  404 "API operation not found"
POST .../content/page/{pageId}/import (no CR)                →  404 "API operation not found"
POST .../change-requests/{id}/content/import                 →  404 "API operation not found"
POST .../change-requests/{id}/content/import (real HTTPS url) → 404 "API operation not found"
```

Spec is tagged `0.0.1-beta` — these import endpoints are documented but evidently not deployed/enabled for this account. Test change request (`#13`, "mcp-test: probe import mechanism") was archived via `PATCH .../change-requests/{id} {status:"archived"}` after the probe — no orphaned drafts left in the Tech space.

Other endpoints that do exist for content sync: `POST /spaces/{spaceId}/git/import` and `git/export` (whole-space git sync). Not explored — different model entirely (git repo as source of truth, GitBook pulls/pushes wholesale, not a per-page API write). Worth a fresh design pass if write capability gets revisited.

**Decision (user, 2026-06-30):** ship read-only v1 now. Revisit write capability later if GitBook ships real `content/import` support, or via the git-sync route as a separate design.

## 10. v2 design — semi-automated drafting (2026-06-30)

Full requirements: `claudedocs/requirements_gitbook-mcp-v2-write.md`. Summary of the locked decisions this design builds on: Tech space only, synchronous in-session trigger, no GitBook API write call of any kind, no git-sync, public docs space (`Relatórios em Python`, `4enQ5nGf8OInfkQDrZoR`) never touched.

### 10.1 Mechanism: new MCP prompt, not a Claude Code skill

Add a 7th `server.prompt()` to the existing gitbook-mcp server, alongside the 6 already shipped (`fetch_documentation`, `analyze_content_gaps`, `content_audit`, `documentation_summary`, `content_optimization`, `troubleshooting_assistant`). Rejected a Claude-Code-only skill/CLAUDE.md instruction:

| | MCP prompt (chosen) | Claude Code skill |
|---|---|---|
| Portability | Works in any MCP client (Claude Desktop, VS Code Copilot, JetBrains) | Claude Code only |
| Fits existing pattern | Same mechanism as the 6 shipped prompts — these are already exactly "templated instructions that guide an LLM through read-only tool calls, no write capability" | New, separate mechanism alongside the server |
| Effort | One more `server.prompt()` call, same shape as the existing 6 | New skill file + registration path |

A prompt doesn't *enforce* anything — it returns a templated text message that becomes a user-role turn, and the calling LLM decides whether to follow it. That's fine here: there is no write tool to call, so the worst case of an ignored instruction is a badly-drafted suggestion, not a wiki mutation. The human pasting it into GitBook is the actual safety boundary, not the prompt text.

### 10.2 Sequence

```
User                Claude                    gitbook-mcp prompt          gitbook-mcp tools (existing, read-only)
 │ "update the VPN     │                            │                              │
 │  page, IP changed"  │                            │                              │
 │────────────────────►│                            │                              │
 │                     │ invoke propose_page_edit   │                              │
 │                     │ (pagePath, changeDescription)                             │
 │                     │───────────────────────────►│                              │
 │                     │                            │ [space excluded? → refusal]  │
 │                     │◄─── templated instructions ┤                              │
 │                     │                            │                              │
 │                     │ get_page_by_path(pagePath) ───────────────────────────────►│
 │                     │◄────────────────────────────────────────── current content │
 │                     │ [exists → update mode; else → get_space_content for       │
 │                     │  placement, create mode]    ───────────────────────────────►│
 │                     │◄────────────────────────────────────────── page tree       │
 │                     │ drafts markdown + change summary / placement rationale     │
 │◄────────────────────│ (target title/path/url, draft, "NOT APPLIED — paste it")   │
 │                     │                            │                              │
 │  pastes into GitBook UI manually — outside MCP scope                            │
```

### 10.3 Prompt interface

**Name**: `propose_page_edit`

**Parameters**:
```
spaceId           string, optional — falls back to GITBOOK_SPACE_ID (defaults to Tech space)
pagePath          string, optional — existing page to update, or intended path for a new page.
                  Omit entirely for "new page, no path decided yet".
changeDescription string, required — what should change, e.g. "VPN IPs changed, update with new values"
                  or "document the new staging deploy process"
```

No `mode` param — the prompt's instructions tell Claude to check existence via `get_page_by_path` first and branch (update vs create) from that, rather than trusting a caller-supplied flag that could be wrong.

**Returned message structure** (content spec, not literal code — exact wording is an `/sc:implement` detail):
1. Space-exclusion check instruction: if `effectiveSpaceId` matches the excluded-space list, the entire returned message is a refusal explaining the public docs space uses its own reviewed git-sync flow and is out of scope — no further steps.
2. Otherwise, step-by-step instructions: call `get_page_by_path` (if `pagePath` given) to determine update-vs-create; for update, also fetch current content and produce a change summary against it; for create, call `get_space_content` and propose one placement with reasoning, inviting correction rather than asserting it as final.
3. Required output shape for Claude's final response to the user: **Target** (title, path, GitBook `urls.app` link), **Mode** (update/create), **Draft** (markdown), **Change summary** (update) or **Placement rationale** (create), and an explicit **"Not applied — paste this into GitBook yourself"** closing line.

### 10.4 Space-exclusion guard

New optional env var `GITBOOK_EXCLUDED_SPACE_IDS` (comma-separated), defaulting to `4enQ5nGf8OInfkQDrZoR` (`Relatórios em Python`) if unset — same config-via-env philosophy as `GITBOOK_SPACE_ID`/`GITBOOK_ORGANIZATION_ID`. Checked at the top of the prompt handler before any instructional text is generated.

Caveat, stated plainly: this is a textual guard inside a prompt response, not a server-enforced block — there's no write tool in this design for a "deny" to gate at the API-call level. Defense-in-depth here is: (1) the prompt refuses in writing, (2) nothing is ever auto-applied regardless of space, a human always pastes manually and sees the target URL first.

### 10.5 Resolved open questions (from requirements doc)

- **Placement prescriptiveness**: confident single proposal + invites correction (§10.3, point 2) — not a multi-choice menu, not an unchallengeable assertion.
- **Batch**: out of scope for v2. The prompt is single-page per invocation; multi-page requests are handled by the user/Claude invoking it conversationally more than once. Revisit only if that proves annoying in practice.

## Next step

Done — `propose_page_edit` shipped as 7th prompt in `src/index.ts`, `GITBOOK_EXCLUDED_SPACE_IDS` wired, README and PROMPTS.md updated.
