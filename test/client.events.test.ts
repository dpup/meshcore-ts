import { Constants } from "@liamcottle/meshcore.js";
import { describe, expect, it } from "vitest";
import { MeshCoreClient } from "../src/client.js";
import type { MeshCoreEvents } from "../src/events.js";
import { FakeConnection } from "./fake-connection.js";

/** Resolve with the payload of the next emission of `event`. */
function nextEvent<K extends keyof MeshCoreEvents & string>(
  client: MeshCoreClient,
  event: K,
): Promise<MeshCoreEvents[K]> {
  return new Promise((resolve) => {
    client.once(event, ((...args: MeshCoreEvents[K]) => resolve(args)) as never);
  });
}

describe("MeshCoreClient event mapping", () => {
  it("passes through connected / disconnected", async () => {
    const fake = new FakeConnection();
    const client = new MeshCoreClient(fake.asConnection(), { autoSync: false });

    const connected = nextEvent(client, "connected");
    fake.emitRaw("connected");
    await connected;

    const disconnected = nextEvent(client, "disconnected");
    fake.emitRaw("disconnected");
    await disconnected;
  });

  it("maps an Advert push to a named event with a hex public key", async () => {
    const fake = new FakeConnection();
    const client = new MeshCoreClient(fake.asConnection(), { autoSync: false });

    const advert = nextEvent(client, "advert");
    fake.emitRaw(Constants.PushCodes.Advert, { publicKey: new Uint8Array(32).fill(0xab) });
    const [info] = await advert;
    expect(info.publicKey).toBe("ab".repeat(32));
  });

  it("maps a NewAdvert push with a Date timestamp and hex key", async () => {
    const fake = new FakeConnection();
    const client = new MeshCoreClient(fake.asConnection(), { autoSync: false });

    const newAdvert = nextEvent(client, "newAdvert");
    fake.emitRaw(Constants.PushCodes.NewAdvert, {
      publicKey: new Uint8Array(32).fill(0x01),
      type: Constants.AdvType.Chat,
      flags: 0,
      outPathLen: 0,
      outPath: new Uint8Array(64),
      advName: "node-a",
      lastAdvert: 1_700_000_000,
      advLat: 0,
      advLon: 0,
      lastMod: 1_700_000_001,
    });
    const [info] = await newAdvert;
    expect(info.advName).toBe("node-a");
    expect(info.publicKey).toBe("01".repeat(32));
    expect(info.lastAdvert).toBeInstanceOf(Date);
    expect(info.lastAdvert.getTime()).toBe(1_700_000_000 * 1000);
  });

  it("normalizes traceData pathSnrs as signed quarter-dB values", async () => {
    const fake = new FakeConnection();
    const client = new MeshCoreClient(fake.asConnection(), { autoSync: false });

    const trace = nextEvent(client, "traceData");
    fake.emitRaw(Constants.PushCodes.TraceData, {
      reserved: 0,
      pathLen: 1,
      flags: 0,
      tag: 7,
      authCode: 0,
      pathHashes: new Uint8Array([0xaa]),
      pathSnrs: new Uint8Array([0xf8]), // -8 as int8, ÷4 = -2.0
      lastSnr: -2,
    });
    const [info] = await trace;
    expect(info.pathHashes).toBe("aa");
    expect(info.pathSnrs).toEqual([-2]);
  });

  it("auto-syncs on MsgWaiting and emits a normalized contactMessage", async () => {
    const fake = new FakeConnection();
    fake.getWaitingMessages = async () => [
      {
        contactMessage: {
          pubKeyPrefix: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]),
          pathLen: 0,
          txtType: Constants.TxtTypes.Plain,
          senderTimestamp: 1_700_000_000,
          text: "hello",
        },
      },
    ];
    const client = new MeshCoreClient(fake.asConnection(), { autoSync: true });

    const message = nextEvent(client, "contactMessage");
    fake.emitRaw(Constants.PushCodes.MsgWaiting);
    const [msg] = await message;
    expect(msg.text).toBe("hello");
    expect(msg.pubKeyPrefix).toBe("010203040506");
    expect(msg.senderTimestamp).toBeInstanceOf(Date);
  });

  it("re-drains when a msgWaiting arrives mid-drain (no message stranded)", async () => {
    const mkMsg = (text: string) => ({
      contactMessage: {
        pubKeyPrefix: new Uint8Array(6),
        pathLen: 0,
        txtType: Constants.TxtTypes.Plain,
        senderTimestamp: 1_700_000_000,
        text,
      },
    });

    const fake = new FakeConnection();
    let call = 0;
    fake.getWaitingMessages = async () => {
      const current = call++;
      if (current === 0) {
        // A new push lands while we're still draining the first batch.
        fake.emitRawSync(Constants.PushCodes.MsgWaiting);
        return [mkMsg("first")];
      }
      if (current === 1) return [mkMsg("second")];
      return [];
    };

    const client = new MeshCoreClient(fake.asConnection(), { autoSync: true });
    const received: string[] = [];
    client.on("contactMessage", (m) => received.push(m.text));

    fake.emitRawSync(Constants.PushCodes.MsgWaiting);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(received).toEqual(["first", "second"]);
  });
});

describe("MeshCoreClient normalization", () => {
  it("normalizes contacts to hex keys and Date timestamps", async () => {
    const fake = new FakeConnection();
    fake.getContacts = async () => [
      {
        publicKey: new Uint8Array(32).fill(0x0a),
        type: Constants.AdvType.Repeater,
        flags: 1,
        outPathLen: 2,
        outPath: Uint8Array.from([0x11, 0x22, ...new Array(62).fill(0)]),
        advName: "repeater-1",
        lastAdvert: 1_700_000_000,
        advLat: 12_345,
        advLon: 67_890,
        lastMod: 1_700_000_500,
      },
    ];
    const client = new MeshCoreClient(fake.asConnection(), { autoSync: false });

    const contacts = await client.getContacts();
    expect(contacts).toHaveLength(1);
    const contact = contacts[0]!;
    expect(contact.publicKey).toBe("0a".repeat(32));
    expect(contact.advName).toBe("repeater-1");
    expect(contact.outPath).toBe("1122"); // trimmed to outPathLen
    expect(contact.lastAdvert).toBeInstanceOf(Date);
  });
});
