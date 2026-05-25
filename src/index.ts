/// <reference path="./meshcore.d.ts" />
/**
 * meshcore-ts — a typed, ergonomic wrapper around `@liamcottle/meshcore.js`.
 *
 * @example
 * ```ts
 * import { MeshCoreClient } from "@dpup/meshcore-ts";
 *
 * const client = MeshCoreClient.tcp("192.168.1.50", 5000);
 * client.on("contactMessage", (msg) => console.log(msg.text));
 * await client.connect();
 * const contacts = await client.getContacts();
 * ```
 */

// The main client.
export { MeshCoreClient } from "./client.js";
export type { ClientOptions, ContactRef, NeighboursOptions } from "./client.js";

// Typed events + emitter base.
export { TypedEventEmitter } from "./events.js";
export type { EventMap, MeshCoreEvents } from "./events.js";

// Enums (value + type) and helpers.
export {
  AdvType,
  BinaryRequestType,
  errorCodeName,
  ErrorCode,
  NeighbourOrder,
  SelfAdvertType,
  StatsType,
  TxtType,
} from "./enums.js";

// Errors.
export {
  MeshCoreDeviceError,
  MeshCoreError,
  MeshCoreTimeoutError,
  normalizeRejection,
} from "./errors.js";

// Hex helpers.
export { fromHex, toBytes, toHex } from "./hex.js";
export type { Bytes } from "./hex.js";

// Data models.
export type {
  Advert,
  BatteryVoltage,
  BinaryResponse,
  Channel,
  ChannelData,
  ChannelMessage,
  Contact,
  ContactMessage,
  CoreStats,
  DeviceInfo,
  LogRxData,
  LoginSuccess,
  Neighbour,
  NeighboursResult,
  NewAdvert,
  PacketStats,
  PathUpdated,
  RadioStats,
  RawData,
  RepeaterStats,
  SelfInfo,
  SendConfirmed,
  SentResult,
  Stats,
  StatusResponse,
  Telemetry,
  TraceData,
  WaitingMessage,
} from "./models.js";

// Raw transports + utilities.
export {
  BufferUtils,
  Connection,
  Constants,
  NodeJSSerialConnection,
  TCPConnection,
  TransportKeyUtil,
} from "./transports.js";
