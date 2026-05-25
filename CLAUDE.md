# CLAUDE.md

Project guidance for Claude Code lives in **[AGENTS.md](./AGENTS.md)** — read it
first. It covers the architecture, conventions, and hard-won gotchas.

## TL;DR

- Typed wrapper around the untyped, ESM-only `@liamcottle/meshcore.js`. We delegate
  to the raw `Connection` and add typed events, normalized data, and error/timeout
  handling — we do not reimplement the protocol.
- Verify changes with: `bun run typecheck` · `bun run test` · `bun run build`.
- ESM-only, Node ≥ 18, `NodeNext`, `verbatimModuleSyntax`, `strict` — use `.js`
  import extensions and split `import type` / `export type`.

## Don't-regress list (details in AGENTS.md)

1. Never emit the `error` event unguarded from a detached context (Node throws
   with no listener) — `drainAndEmit` checks `listenerCount`.
2. The `dist` type shim is fragile: `scripts/postbuild.mjs` copies
   `src/meshcore.d.ts` into `dist/` and prepends a `/// <reference>` to
   `dist/index.d.ts`. Changing packaging? Compile a throwaway consumer against
   `dist/` to confirm no `TS7016`.
3. `fromHex` validates input up front (`parseInt` would silently truncate).
4. Device-timeout methods (`login`/`getStatus`/`getTelemetry`/`sendBinaryRequest`/
   `tracePath`) pass `null` to `request()` so they aren't double-timed-out.
5. Response code `0x11` is unhandled upstream — intentionally left alone; do not
   band-aid the core lib.

## Memory

Cross-session notes (e.g. the live test node, the `0x11` upstream gap) are in the
agent memory index for this project — check it before re-investigating hardware
behavior.
