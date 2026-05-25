import { EventEmitter } from "node:events";
import type {
  Advert,
  BinaryResponse,
  ChannelData,
  ChannelMessage,
  ContactMessage,
  LogRxData,
  LoginSuccess,
  NewAdvert,
  PathUpdated,
  RawData,
  SendConfirmed,
  StatusResponse,
  Telemetry,
  TraceData,
} from "./models.js";

/**
 * Named, typed events emitted by {@link MeshCoreClient}. The raw library emits
 * these with numeric byte codes (e.g. `0x83`); the wrapper translates them to
 * these discoverable names with normalized payloads.
 *
 * Each value is the tuple of arguments passed to listeners for that event.
 */
export interface MeshCoreEvents {
  /** The device connection is established. */
  connected: [];
  /** The device connection was closed or lost. */
  disconnected: [];
  /** A raw frame was received from the device. */
  rx: [frame: Uint8Array];
  /** A surfaced error (e.g. a failed auto-sync) that has no other channel. */
  error: [error: Error];

  /** A new advertisement was received (auto-add mode). */
  advert: [advert: Advert];
  /** A new advertisement was received (manual-add mode). */
  newAdvert: [advert: NewAdvert];
  /** A contact's path was updated. */
  pathUpdated: [info: PathUpdated];
  /** A direct message send was confirmed/acked. */
  sendConfirmed: [info: SendConfirmed];
  /** The device has one or more messages waiting to be synced. */
  msgWaiting: [];
  /** Raw data was received. */
  rawData: [data: RawData];
  /** A login to a remote server succeeded. */
  loginSuccess: [info: LoginSuccess];
  /** A status response push was received. */
  statusResponse: [info: StatusResponse];
  /** RX logging data was received. */
  logRxData: [info: LogRxData];
  /** Trace path data was received. */
  traceData: [info: TraceData];
  /** A telemetry response push was received. */
  telemetryResponse: [info: Telemetry];
  /** A binary response push was received. */
  binaryResponse: [info: BinaryResponse];

  /** A direct (contact) message was drained from the device queue. */
  contactMessage: [message: ContactMessage];
  /** A channel message was drained from the device queue. */
  channelMessage: [message: ChannelMessage];
  /** A channel datagram was drained from the device queue. */
  channelData: [data: ChannelData];
}

/** Generic shape constraint for an event map. */
export type EventMap = Record<string, unknown[]>;

/**
 * A small strongly-typed wrapper over Node's `EventEmitter`. Subclasses emit
 * via the protected {@link emit} method; consumers use the public
 * `on`/`once`/`off` methods, which only accept known event names and correctly
 * typed listeners.
 */
export class TypedEventEmitter<Events extends Record<keyof Events, unknown[]>> {
  protected readonly emitter = new EventEmitter();

  /** Subscribe to an event. */
  on<K extends keyof Events & string>(
    event: K,
    listener: (...args: Events[K]) => void,
  ): this {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
    return this;
  }

  /** Subscribe to an event for a single emission. */
  once<K extends keyof Events & string>(
    event: K,
    listener: (...args: Events[K]) => void,
  ): this {
    this.emitter.once(event, listener as (...args: unknown[]) => void);
    return this;
  }

  /** Unsubscribe a previously registered listener. */
  off<K extends keyof Events & string>(
    event: K,
    listener: (...args: Events[K]) => void,
  ): this {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
    return this;
  }

  /** Remove all listeners (optionally for a single event). */
  removeAllListeners(event?: keyof Events & string): this {
    this.emitter.removeAllListeners(event);
    return this;
  }

  /** Number of listeners registered for an event. */
  listenerCount(event: keyof Events & string): number {
    return this.emitter.listenerCount(event);
  }

  /** Set the maximum number of listeners before a warning is emitted. */
  setMaxListeners(n: number): this {
    this.emitter.setMaxListeners(n);
    return this;
  }

  /** Emit an event. Only callable by subclasses. */
  protected emit<K extends keyof Events & string>(
    event: K,
    ...args: Events[K]
  ): boolean {
    return this.emitter.emit(event, ...args);
  }
}
