import {
  Constants,
  NodeJSSerialConnection,
  TCPConnection,
  type Connection,
  type RawChannel,
  type RawContact,
  type RawContactMessage,
  type RawChannelData,
  type RawChannelMessage,
  type RawCoreStatsData,
  type RawNeighboursResult,
  type RawPacketStatsData,
  type RawRadioStatsData,
  type RawRepeaterStats,
  type RawSelfInfo,
  type RawStats,
  type RawTelemetryResponse,
  type RawTraceData,
  type RawWaitingMessage,
} from "@liamcottle/meshcore.js";

import {
  AdvType,
  type NeighbourOrder,
  type SelfAdvertType,
  StatsType,
  type TxtType,
} from "./enums.js";
import { MeshCoreError, MeshCoreTimeoutError, normalizeRejection } from "./errors.js";
import { TypedEventEmitter, type MeshCoreEvents } from "./events.js";
import { type Bytes, fromHex, toBytes, toHex } from "./hex.js";
import type {
  BatteryVoltage,
  Channel,
  Contact,
  ContactMessage,
  ChannelData,
  ChannelMessage,
  DeviceInfo,
  Neighbour,
  NeighboursResult,
  RepeaterStats,
  SelfInfo,
  SentResult,
  Stats,
  Telemetry,
  TraceData,
  WaitingMessage,
} from "./models.js";

/** A reference to a contact: a {@link Contact}, a hex public key, or raw bytes. */
export type ContactRef = Contact | Bytes;

/** Options for constructing a {@link MeshCoreClient}. */
export interface ClientOptions {
  /**
   * Timeout (ms) applied to requests that the underlying library would
   * otherwise leave hanging forever if the device never responds.
   * @default 10000
   */
  requestTimeoutMs?: number;
  /**
   * When `true`, a `msgWaiting` push automatically drains the device's message
   * queue and emits `contactMessage` / `channelMessage` / `channelData` events.
   * Set `false` to drive {@link MeshCoreClient.getWaitingMessages} yourself.
   * @default true
   */
  autoSync?: boolean;
}

/** Options for {@link MeshCoreClient.getNeighbours}. */
export interface NeighboursOptions {
  count?: number;
  offset?: number;
  orderBy?: NeighbourOrder;
  pubKeyPrefixLength?: number;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_NEIGHBOUR_PREFIX_LENGTH = 8;

// --- value conversion helpers ---

function epochToDate(epochSecs: number): Date {
  return new Date(epochSecs * 1000);
}

function dateToEpoch(time: Date | number): number {
  return typeof time === "number" ? time : Math.floor(time.getTime() / 1000);
}

function resolveKey(ref: ContactRef): Uint8Array {
  if (typeof ref === "string") return fromHex(ref);
  if (ref instanceof Uint8Array) return ref;
  return fromHex(ref.publicKey);
}

/** Trim a fixed-width raw out path down to its valid length and hex-encode it. */
function encodeOutPath(outPath: Uint8Array, outPathLen: number): string {
  const len = outPathLen > 0 ? Math.min(outPathLen, outPath.length) : 0;
  return toHex(outPath.subarray(0, len));
}

/** Pad/clamp a path to the 64-byte buffer the device expects. */
function padPath(path: Bytes): Uint8Array {
  const bytes = toBytes(path);
  const out = new Uint8Array(64);
  out.set(bytes.subarray(0, 64));
  return out;
}

/**
 * Reject after `ms` if the underlying promise hasn't settled.
 *
 * Note: meshcore.js registers `once` response listeners that it only removes
 * inside its own resolve/reject handlers, and exposes no way to cancel an
 * in-flight request. So when this timeout fires first, the underlying promise
 * keeps running and its listeners stay attached until the device eventually
 * responds (or the connection closes). This is a known upstream limitation;
 * methods that have their own device-side timeout pass `null` to bypass this.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new MeshCoreTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error as Error);
      },
    );
  });
}

// --- raw -> model normalizers ---

function normalizeContact(raw: RawContact): Contact {
  return {
    publicKey: toHex(raw.publicKey),
    type: raw.type as AdvType,
    flags: raw.flags,
    outPathLen: raw.outPathLen,
    outPath: encodeOutPath(raw.outPath, raw.outPathLen),
    advName: raw.advName,
    lastAdvert: epochToDate(raw.lastAdvert),
    advLat: raw.advLat,
    advLon: raw.advLon,
    lastMod: epochToDate(raw.lastMod),
  };
}

function normalizeSelfInfo(raw: RawSelfInfo): SelfInfo {
  return {
    type: raw.type as AdvType,
    txPower: raw.txPower,
    maxTxPower: raw.maxTxPower,
    publicKey: toHex(raw.publicKey),
    advLat: raw.advLat,
    advLon: raw.advLon,
    manualAddContacts: raw.manualAddContacts !== 0,
    radioFreq: raw.radioFreq,
    radioBw: raw.radioBw,
    radioSf: raw.radioSf,
    radioCr: raw.radioCr,
    name: raw.name,
  };
}

function normalizeChannel(raw: RawChannel): Channel {
  return {
    channelIdx: raw.channelIdx,
    name: raw.name,
    secret: toHex(raw.secret),
  };
}

function normalizeContactMessage(raw: RawContactMessage): ContactMessage {
  return {
    pubKeyPrefix: toHex(raw.pubKeyPrefix),
    pathLen: raw.pathLen,
    txtType: raw.txtType as TxtType,
    senderTimestamp: epochToDate(raw.senderTimestamp),
    text: raw.text,
  };
}

function normalizeChannelMessage(raw: RawChannelMessage): ChannelMessage {
  return {
    channelIdx: raw.channelIdx,
    pathLen: raw.pathLen,
    txtType: raw.txtType as TxtType,
    senderTimestamp: epochToDate(raw.senderTimestamp),
    text: raw.text,
  };
}

function normalizeChannelData(raw: RawChannelData): ChannelData {
  return {
    snr: raw.snr,
    channelIdx: raw.channelIdx,
    pathLen: raw.pathLen,
    dataType: raw.dataType,
    data: raw.data,
  };
}

function normalizeWaitingMessage(raw: RawWaitingMessage): WaitingMessage {
  if ("contactMessage" in raw) {
    return { kind: "contact", message: normalizeContactMessage(raw.contactMessage) };
  }
  if ("channelMessage" in raw) {
    return { kind: "channel", message: normalizeChannelMessage(raw.channelMessage) };
  }
  return { kind: "channelData", data: normalizeChannelData(raw.channelData) };
}

function normalizeTraceData(raw: RawTraceData): TraceData {
  return {
    pathLen: raw.pathLen,
    flags: raw.flags,
    tag: raw.tag,
    authCode: raw.authCode,
    pathHashes: toHex(raw.pathHashes),
    // The library reads pathSnrs as raw unsigned bytes but reads the scalar
    // lastSnr as `int8 / 4`. Per-hop SNRs use the same int8-quarter-dB encoding,
    // so we interpret them the same way for a consistent dB value (e.g. 0xF8 -> -2.0).
    pathSnrs: Array.from(raw.pathSnrs, (byte) => ((byte << 24) >> 24) / 4),
    lastSnr: raw.lastSnr,
  };
}

function normalizeRepeaterStats(raw: RawRepeaterStats): RepeaterStats {
  return {
    batteryMilliVolts: raw.batt_milli_volts,
    currTxQueueLen: raw.curr_tx_queue_len,
    noiseFloor: raw.noise_floor,
    lastRssi: raw.last_rssi,
    packetsReceived: raw.n_packets_recv,
    packetsSent: raw.n_packets_sent,
    totalAirTimeSecs: raw.total_air_time_secs,
    totalUpTimeSecs: raw.total_up_time_secs,
    sentFlood: raw.n_sent_flood,
    sentDirect: raw.n_sent_direct,
    recvFlood: raw.n_recv_flood,
    recvDirect: raw.n_recv_direct,
    errEvents: raw.err_events,
    lastSnr: raw.last_snr,
    directDups: raw.n_direct_dups,
    floodDups: raw.n_flood_dups,
  };
}

function normalizeStats(raw: RawStats): Stats {
  switch (raw.type) {
    case StatsType.Core: {
      const d = raw.data as RawCoreStatsData;
      return {
        type: "core",
        batteryMilliVolts: d.batteryMilliVolts,
        uptimeSecs: d.uptimeSecs,
        queueLen: d.queueLen,
      };
    }
    case StatsType.Radio: {
      const d = raw.data as RawRadioStatsData;
      return {
        type: "radio",
        noiseFloor: d.noiseFloor,
        lastRssi: d.lastRssi,
        lastSnr: d.lastSnr,
        txAirSecs: d.txAirSecs,
        rxAirSecs: d.rxAirSecs,
      };
    }
    case StatsType.Packets: {
      const d = raw.data as RawPacketStatsData;
      return {
        type: "packets",
        recv: d.recv,
        sent: d.sent,
        sentFlood: d.nSentFlood,
        sentDirect: d.nSentDirect,
        recvFlood: d.nRecvFlood,
        recvDirect: d.nRecvDirect,
        recvErrors: d.nRecvErrors,
      };
    }
    default:
      throw new MeshCoreError(`Unknown stats type: ${raw.type}`);
  }
}

function normalizeNeighbours(raw: RawNeighboursResult): NeighboursResult {
  const neighbours: Neighbour[] = raw.neighbours.map((n) => ({
    publicKeyPrefix: toHex(n.publicKeyPrefix),
    heardSecondsAgo: n.heardSecondsAgo,
    snr: n.snr,
  }));
  return { totalNeighboursCount: raw.totalNeighboursCount, neighbours };
}

function normalizeTelemetry(raw: RawTelemetryResponse): Telemetry {
  return { pubKeyPrefix: toHex(raw.pubKeyPrefix), lppSensorData: raw.lppSensorData };
}

/**
 * Typed, ergonomic wrapper around a meshcore.js `Connection`.
 *
 * Construct one with {@link MeshCoreClient.tcp} or {@link MeshCoreClient.serial},
 * then `await client.connect()`. Subscribe to named events with `client.on(...)`
 * and call the typed async methods. The underlying connection is always
 * reachable via {@link MeshCoreClient.raw}.
 */
export class MeshCoreClient extends TypedEventEmitter<MeshCoreEvents> {
  /** The underlying meshcore.js connection (escape hatch for unwrapped APIs). */
  readonly raw: Connection;

  private readonly requestTimeoutMs: number;
  private readonly autoSync: boolean;
  private draining = false;
  private pendingDrain = false;

  constructor(connection: Connection, options: ClientOptions = {}) {
    super();
    this.raw = connection;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.autoSync = options.autoSync ?? true;
    this.bindEvents();
  }

  /** Connect to a device over TCP/WiFi. */
  static tcp(host: string, port: number, options?: ClientOptions): MeshCoreClient {
    return new MeshCoreClient(new TCPConnection(host, port), options);
  }

  /** Connect to a device over USB serial (e.g. `/dev/ttyACM0`). */
  static serial(path: string, options?: ClientOptions): MeshCoreClient {
    return new MeshCoreClient(new NodeJSSerialConnection(path), options);
  }

  // --- lifecycle ---

  /**
   * Open the connection and resolve once the device reports `connected`.
   *
   * Caveat: the underlying transports only `console.error` low-level socket
   * errors (e.g. `ECONNREFUSED`) rather than rejecting `connect()`, so a failed
   * TCP/serial connection surfaces here as a `MeshCoreTimeoutError` after
   * `timeoutMs` rather than as the specific socket error.
   */
  async connect(timeoutMs = this.requestTimeoutMs): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off("connected", onConnected);
        reject(new MeshCoreTimeoutError("Timed out connecting to device"));
      }, timeoutMs);

      const onConnected = (): void => {
        clearTimeout(timer);
        resolve();
      };

      this.once("connected", onConnected);

      Promise.resolve(this.raw.connect()).catch((error: unknown) => {
        clearTimeout(timer);
        this.off("connected", onConnected);
        reject(normalizeRejection(error));
      });
    });
  }

  /** Close the connection. */
  async close(): Promise<void> {
    await this.request(() => this.raw.close(), null);
  }

  // --- device info & config ---

  async getSelfInfo(): Promise<SelfInfo> {
    return normalizeSelfInfo(await this.request(() => this.raw.getSelfInfo()));
  }

  async getDeviceTime(): Promise<Date> {
    const { epochSecs } = await this.request(() => this.raw.getDeviceTime());
    return epochToDate(epochSecs);
  }

  async setDeviceTime(time: Date | number): Promise<void> {
    await this.request(() => this.raw.setDeviceTime(dateToEpoch(time)));
  }

  /** Set the device clock to the host's current time. */
  async syncDeviceTime(): Promise<void> {
    await this.setDeviceTime(new Date());
  }

  async getBatteryVoltage(): Promise<BatteryVoltage> {
    const { batteryMilliVolts } = await this.request(() => this.raw.getBatteryVoltage());
    return { milliVolts: batteryMilliVolts, volts: batteryMilliVolts / 1000 };
  }

  async deviceQuery(
    appTargetVer = Constants.SupportedCompanionProtocolVersion,
  ): Promise<DeviceInfo> {
    const info = await this.request(() => this.raw.deviceQuery(appTargetVer));
    return {
      firmwareVer: info.firmwareVer,
      firmwareBuildDate: info.firmware_build_date,
      manufacturerModel: info.manufacturerModel,
    };
  }

  async reboot(): Promise<void> {
    await this.request(() => this.raw.reboot(), null);
  }

  async exportPrivateKey(): Promise<string> {
    const { privateKey } = await this.request(() => this.raw.exportPrivateKey());
    return toHex(privateKey);
  }

  async importPrivateKey(privateKey: Bytes): Promise<void> {
    await this.request(() => this.raw.importPrivateKey(toBytes(privateKey)));
  }

  // --- advertising & radio ---

  async sendAdvert(type: SelfAdvertType): Promise<void> {
    await this.request(() => this.raw.sendAdvert(type));
  }

  async sendFloodAdvert(): Promise<void> {
    await this.request(() => this.raw.sendFloodAdvert());
  }

  async sendZeroHopAdvert(): Promise<void> {
    await this.request(() => this.raw.sendZeroHopAdvert());
  }

  async setAdvertName(name: string): Promise<void> {
    await this.request(() => this.raw.setAdvertName(name));
  }

  async setAdvertLatLong(latitude: number, longitude: number): Promise<void> {
    await this.request(() => this.raw.setAdvertLatLong(latitude, longitude));
  }

  /**
   * Set the radio transmit power.
   *
   * @param txPower Transmit power in dBm.
   */
  async setTxPower(txPower: number): Promise<void> {
    await this.request(() => this.raw.setTxPower(txPower));
  }

  /**
   * Configure the LoRa radio parameters.
   *
   * @param radioFreq Centre frequency in kHz (e.g. `910525` for 910.525 MHz).
   * @param radioBw Bandwidth in kHz.
   * @param radioSf Spreading factor (typically 7–12).
   * @param radioCr Coding-rate denominator (5–8, for rates 4/5 to 4/8).
   */
  async setRadioParams(
    radioFreq: number,
    radioBw: number,
    radioSf: number,
    radioCr: number,
  ): Promise<void> {
    await this.request(() => this.raw.setRadioParams(radioFreq, radioBw, radioSf, radioCr));
  }

  // --- contacts ---

  async getContacts(): Promise<Contact[]> {
    const contacts = await this.request(() => this.raw.getContacts());
    return contacts.map(normalizeContact);
  }

  async findContactByName(name: string): Promise<Contact | undefined> {
    const contact = await this.request(() => this.raw.findContactByName(name));
    return contact ? normalizeContact(contact) : undefined;
  }

  async findContactByPublicKeyPrefix(prefix: Bytes): Promise<Contact | undefined> {
    const contact = await this.request(() =>
      this.raw.findContactByPublicKeyPrefix(toBytes(prefix)),
    );
    return contact ? normalizeContact(contact) : undefined;
  }

  /** Import a contact from exported advert packet bytes. */
  async importContact(advertPacketBytes: Bytes): Promise<void> {
    await this.request(() => this.raw.importContact(toBytes(advertPacketBytes)));
  }

  /** Export a contact (or self, if omitted) as advert packet bytes. */
  async exportContact(contact?: ContactRef): Promise<Uint8Array> {
    const key = contact === undefined ? null : resolveKey(contact);
    const { advertPacketBytes } = await this.request(() => this.raw.exportContact(key));
    return advertPacketBytes;
  }

  async shareContact(contact: ContactRef): Promise<void> {
    await this.request(() => this.raw.shareContact(resolveKey(contact)));
  }

  async removeContact(contact: ContactRef): Promise<void> {
    await this.request(() => this.raw.removeContact(resolveKey(contact)));
  }

  async addOrUpdateContact(contact: Contact): Promise<void> {
    await this.request(() =>
      this.raw.addOrUpdateContact(
        fromHex(contact.publicKey),
        contact.type,
        contact.flags,
        contact.outPathLen,
        padPath(contact.outPath),
        contact.advName,
        dateToEpoch(contact.lastAdvert),
        contact.advLat,
        contact.advLon,
      ),
    );
  }

  /** Set a contact's out path (an array of repeater hash bytes, max 64). */
  async setContactPath(contact: Contact, path: Bytes | number[]): Promise<void> {
    const raw = Array.isArray(path) ? Uint8Array.from(path) : toBytes(path);
    // The device path buffer is 64 bytes and the length is sent as a single byte;
    // clamp both together so outPathLen can never disagree with the stored bytes.
    const pathBytes = raw.subarray(0, 64);
    await this.addOrUpdateContact({
      ...contact,
      outPathLen: pathBytes.length,
      outPath: toHex(pathBytes),
    });
  }

  async resetPath(contact: ContactRef): Promise<void> {
    await this.request(() => this.raw.resetPath(resolveKey(contact)));
  }

  /** Switch the device to automatically add new contacts when they advertise (emits `advert`). */
  async setAutoAddContacts(): Promise<void> {
    await this.request(() => this.raw.setAutoAddContacts());
  }

  /** Switch the device to require adding new contacts manually (emits `newAdvert` instead of auto-adding). */
  async setManualAddContacts(): Promise<void> {
    await this.request(() => this.raw.setManualAddContacts());
  }

  // --- messaging ---

  /** Send a direct text message to a contact. Resolves once the device acks it. */
  async sendTextMessage(
    contact: ContactRef,
    text: string,
    type?: TxtType,
  ): Promise<SentResult> {
    return this.request(() => this.raw.sendTextMessage(resolveKey(contact), text, type));
  }

  /** Send a text message to a channel by index. */
  async sendChannelTextMessage(channelIdx: number, text: string): Promise<void> {
    await this.request(() => this.raw.sendChannelTextMessage(channelIdx, text));
  }

  /** Sync the next waiting message from the device, or `null` if none remain. */
  async syncNextMessage(): Promise<WaitingMessage | null> {
    const raw = await this.request(() => this.raw.syncNextMessage());
    return raw ? normalizeWaitingMessage(raw) : null;
  }

  /** Drain all waiting messages from the device. */
  async getWaitingMessages(): Promise<WaitingMessage[]> {
    const messages = await this.request(() => this.raw.getWaitingMessages());
    return messages.map(normalizeWaitingMessage);
  }

  // --- channels ---

  async getChannel(channelIdx: number): Promise<Channel> {
    return normalizeChannel(await this.request(() => this.raw.getChannel(channelIdx)));
  }

  async getChannels(): Promise<Channel[]> {
    const channels = await this.request(() => this.raw.getChannels());
    return channels.map(normalizeChannel);
  }

  async setChannel(channelIdx: number, name: string, secret: Bytes): Promise<void> {
    await this.request(() => this.raw.setChannel(channelIdx, name, toBytes(secret)));
  }

  async deleteChannel(channelIdx: number): Promise<void> {
    await this.request(() => this.raw.deleteChannel(channelIdx));
  }

  async findChannelByName(name: string): Promise<Channel | undefined> {
    const channel = await this.request(() => this.raw.findChannelByName(name));
    return channel ? normalizeChannel(channel) : undefined;
  }

  async findChannelBySecret(secret: Bytes): Promise<Channel | undefined> {
    const channel = await this.request(() => this.raw.findChannelBySecret(toBytes(secret)));
    return channel ? normalizeChannel(channel) : undefined;
  }

  // --- remote server interactions (own device-side timeout) ---

  /** Log in to a remote repeater/room server. */
  async login(contact: ContactRef, password: string): Promise<{ pubKeyPrefix: string }> {
    const { pubKeyPrefix } = await this.request(
      () => this.raw.login(resolveKey(contact), password),
      null,
    );
    return { pubKeyPrefix: toHex(pubKeyPrefix) };
  }

  /** Request detailed status from a remote repeater. */
  async getStatus(contact: ContactRef): Promise<RepeaterStats> {
    const stats = await this.request(() => this.raw.getStatus(resolveKey(contact)), null);
    return normalizeRepeaterStats(stats);
  }

  /** Request telemetry (Cayenne LPP) from a remote node. */
  async getTelemetry(contact: ContactRef): Promise<Telemetry> {
    const telemetry = await this.request(() => this.raw.getTelemetry(resolveKey(contact)), null);
    return normalizeTelemetry(telemetry);
  }

  /** Send a raw binary request and return the raw response bytes. */
  async sendBinaryRequest(contact: ContactRef, requestCodeAndParams: Bytes): Promise<Uint8Array> {
    return this.request(
      () => this.raw.sendBinaryRequest(resolveKey(contact), toBytes(requestCodeAndParams)),
      null,
    );
  }

  /** Query the neighbour table of a remote repeater (firmware v1.9.0+). */
  async getNeighbours(
    contact: ContactRef,
    options: NeighboursOptions = {},
  ): Promise<NeighboursResult> {
    const prefixLen = options.pubKeyPrefixLength ?? DEFAULT_NEIGHBOUR_PREFIX_LENGTH;
    const result = await this.request(
      () =>
        this.raw.getNeighbours(
          resolveKey(contact),
          options.count,
          options.offset,
          options.orderBy,
          prefixLen,
        ),
      null,
    );
    return normalizeNeighbours(result);
  }

  // --- stats, signing, tracing ---

  async getStats(statsType: StatsType): Promise<Stats> {
    return normalizeStats(await this.request(() => this.raw.getStats(statsType)));
  }

  async getStatsCore(): Promise<Stats> {
    return this.getStats(StatsType.Core);
  }

  async getStatsRadio(): Promise<Stats> {
    return this.getStats(StatsType.Radio);
  }

  async getStatsPackets(): Promise<Stats> {
    return this.getStats(StatsType.Packets);
  }

  /** Have the device sign arbitrary data; returns the signature as hex. */
  async sign(data: Bytes): Promise<string> {
    const signature = await this.request(() => this.raw.sign(toBytes(data)));
    return toHex(signature);
  }

  /** Trace a path through the mesh. */
  async tracePath(path: Bytes): Promise<TraceData> {
    return normalizeTraceData(await this.request(() => this.raw.tracePath(toBytes(path)), null));
  }

  // --- internals ---

  /**
   * Run a request, applying a timeout (unless `timeoutMs` is `null`) and mapping
   * any rejection to a typed {@link MeshCoreError}.
   */
  private async request<T>(
    fn: () => Promise<T>,
    timeoutMs: number | null = this.requestTimeoutMs,
  ): Promise<T> {
    try {
      const promise = fn();
      return timeoutMs == null ? await promise : await withTimeout(promise, timeoutMs);
    } catch (error) {
      throw normalizeRejection(error);
    }
  }

  /** Subscribe to the raw connection's numeric-coded events and re-emit named ones. */
  private bindEvents(): void {
    const { PushCodes } = Constants;

    this.raw.on("connected", () => this.emit("connected"));
    this.raw.on("disconnected", () => this.emit("disconnected"));
    this.raw.on("rx", (frame: Uint8Array) => this.emit("rx", frame));

    this.raw.on(PushCodes.Advert, (info: { publicKey: Uint8Array }) =>
      this.emit("advert", { publicKey: toHex(info.publicKey) }),
    );
    this.raw.on(PushCodes.NewAdvert, (info: RawContact) =>
      this.emit("newAdvert", {
        publicKey: toHex(info.publicKey),
        type: info.type as AdvType,
        flags: info.flags,
        outPathLen: info.outPathLen,
        outPath: encodeOutPath(info.outPath, info.outPathLen),
        advName: info.advName,
        lastAdvert: epochToDate(info.lastAdvert),
        advLat: info.advLat,
        advLon: info.advLon,
        lastMod: epochToDate(info.lastMod),
      }),
    );
    this.raw.on(PushCodes.PathUpdated, (info: { publicKey: Uint8Array }) =>
      this.emit("pathUpdated", { publicKey: toHex(info.publicKey) }),
    );
    this.raw.on(PushCodes.SendConfirmed, (info: { ackCode: number; roundTrip: number }) =>
      this.emit("sendConfirmed", { ackCode: info.ackCode, roundTrip: info.roundTrip }),
    );
    this.raw.on(PushCodes.MsgWaiting, () => {
      this.emit("msgWaiting");
      if (this.autoSync) {
        void this.drainAndEmit();
      }
    });
    this.raw.on(
      PushCodes.RawData,
      (info: { lastSnr: number; lastRssi: number; payload: Uint8Array }) =>
        this.emit("rawData", {
          lastSnr: info.lastSnr,
          lastRssi: info.lastRssi,
          payload: info.payload,
        }),
    );
    this.raw.on(PushCodes.LoginSuccess, (info: { pubKeyPrefix: Uint8Array }) =>
      this.emit("loginSuccess", { pubKeyPrefix: toHex(info.pubKeyPrefix) }),
    );
    this.raw.on(
      PushCodes.StatusResponse,
      (info: { pubKeyPrefix: Uint8Array; statusData: Uint8Array }) =>
        this.emit("statusResponse", {
          pubKeyPrefix: toHex(info.pubKeyPrefix),
          statusData: info.statusData,
        }),
    );
    this.raw.on(
      PushCodes.LogRxData,
      (info: { lastSnr: number; lastRssi: number; raw: Uint8Array }) =>
        this.emit("logRxData", { lastSnr: info.lastSnr, lastRssi: info.lastRssi, raw: info.raw }),
    );
    this.raw.on(PushCodes.TraceData, (info: RawTraceData) =>
      this.emit("traceData", normalizeTraceData(info)),
    );
    this.raw.on(PushCodes.TelemetryResponse, (info: RawTelemetryResponse) =>
      this.emit("telemetryResponse", normalizeTelemetry(info)),
    );
    this.raw.on(
      PushCodes.BinaryResponse,
      (info: { tag: number; responseData: Uint8Array }) =>
        this.emit("binaryResponse", { tag: info.tag, responseData: info.responseData }),
    );
  }

  /**
   * Drain the message queue and emit a typed event per message.
   *
   * Re-entrancy: if a `msgWaiting` push arrives while a drain is in flight, we
   * record it via `pendingDrain` and drain again once the current pass finishes,
   * so a message that lands mid-drain is never stranded in the device queue.
   */
  private async drainAndEmit(): Promise<void> {
    if (this.draining) {
      this.pendingDrain = true;
      return;
    }
    this.draining = true;
    try {
      do {
        this.pendingDrain = false;
        for (const message of await this.getWaitingMessages()) {
          if (message.kind === "contact") {
            this.emit("contactMessage", message.message);
          } else if (message.kind === "channel") {
            this.emit("channelMessage", message.message);
          } else {
            this.emit("channelData", message.data);
          }
        }
      } while (this.pendingDrain);
    } catch (error) {
      // This runs detached (via `void this.drainAndEmit()` on a msgWaiting push).
      // Node's EventEmitter THROWS if "error" is emitted with no listener, which
      // here would surface as an unhandled rejection and crash the process — so
      // only emit when someone is listening, otherwise log.
      const err = error instanceof Error ? error : new MeshCoreError(String(error));
      if (this.listenerCount("error") > 0) {
        this.emit("error", err);
      } else {
        console.error("[meshcore-ts] auto-sync failed and no 'error' listener is attached:", err);
      }
    } finally {
      this.draining = false;
    }
  }
}
