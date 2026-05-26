# Guide

Concepts and recipes for `@dpup/meshcore-ts`. For exhaustive signatures, types,
events, and errors, see the generated [API reference](./api.md).

## Connecting

Create a client with a transport factory, then `connect()`:

```ts
import { MeshCoreClient } from "@dpup/meshcore-ts";

const client = MeshCoreClient.tcp("192.168.1.50", 5000); // WiFi
// const client = MeshCoreClient.serial("/dev/ttyACM0");  // USB serial

await client.connect();   // resolves once the device reports "connected"
// … use the client …
await client.close();
```

`connect()` rejects with a `MeshCoreTimeoutError` if the device doesn't report
ready within `requestTimeoutMs`. Note that the underlying transports only log
low-level socket errors (e.g. `ECONNREFUSED`) rather than surfacing them, so a
failed connection appears as a timeout rather than the specific error. When
debugging a failed connect, check the host/port/reachability and look at stderr
for the underlying socket error the transport logged there.

### Reconnecting

Each `connect()` opens a fresh transport socket, so after a `disconnected` event
you can call `client.connect()` again to reconnect on the same client:

```ts
client.on("disconnected", async () => {
  try {
    await client.connect();
  } catch {
    // still down — back off and retry, or recreate the client
  }
});
```

If reconnection on an existing client misbehaves, create a fresh one with
`MeshCoreClient.tcp(…)` (or `.serial(…)`) and connect that instead.

### Options

```ts
MeshCoreClient.tcp(host, port, {
  requestTimeoutMs: 10_000, // timeout for requests a device might never answer
  autoSync: true,           // auto-drain + emit message events on msgWaiting
});
```

## Events

Public keys, paths, and secrets are lowercase hex strings; `pubKeyPrefix` is the
first 6 bytes of a public key, hex-encoded.

The client is a typed event emitter. Subscribe with `on` / `once` / `off`:

```ts
client.on("contactMessage", (msg) => console.log(`${msg.pubKeyPrefix}: ${msg.text}`));
client.on("advert", (a) => console.log("heard", a.publicKey));
```

| Event | Payload | Fires when |
| --- | --- | --- |
| `connected` / `disconnected` | — | connection lifecycle |
| `rx` | `Uint8Array` | every frame received from the device (the raw frame) |
| `contactMessage` / `channelMessage` | `ContactMessage` / `ChannelMessage` | an incoming message is drained |
| `channelData` | `ChannelData` | a channel datagram is drained |
| `msgWaiting` | — | the device has messages waiting (triggers auto-sync) |
| `advert` / `newAdvert` | `Advert` / `NewAdvert` | a node advertises |
| `pathUpdated` | `{ publicKey }` | a contact's path changes |
| `rawData` / `logRxData` | `RawData` / `LogRxData` | a packet is received (with SNR/RSSI) |
| `traceData` | `TraceData` | a path trace returns |
| `telemetryResponse` / `statusResponse` / `binaryResponse` | typed payloads | a server responds |
| `sendConfirmed` / `loginSuccess` | typed payloads | a send is acked / login succeeds |
| `error` | `Error` | a surfaced async failure (e.g. a failed auto-sync) |

See [`MeshCoreEvents`](./api.md#meshcoreevents) for exact payload types.

### Receiving messages

When the device signals waiting messages, the client (with `autoSync: true`, the
default) drains the queue and emits `contactMessage` / `channelMessage` /
`channelData`. To pull manually instead, set `autoSync: false` and call
`getWaitingMessages()` yourself (e.g. on the `msgWaiting` event):

`getWaitingMessages()` returns `WaitingMessage[]`, a discriminated union with
three arms — `contact` and `channel` carry a `.message`, while `channelData`
carries `.data` (not `.message`). Switch on `kind` to handle all three:

```ts
const client = MeshCoreClient.tcp(host, port, { autoSync: false });
client.on("msgWaiting", async () => {
  for (const m of await client.getWaitingMessages()) {
    switch (m.kind) {
      case "contact":
        console.log(m.message.text);
        break;
      case "channel":
        console.log(`ch${m.message.channelIdx}: ${m.message.text}`);
        break;
      case "channelData":
        console.log(`ch${m.data.channelIdx} datagram (${m.data.data.length}B)`);
        break;
    }
  }
});
```

> **Attach an `error` listener** if `autoSync` is on: a failed background drain
> emits `error`. The client won't crash without one (it logs to stderr instead),
> but you'll miss the error otherwise.

## Messaging

```ts
import { TxtType } from "@dpup/meshcore-ts";

const alice = await client.findContactByName("alice");
if (alice) await client.sendTextMessage(alice, "hello", TxtType.Plain);

await client.sendChannelTextMessage(0, "hello channel");
```

The message type is a `TxtType`: `TxtType.Plain` (0), `TxtType.CliData` (1), or
`TxtType.SignedPlain` (2). `Plain` is the default for `sendTextMessage` when you
omit the argument.

Any method that takes a contact accepts a `Contact`, a hex public-key string, or
raw `Uint8Array` bytes (the `ContactRef` type).

## Contacts & channels

```ts
const contacts = await client.getContacts();          // Contact[]
const chans = await client.getChannels();             // Channel[]
await client.addOrUpdateContact(someContact);
await client.removeContact("a1b2c3…");                // hex key works too
```

## Errors & timeouts

All rejections are normalized to typed errors:

- `MeshCoreTimeoutError` — no device response within the timeout.
- `MeshCoreDeviceError` — the device returned an error (`.code` when available).
- `MeshCoreError` — base class for everything else.

```ts
import { MeshCoreTimeoutError } from "@dpup/meshcore-ts";

try {
  await client.getContacts();
} catch (err) {
  if (err instanceof MeshCoreTimeoutError) { /* retry? */ }
}
```

Requests that the underlying library would otherwise leave hanging forever are
bounded by `requestTimeoutMs`. Remote-node calls (`login`, `getStatus`,
`getTelemetry`, `sendBinaryRequest`, `tracePath`) rely on the device's own
estimated timeout instead.

## Remote nodes

```ts
await client.login(repeater, "password");
const status = await client.getStatus(repeater);      // RepeaterStats
const telem = await client.getTelemetry(sensor);      // Telemetry; LPP bytes on telem.lppSensorData
const { neighbours } = await client.getNeighbours(repeater);
```

## Escape hatch

The underlying `@liamcottle/meshcore.js` connection is always reachable for
anything the wrapper doesn't cover:

```ts
client.raw.someUnwrappedMethod();
```

This is plain (untyped-at-shape) territory — prefer the wrapped, typed methods
where they exist.
