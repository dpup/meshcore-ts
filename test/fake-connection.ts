import { EventEmitter } from "node:events";
import type { Connection } from "@liamcottle/meshcore.js";

/**
 * A test double for a meshcore.js `Connection`. It is a real `EventEmitter`
 * (so the client can subscribe to numeric-coded events) plus stubbable async
 * methods. Use {@link FakeConnection.emitRaw} to push numeric-coded events the
 * way the real library does.
 */
export class FakeConnection extends EventEmitter {
  // Overridable in tests; default to benign behavior.
  connect: () => Promise<void> = async () => {
    this.emitRaw("connected");
  };
  close: () => Promise<void> = async () => {};
  getSelfInfo: () => Promise<unknown> = async () => {
    throw new Error("getSelfInfo not stubbed");
  };
  getContacts: () => Promise<unknown> = async () => [];
  getWaitingMessages: () => Promise<unknown> = async () => [];

  /**
   * Emit a numeric- or string-coded event the way the real library does: its
   * EventEmitter dispatches every listener asynchronously (via setTimeout(0)),
   * so we defer here too. Tests await the resulting wrapper events rather than
   * relying on synchronous delivery. Use {@link emitRawSync} only when a test
   * needs to control re-entrancy timing deterministically.
   */
  emitRaw(event: string | number, ...args: unknown[]): void {
    setTimeout(() => this.emit(event as string, ...args), 0);
  }

  /** Synchronous emit, for tests that deliberately drive re-entrant timing. */
  emitRawSync(event: string | number, ...args: unknown[]): void {
    this.emit(event as string, ...args);
  }

  /** Cast to the `Connection` type the client expects. */
  asConnection(): Connection {
    return this as unknown as Connection;
  }
}
