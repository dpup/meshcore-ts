# meshcore-ts

> A typed, ergonomic TypeScript client for [MeshCore](https://meshcore.co.uk) Companion Radio devices.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Types: included](https://img.shields.io/badge/types-included-blue.svg)](#)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](#)
[![Module: ESM](https://img.shields.io/badge/module-ESM-f7df1e.svg)](#)

`meshcore-ts` is a **thin, typed wrapper** over the official
[`@liamcottle/meshcore.js`](https://github.com/meshcore-dev/meshcore.js) — it does
**not** reimplement the protocol. That library does the wire work; this one
delegates to it and adds a first-class TypeScript surface: typed methods, named
events, normalized values, and proper errors. So you talk to a MeshCore node over
WiFi or USB without wrangling raw numeric byte codes and `Uint8Array`s — and you
get upstream protocol updates for free.

```ts
import { MeshCoreClient, TxtType } from "@dpup/meshcore-ts";

const client = MeshCoreClient.tcp("192.168.1.50", 5000); // or .serial("/dev/ttyACM0")
client.on("contactMessage", (msg) => console.log(`${msg.pubKeyPrefix}: ${msg.text}`));

await client.connect();

const self = await client.getSelfInfo();
console.log(`Connected to "${self.name}" — ${self.publicKey}`);

const alice = await client.findContactByName("alice");
if (alice) await client.sendTextMessage(alice, "hello from typescript", TxtType.Plain);
```

## Features

- 🧩 **Fully typed** — typed methods, events, and data models (`Contact`, `Channel`, `SelfInfo`, `RepeaterStats`, …).
- 📡 **Named events** — `client.on("contactMessage", …)` instead of `connection.on(0x83, …)`.
- 🔤 **Normalized data** — hex-string keys & paths, `Date` timestamps, real `boolean` flags.
- 🛡️ **Safe by default** — typed errors (`MeshCoreError` / `…DeviceError` / `…TimeoutError`) and request timeouts so a silent device never hangs your program.
- 🔌 **Node transports** — TCP/WiFi and USB serial, with simple factories.
- 🪝 **Escape hatch** — the raw `meshcore.js` connection stays reachable via `client.raw`.

## Install

```sh
npm install @dpup/meshcore-ts      # or: bun add @dpup/meshcore-ts / pnpm add @dpup/meshcore-ts
```

ESM-only, **Node.js ≥ 18**. The `@liamcottle/meshcore.js` dependency is installed automatically.

## Documentation

- **[Guide](./docs/guide.md)** — concepts and recipes: connecting, events & auto-sync, messaging, contacts, errors & timeouts, remote nodes.
- **[API reference](./docs/api.md)** — the complete, generated reference: every method, event, model, error, and enum with full signatures.

Any method that takes a contact accepts a `Contact`, a hex public-key string, or
raw `Uint8Array` bytes. The client auto-drains incoming messages and emits
`contactMessage` / `channelMessage` / `channelData` events by default — see the
[guide](./docs/guide.md#events) for the full event catalog and options.

## Design notes

- **A wrapper, not a reimplementation.** All protocol logic lives in
  `@liamcottle/meshcore.js`; this package delegates and layers on types,
  normalization, and safety — so it tracks upstream automatically.
- **Node-focused, ESM-only.** Transports are TCP/WiFi and USB serial. This mirrors
  `meshcore.js` and keeps the `serialport` dependency out of browser bundles;
  browser BLE/WebSerial transports are intentionally not exposed.

## Examples

- [`examples/list-contacts.ts`](examples/list-contacts.ts) — connect and print self info + contacts.
- [`examples/monitor.ts`](examples/monitor.ts) — a live, color-coded traffic monitor.

```sh
bun examples/monitor.ts 172.16.0.23 5000 30     # monitor a node for 30 seconds
```

## Development

```sh
bun install
bun run typecheck   # tsc --noEmit (strict)
bun run test        # vitest unit tests (no hardware needed)
bun run build       # emit dist/ (ESM + .d.ts)
bun run docs        # regenerate docs/api.md from the source
```

See [AGENTS.md](./AGENTS.md) for architecture and contribution notes.

## License

[MIT](./LICENSE) © Dan Pupius
