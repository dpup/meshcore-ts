# meshcore-ts

> A typed, ergonomic TypeScript client for [MeshCore](https://meshcore.co.uk) Companion Radio devices.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Types: included](https://img.shields.io/badge/types-included-blue.svg)](#)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](#)
[![Module: ESM](https://img.shields.io/badge/module-ESM-f7df1e.svg)](#)

`meshcore-ts` wraps [`@liamcottle/meshcore.js`](https://github.com/meshcore-dev/meshcore.js)
with first-class TypeScript types, named events, and a clean promise-based API —
so you can talk to a MeshCore node over WiFi or USB without wrangling raw numeric
byte codes and `Uint8Array`s.

```ts
import { MeshCoreClient } from "meshcore-ts";

const client = MeshCoreClient.tcp("192.168.1.50", 5000);
client.on("contactMessage", (msg) => console.log(`${msg.pubKeyPrefix}: ${msg.text}`));

await client.connect();
const contacts = await client.getContacts();
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
npm install meshcore-ts      # or: bun add meshcore-ts / pnpm add meshcore-ts
```

ESM-only, **Node.js ≥ 18**. The `@liamcottle/meshcore.js` dependency is installed automatically.

## Quick start

```ts
import { MeshCoreClient, TxtType } from "meshcore-ts";

// Connect over TCP/WiFi …
const client = MeshCoreClient.tcp("192.168.1.50", 5000);
// … or USB serial:
// const client = MeshCoreClient.serial("/dev/ttyACM0");

await client.connect();

const self = await client.getSelfInfo();
console.log(`Connected to "${self.name}" — ${self.publicKey}`);

const alice = await client.findContactByName("alice");
if (alice) {
  await client.sendTextMessage(alice, "hello from typescript", TxtType.Plain);
}

await client.close();
```

Any method that takes a contact accepts a `Contact`, a hex public-key string, or
raw `Uint8Array` bytes.

## Events

By default the client auto-drains the device's message queue on `msgWaiting` and
emits typed events. Set `{ autoSync: false }` to pull manually with
`getWaitingMessages()`.

| Event | Payload | When |
| --- | --- | --- |
| `connected` / `disconnected` | — | connection lifecycle |
| `contactMessage` / `channelMessage` | `ContactMessage` / `ChannelMessage` | an incoming message |
| `channelData` | `ChannelData` | a channel datagram |
| `advert` / `newAdvert` | `Advert` / `NewAdvert` | a node advertised |
| `pathUpdated` | `{ publicKey }` | a contact's path changed |
| `rawData` / `logRxData` | `RawData` / `LogRxData` | received packets (with SNR/RSSI) |
| `traceData` | `TraceData` | a path trace returned |
| `telemetryResponse` / `statusResponse` / `binaryResponse` | typed payloads | server responses |
| `sendConfirmed` / `loginSuccess` | typed payloads | send ack / login |
| `error` | `Error` | a surfaced async failure (e.g. a failed auto-sync) |

```ts
const client = MeshCoreClient.tcp(host, port, {
  requestTimeoutMs: 10_000, // timeout for requests a device might never answer
  autoSync: true,           // auto-drain + emit on msgWaiting
});
```

## API

`MeshCoreClient` provides typed wrappers across the full companion API:

- **Device** — `getSelfInfo`, `getDeviceTime` / `setDeviceTime` / `syncDeviceTime`, `getBatteryVoltage`, `deviceQuery`, `reboot`, `exportPrivateKey` / `importPrivateKey`
- **Contacts** — `getContacts`, `findContactByName`, `findContactByPublicKeyPrefix`, `import` / `export` / `share` / `remove` / `addOrUpdateContact`, `setContactPath`, `resetPath`, `setAutoAddContacts` / `setManualAddContacts`
- **Messaging** — `sendTextMessage`, `sendChannelTextMessage`, `syncNextMessage`, `getWaitingMessages`
- **Channels** — `getChannel` / `getChannels` / `setChannel` / `deleteChannel`, `findChannelByName` / `findChannelBySecret`
- **Radio & adverts** — `sendAdvert` / `sendFloodAdvert` / `sendZeroHopAdvert`, `setAdvertName`, `setAdvertLatLong`, `setTxPower`, `setRadioParams`
- **Remote nodes** — `login`, `getStatus`, `getTelemetry`, `getNeighbours`, `sendBinaryRequest`
- **Misc** — `getStats` / `getStatsCore` / `getStatsRadio` / `getStatsPackets`, `sign`, `tracePath`

All are fully typed; your editor's autocomplete is the reference.

## Examples

- [`examples/list-contacts.ts`](examples/list-contacts.ts) — connect and print self info + contacts.
- [`examples/monitor.ts`](examples/monitor.ts) — a live, color-coded traffic monitor.

```sh
bun examples/monitor.ts 172.16.0.23 5000        # monitor until Ctrl-C
bun examples/monitor.ts 172.16.0.23 5000 30     # …for 30 seconds
```

## Notes

- **ESM-only / Node-only.** This mirrors `meshcore.js` (itself ESM-only) and keeps
  the `serialport` dependency out of browser bundles. Browser BLE/WebSerial
  transports are intentionally not exposed.
- **Values are normalized.** Keys/paths/secrets are hex strings and timestamps are
  `Date`s; the wrapper converts back when sending. The raw connection remains
  available via `client.raw` for anything unwrapped.

## Development

```sh
bun install
bun run typecheck   # tsc --noEmit (strict)
bun run test        # vitest unit tests (no hardware needed)
bun run build       # emit dist/ (ESM + .d.ts)
```

See [AGENTS.md](./AGENTS.md) for architecture and contribution notes.

## License

[MIT](./LICENSE) © Dan Pupius
