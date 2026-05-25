/**
 * Normalized data models returned by {@link MeshCoreClient}.
 *
 * Compared to the raw meshcore.js shapes:
 * - binary fields (keys, paths, secrets) are lowercase hex strings;
 * - human timestamps are `Date`s;
 * - boolean-ish flags are real `boolean`s.
 * Opaque binary blobs (sensor data, raw payloads) stay as `Uint8Array`.
 */
import type { AdvType, TxtType } from "./enums.js";

/** A contact stored on the device. */
export interface Contact {
  /** 32-byte public key, hex encoded. */
  publicKey: string;
  type: AdvType;
  flags: number;
  /** Length of the out path, or -1 when the path is unknown/direct. */
  outPathLen: number;
  /** Out path bytes (up to 64), hex encoded. */
  outPath: string;
  /** Advertised display name. */
  advName: string;
  /** Time of the last received advertisement. */
  lastAdvert: Date;
  /** Advertised latitude in micro-degrees (degrees * 1e6). */
  advLat: number;
  /** Advertised longitude in micro-degrees (degrees * 1e6). */
  advLon: number;
  /** Time the contact record was last modified on the device. */
  lastMod: Date;
}

/** Information about the connected device itself. */
export interface SelfInfo {
  type: AdvType;
  txPower: number;
  maxTxPower: number;
  publicKey: string;
  advLat: number;
  advLon: number;
  /** Whether the device adds new contacts manually (vs. automatically). */
  manualAddContacts: boolean;
  radioFreq: number;
  radioBw: number;
  radioSf: number;
  radioCr: number;
  name: string;
}

/** A configured channel slot. */
export interface Channel {
  channelIdx: number;
  name: string;
  /** 16-byte channel secret, hex encoded. */
  secret: string;
}

/** A direct (contact) text message received from the device. */
export interface ContactMessage {
  /** First 6 bytes of the sender's public key, hex encoded. */
  pubKeyPrefix: string;
  pathLen: number;
  txtType: TxtType;
  senderTimestamp: Date;
  text: string;
}

/** A channel text message received from the device. */
export interface ChannelMessage {
  channelIdx: number;
  pathLen: number;
  txtType: TxtType;
  senderTimestamp: Date;
  text: string;
}

/** Raw channel datagram received from the device. */
export interface ChannelData {
  snr: number;
  channelIdx: number;
  pathLen: number;
  dataType: number;
  data: Uint8Array;
}

/** A message drained from the device's waiting queue. */
export type WaitingMessage =
  | { kind: "contact"; message: ContactMessage }
  | { kind: "channel"; message: ChannelMessage }
  | { kind: "channelData"; data: ChannelData };

/** Result of sending a direct text message. */
export interface SentResult {
  result: number;
  expectedAckCrc: number;
  estTimeout: number;
}

/** Payload of the `sendConfirmed` push. */
export interface SendConfirmed {
  ackCode: number;
  roundTrip: number;
}

/** Device firmware / model information. */
export interface DeviceInfo {
  firmwareVer: number;
  firmwareBuildDate: string;
  manufacturerModel: string;
}

/** Battery voltage reading. */
export interface BatteryVoltage {
  milliVolts: number;
  volts: number;
}

/** Payload of the `loginSuccess` push. */
export interface LoginSuccess {
  pubKeyPrefix: string;
}

/** Payload of the `advert` push (auto-add mode). */
export interface Advert {
  publicKey: string;
}

/** Payload of the `newAdvert` push (manual-add mode). */
export interface NewAdvert {
  publicKey: string;
  type: AdvType;
  flags: number;
  outPathLen: number;
  outPath: string;
  advName: string;
  lastAdvert: Date;
  advLat: number;
  advLon: number;
  lastMod: Date;
}

/** Payload of the `pathUpdated` push. */
export interface PathUpdated {
  publicKey: string;
}

/** Payload of the `rawData` push. */
export interface RawData {
  lastSnr: number;
  lastRssi: number;
  payload: Uint8Array;
}

/** Payload of the `statusResponse` push. */
export interface StatusResponse {
  pubKeyPrefix: string;
  statusData: Uint8Array;
}

/** Payload of the `logRxData` push. */
export interface LogRxData {
  lastSnr: number;
  lastRssi: number;
  raw: Uint8Array;
}

/** Payload of the `telemetryResponse` push (also returned by `getTelemetry`). */
export interface Telemetry {
  pubKeyPrefix: string;
  /** Cayenne LPP encoded sensor data. */
  lppSensorData: Uint8Array;
}

/** Payload of the `binaryResponse` push. */
export interface BinaryResponse {
  tag: number;
  responseData: Uint8Array;
}

/** Payload of the `traceData` push (also returned by `tracePath`). */
export interface TraceData {
  pathLen: number;
  flags: number;
  tag: number;
  authCode: number;
  /** Path hashes, hex encoded. */
  pathHashes: string;
  /** Per-hop SNR values. */
  pathSnrs: number[];
  lastSnr: number;
}

/** Detailed stats returned by `getStatus` for a remote repeater. */
export interface RepeaterStats {
  batteryMilliVolts: number;
  currTxQueueLen: number;
  noiseFloor: number;
  lastRssi: number;
  packetsReceived: number;
  packetsSent: number;
  totalAirTimeSecs: number;
  totalUpTimeSecs: number;
  sentFlood: number;
  sentDirect: number;
  recvFlood: number;
  recvDirect: number;
  errEvents: number;
  lastSnr: number;
  directDups: number;
  floodDups: number;
}

/** Local device core stats. */
export interface CoreStats {
  type: "core";
  batteryMilliVolts: number;
  uptimeSecs: number;
  queueLen: number;
}

/** Local device radio stats. */
export interface RadioStats {
  type: "radio";
  noiseFloor: number;
  lastRssi: number;
  lastSnr: number;
  txAirSecs: number;
  rxAirSecs: number;
}

/** Local device packet stats. */
export interface PacketStats {
  type: "packets";
  recv: number;
  sent: number;
  sentFlood: number;
  sentDirect: number;
  recvFlood: number;
  recvDirect: number;
  recvErrors: number | null;
}

export type Stats = CoreStats | RadioStats | PacketStats;

/** A neighbour entry returned by `getNeighbours`. */
export interface Neighbour {
  /** Public key prefix, hex encoded. */
  publicKeyPrefix: string;
  heardSecondsAgo: number;
  snr: number;
}

/** Result of a `getNeighbours` query. */
export interface NeighboursResult {
  totalNeighboursCount: number;
  neighbours: Neighbour[];
}
