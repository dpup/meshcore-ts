# AGENTS.md

Guidance for AI agents (and humans) working on **meshcore-ts**. Keep this current
when architecture or conventions change.

## What this is

A typed, ergonomic wrapper around the untyped, ESM-only `@liamcottle/meshcore.js`.
We do **not** reimplement the MeshCore protocol — we delegate to the raw
`Connection` and add three things: typed names for its events, normalized
inputs/outputs, and hardened error/timeout behavior.

## Layout

```
src/
  index.ts        Public surface (re-exports). Has a /// <reference> to the shim.
  client.ts       MeshCoreClient — the wrapper. Event binding, normalizers, timeouts.
  models.ts       Normalized data types (Contact, Channel, SelfInfo, …).
  events.ts       MeshCoreEvents map + TypedEventEmitter (wraps node:events).
  enums.ts        Const objects + union types mirroring meshcore.js Constants.
  errors.ts       MeshCoreError / DeviceError / TimeoutError + normalizeRejection.
  hex.ts          toHex / fromHex / toBytes.
  transports.ts   Typed re-export of TCP/serial classes + Constants.
  meshcore.d.ts   Ambient shim typing the untyped dependency (see "Packaging").
scripts/postbuild.mjs   Ships the shim into dist (see "Packaging").
test/             Vitest unit tests + FakeConnection double.
examples/         list-contacts.ts, monitor.ts.
```

## Commands

```sh
bun install
bun run typecheck   # tsc --noEmit (strict, includes src/test/examples)
bun run test        # vitest run
bun run build       # tsc -p tsconfig.build.json + postbuild
```

## Conventions

- **ESM-only, Node-only.** `module`/`moduleResolution: NodeNext`. Import paths use
  `.js` extensions (TS resolves them to `.ts`). `verbatimModuleSyntax` is on, so
  split type-only imports/exports (`import { X, type Y }`, `export type { … }`).
- **strict + `noUncheckedIndexedAccess`.** Indexed reads are `T | undefined`; guard them.
- **Normalization at the boundary.** Public-facing keys/paths/secrets are hex
  strings; human timestamps are `Date`s; flags are `boolean`. Convert back to raw
  bytes/epoch seconds when calling the raw lib.
- **Adding a wrapped method:** route through `this.request(() => this.raw.foo(...), timeoutMs?)`,
  convert `ContactRef`/`Bytes` inputs (`resolveKey`/`toBytes`), and map the raw
  result into a model. Methods that already have a device-side timeout
  (`login`, `getStatus`, `getTelemetry`, `sendBinaryRequest`, `tracePath`) pass
  `null` as the timeout so the wrapper doesn't double-time-out them.

## Gotchas & hard-won learnings

These caused real bugs; don't regress them.

1. **`error` event throws.** Node's `EventEmitter` throws if `"error"` is emitted
   with no listener. `drainAndEmit` runs detached (`void`), so it only emits
   `"error"` when `listenerCount("error") > 0`, else logs. Never emit `"error"`
   unguarded from a detached context.
2. **Packaging / consumer types.** `@liamcottle/meshcore.js` ships no types. The
   ambient `src/meshcore.d.ts` is build-only and tsc strips the `/// <reference>`
   from emitted output — so `scripts/postbuild.mjs` copies the shim into `dist/`
   **and prepends the reference to `dist/index.d.ts`**. Without this, consumers
   (default `skipLibCheck: false`) hit `TS7016`. **Verify any packaging change by
   compiling a throwaway consumer against `dist/`.**
3. **`fromHex` must validate up front.** `parseInt("1z", 16) === 1`, so per-pair
   parsing silently accepts bad input; validate with a regex first.
4. **Upstream quirks the wrapper smooths over:** the raw lib emits numeric event
   codes; `reject()`s with no arg / bare strings (`"timeout"`, `"disabled"`,
   `"data_too_long"`) / `{errCode}` (see `normalizeRejection`); has no timeout on
   `Ok`/`Err` methods (we add `withTimeout`); never cancels in-flight `once`
   listeners (timeouts leak listeners — inherent, documented at `withTimeout`);
   and `connect()` can't see socket errors (the lib only `console.error`s them, so
   a failed connect surfaces as a timeout).
5. **Auto-sync re-entrancy.** A `msgWaiting` arriving mid-drain sets `pendingDrain`
   so the drain loops again; don't drop it.
6. **`pathSnrs`** are decoded as signed `int8 ÷ 4` to match `lastSnr` (the raw lib
   leaves them as unsigned bytes).
7. **Firmware can outrun the lib.** Live testing showed the device emitting
   response code `0x11` (17) that **even the latest meshcore.js (1.13.0) doesn't
   decode**; the message surfaces only as a raw `rx` frame and stalls
   `syncNextMessage` until the timeout. **Decision: leave it — band-aiding over the
   core lib is out of scope.** It'll decode automatically if upstream adds it.

## Testing

- Unit tests use `test/fake-connection.ts` — a real `EventEmitter` with stubbable
  methods. `emitRaw` defers via `setTimeout(0)` to mirror the real lib's async
  dispatch; use `emitRawSync` when a test needs deterministic re-entrancy timing.
- No hardware needed for tests. For live checks, point `examples/monitor.ts` at a
  node. A node may emit nothing passively unless the mesh is active.
