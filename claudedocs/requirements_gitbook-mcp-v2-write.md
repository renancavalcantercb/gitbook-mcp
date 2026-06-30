# GitBook MCP v2 — Write Capability Requirements

Status: requirements + design complete. Not implemented. Next: `/sc:implement` (see `DESIGN.md` §10).

## Context (why this looks different from the v1 write attempt)

v1's write design (DESIGN.md §4/§9) assumed all writes should go through GitBook Change Requests, and got blocked because GitBook's REST API has no endpoint to set page content at all — `content/import` and its CR-scoped twin both 404 regardless of payload (data: URI or real HTTPS URL), tested live against the Tech space.

New context from this session changes the target, not the blocker:

- Most internal docs (Tech, Wiki, Onboarding, Wiki do Marketing, etc.) are edited **directly in the GitBook UI, applied immediately, no review** — that's today's normal workflow, not a gap to fix.
- Only the public, customer-facing docs space (`Relatórios em Python`, git-synced, 23 change requests / 11 draft) uses the PR/CR-gated flow — **explicitly out of scope, not to be touched**.
- So v2 doesn't need a review gate. But it still needs *some* way to get content into a page, and the only REST write surface GitBook exposes (`content/import`) is confirmed dead. The remaining unexplored surface, `git/import`/`git/export`, was considered and **rejected**: it requires connecting the target space to a git repo (an org-level integration change), and in this org git-sync is itself tied to the CR-gated flow (see the public-docs space's CR count) — heavier setup for a worse fit than what's wanted.

## Decision (user, this session)

Ship **semi-automated** v2: Claude drafts the markdown and tells the user exactly where to put it; the human pastes it into the GitBook UI themselves. No GitBook API write call of any kind. No new auth, no new GitBook capability, no git-sync.

Explicitly **not** chosen this round (real options, deferred not dismissed):
- Reverse-engineering GitBook's internal editor/live-collaboration API — undocumented, breaks without notice, likely different auth model than a PAT.
- Browser automation of the GitBook editor (Playwright driving the real UI) — no reverse-engineering, but fragile to UI changes, needs a logged-in session.
- Filing a GitBook support ticket asking if `content/import` is plan-gated/roadmapped — cheap, can still be done independently of whatever v2 ships.

## Scope

- **Space**: Tech (`K32OUBfz4m5TdUcMdwuS`) only, for v2. Same parametrization pattern as existing read tools (`spaceId` param, env default) means expanding to other internal spaces later is a config change, not a redesign.
- **Trigger**: synchronous, inside a Claude Code session — e.g. "update the Tech wiki VPN page, the IP changed" mid-conversation, Claude responds with the draft right then. Not async/batch/queued.
- **Hard exclusion**: the public docs space (`Relatórios em Python`) is never touched by this capability, full stop.

## Functional requirements

- **FR1 — Draft, don't write**: given a request to create or update a Tech-space page, Claude drafts markdown content. It never calls a GitBook write endpoint (there isn't a working one anyway).
- **FR2 — Match existing voice**: for updates, Claude reads the current page (`get_page_content`/`get_page_by_path`, already shipped in v1) and drafts a change that matches the existing page's style/structure, not a wholesale rewrite unless asked.
- **FR3 — Exact paste target**: output always includes the page title, path, and the GitBook app URL (`urls.app`, already returned by existing read tools) so the human can navigate and paste in one motion — no ambiguity about where the change goes.
- **FR4 — Change summary for updates**: for edits to an existing page, show what's changing (added/removed/reworded) relative to current content, not just a wall of new markdown — so the human can sanity-check before pasting.
- **FR5 — Placement proposal for new pages**: for a brand-new page, Claude proposes where it fits in the existing tree (using `get_space_content`, already shipped) and says so explicitly — it does not create anything, the human places it.
- **FR6 — No silent "it's done" framing**: every response from this flow must be unambiguous that nothing was applied — it's a draft awaiting a manual paste.

## Non-functional requirements

- **NFR1**: Zero new GitBook API surface, zero new auth/credentials beyond what v1 already uses (`GITBOOK_API_TOKEN`).
- **NFR2**: Never operate against the public docs space, even if asked — should be a hard guard, not just a convention.
- **NFR3**: Mechanism should generalize to other internal spaces later via the same `spaceId` parametrization v1 already uses — don't hardcode Tech-space specifics into the design.

## Out of scope (v2)

- Any direct GitBook API write call (proven nonfunctional today, see DESIGN.md §9).
- Git-sync-based automation (rejected this round — org-level integration change, still CR-gated by GitBook's own model).
- Browser automation / reverse-engineered private API (not chosen this round — candidate for a future v3 if semi-automated proves insufficient).
- The public/official docs space, under any circumstance.

## Open questions — resolved in design

See `DESIGN.md` §10 for the full design. Summary of resolutions:

1. **Mechanism**: new MCP prompt (`propose_page_edit`), not a Claude Code skill — portability won, and it matches the existing 6-prompt pattern already in the codebase.
2. **Placement prescriptiveness**: confident single proposal, inviting correction — not a menu, not an unchallengeable assertion.
3. **Batch**: out of scope for v2, single-page per invocation. Revisit only if conversational repetition proves annoying in practice.
