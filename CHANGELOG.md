# Changelog

## [0.20.1] - 2026-07
- **Security hardening (fork)**: two-step confirmation for destructive operations (`deleteNotes`, `deleteMediaFile`, `clearUnusedTags`) via `ConfirmationService` + `confirmAction` tool.
- **API key authentication** for HTTP mode (`ApiKeyGuard` — supports `Authorization: Bearer`, `X-API-Key`, and `?api_key=`).
- **Audit logging** to `~/.anki-mcp-server/audit.log` for all destructive actions.
- **Idempotency support** to prevent duplicate note creation on retries.
- **Rate limiting** guard for HTTP transport.
- **Fix**: field-name mapping in `app.module.ts` (`url` → `ankiConnectUrl`) that caused AnkiConnect URL to be `undefined`.
- **Tooling**: added `scripts/health-check.mjs` environment diagnostic and `scripts/start-stdio.cmd` Windows launcher (no PATH required).
- **Docs**: added CONTRIBUTING.md, CODE_OF_CONDUCT.md, GitHub issue/PR templates, dependabot.yml; reorganized debug docs into `docs/`.
- **Config**: `server.json` version sync (0.18.4 → 0.20.1); `trae-mcp-config.json` cleaned as a portable template.
- **README**: expanded Troubleshooting with PATH issues, space-in-path, AnkiConnect, and Trae configuration sections.

## [0.18.0] - 2026-04
- `changeDeck` + `rate_card` now validate card IDs via `cardsInfo` before mutation (was silent-success on invalid IDs).
- `collection_stats` + `deckStats` add an `other` bucket so `total == new + learning + review + other` (captures suspended/buried cards); `per_deck` invariant: length always matches `total_decks`.
- `createDeck` distinguishes "created parent" vs "found existing parent" in message + adds `parentExisted` field.
- `get_due_cards` with `include_new: true` reports `"X cards (Y new, Z due)"` instead of mislabeling all as due.
- `addNote`: duplicate errors suggest `allowDuplicate: true`; response reports `duplicateCheckScope: "none"` when duplicates allowed.
- `addNotes` description narrowed — partial success covers duplicates only; validation errors reject the batch.
- Consolidated shared `AnkiDeckStatsResponse` into `src/mcp/types/anki.types.ts`.
- Fixed stale snake_case references to camelCase tool names across hints, prompts, and GUI tools.

## [0.17.0] - 2026-04
- Relicensed from AGPL-3.0-or-later to MIT
- Fixed manifest.json `author.url` to point at GitHub profile (required by Anthropic MCPB directory)

## [0.15.1] - 2026-04
- Optimize README hero image; fix npm upgrade crash in publish workflows (npm/cli#9151).

## [0.15.0] - 2026-03
- Media path-traversal and SSRF protection; E2E tests for media security guards; switch npm publishing to OIDC Trusted Publishing.

## [0.14.0] - 2026-02
- Improve MCP tool definitions for toolbench score; add bulk `addNotes` tool; fix deck stats resolution for child decks.

---

Release notes for `@ankimcp/anki-mcp-server` are maintained as
[GitHub Releases](https://github.com/ankimcp/anki-mcp-server/releases),
auto-generated from merged PRs per `release.yml`'s `generate_release_notes: true`.

For the changes in a given version, see the corresponding release on GitHub.

## Versioning

Semantic versioning. Currently in 0.x.x beta — breaking changes are
permitted per the versioning notes in `README.md`.
