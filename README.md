# meshcore-ts

A typed, ergonomic TypeScript wrapper around
[`@liamcottle/meshcore.js`](https://github.com/meshcore-dev/meshcore.js) for
talking to [MeshCore](https://meshcore.co.uk) Companion Radio devices from
Node.js over **TCP/WiFi** or **USB serial**.

It wraps the underlying library so you get:

- **Named, typed events** instead of raw numeric byte codes
  (`client.on("contactMessage", …)` rather than `connection.on(0x83, …)`).
- **Typed data models** — `Contact`, `SelfInfo`, `Channel`, `RepeaterStats`, …
- **Normalized values** — public keys/paths/secrets as hex strings, timestamps
  as `Date`s, flags as `boolean`s.
- **Real errors** — `MeshCoreError`, `MeshCoreDeviceError`, `MeshCoreTimeoutError`
  instead of bare `reject()` / string rejections, plus request timeouts so a
  silent device never hangs your program forever.

The raw connection is always reachable via `client.raw` as an escape hatch.

## Install

```sh
bun add meshcore-ts          # or: npm install meshcore-ts
```

`@liamcottle/meshcore.js` is a dependency and is installed automatically. This
package is **ESM-only** and targets **Node.js ≥ 18**.

## Usage

```ts
import { MeshCoreClient, TxtType } from "meshcore-ts";

// Connect over TCP/WiFi …
const client = MeshCoreClient.tcp("192.168.1.50", 5000);
// … or over USB serial:
// const client = MeshCoreClient.serial("/dev/ttyACM0");

client.on("contactMessage", (msg) => {
  console.log(`${msg.pubKeyPrefix}: ${msg.text}`);
});

await client.connect();

const self = await client.getSelfInfo();
console.log(`I am "${self.name}" — ${self.publicKey}`);

const contacts = await client.getContacts();
const alice = contacts.find((c) => c.advName === "alice");
if (alice) {
  await client.sendTextMessage(alice, "hello from typescript", TxtType.Plain);
}

await client.close();
```

### Receiving messages

When the device signals waiting messages, the client (by default) automatically
drains them and emits typed events:

```ts
client.on("contactMessage", (msg) => { /* direct message */ });
client.on("channelMessage", (msg) => { /* channel message */ });
client.on("channelData", (data) => { /* raw channel datagram */ });
```

Prefer to pull manually? Construct with `{ autoSync: false }` and call
`await client.getWaitingMessages()` yourself (e.g. on the `msgWaiting` event).

### Options

```ts
const client = MeshCoreClient.tcp(host, port, {
  requestTimeoutMs: 10_000, // timeout for requests the device might never answer
  autoSync: true,           // auto-drain + emit on msgWaiting
});
```

## API surface

`MeshCoreClient` exposes typed wrappers for the full meshcore.js high-level API,
including: `getSelfInfo`, `getContacts` / `findContactByName` /
`findContactByPublicKeyPrefix`, `sendTextMessage`, `sendChannelTextMessage`,
`getWaitingMessages` / `syncNextMessage`, device time
(`getDeviceTime` / `setDeviceTime` / `syncDeviceTime`), contact management
(`import`/`export`/`share`/`remove`/`addOrUpdateContact`/`setContactPath`/
`resetPath`), advertising and radio config (`sendAdvert`/`sendFloodAdvert`/
`sendZeroHopAdvert`/`setAdvertName`/`setAdvertLatLong`/`setTxPower`/
`setRadioParams`), device info (`reboot`/`getBatteryVoltage`/`deviceQuery`/
`exportPrivateKey`/`importPrivateKey`), remote server interactions
(`login`/`getStatus`/`getTelemetry`/`sendBinaryRequest`/`getNeighbours`),
channels (`getChannel`/`getChannels`/`setChannel`/`deleteChannel`/
`findChannelByName`/`findChannelBySecret`), and `getStats`/`sign`/`tracePath`.

Inputs that take a contact accept a `Contact`, a hex public-key string, or raw
`Uint8Array` bytes (`ContactRef`).

## Examples

- [`examples/list-contacts.ts`](examples/list-contacts.ts) — connect, print self info + contacts.
- [`examples/monitor.ts`](examples/monitor.ts) — live, color-coded traffic monitor for a node.

```sh
bun examples/monitor.ts 172.16.0.23 5000        # monitor until Ctrl-C
bun examples/monitor.ts 172.16.0.23 5000 30     # ...for 30 seconds
```

## Development

```sh
bun install
bun run typecheck   # tsc --noEmit (strict)
bun run test        # vitest unit tests (no hardware needed)
bun run build       # emit dist/ (ESM + .d.ts)
```

## License

MIT
