/**
 * Typed mirrors of the numeric constants in `@liamcottle/meshcore.js`
 * (`src/constants.js`). Each is exposed as a frozen `const` object plus a
 * matching union type so values are both runtime-usable and type-safe.
 */

/** Advertised node role. */
export const AdvType = {
  None: 0,
  Chat: 1,
  Repeater: 2,
  Room: 3,
} as const;
export type AdvType = (typeof AdvType)[keyof typeof AdvType];

/** Scope of a self-advertisement. */
export const SelfAdvertType = {
  ZeroHop: 0,
  Flood: 1,
} as const;
export type SelfAdvertType = (typeof SelfAdvertType)[keyof typeof SelfAdvertType];

/** Text message payload type. */
export const TxtType = {
  Plain: 0,
  CliData: 1,
  SignedPlain: 2,
} as const;
export type TxtType = (typeof TxtType)[keyof typeof TxtType];

/** Statistics group requested via `getStats`. */
export const StatsType = {
  Core: 0,
  Radio: 1,
  Packets: 2,
} as const;
export type StatsType = (typeof StatsType)[keyof typeof StatsType];

/** Error codes a device may return in an error response. */
export const ErrorCode = {
  UnsupportedCmd: 1,
  NotFound: 2,
  TableFull: 3,
  BadState: 4,
  FileIoError: 5,
  IllegalArg: 6,
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Binary request types (sent to repeater/room servers). */
export const BinaryRequestType = {
  GetTelemetryData: 0x03,
  GetAvgMinMax: 0x04,
  GetAccessList: 0x05,
  GetNeighbours: 0x06,
} as const;
export type BinaryRequestType =
  (typeof BinaryRequestType)[keyof typeof BinaryRequestType];

/** Ordering for `getNeighbours`. */
export const NeighbourOrder = {
  NewestToOldest: 0,
  OldestToNewest: 1,
  StrongestToWeakest: 2,
  WeakestToStrongest: 3,
} as const;
export type NeighbourOrder = (typeof NeighbourOrder)[keyof typeof NeighbourOrder];

/** Human-readable label for an {@link ErrorCode}. */
export function errorCodeName(code: number | null | undefined): string {
  switch (code) {
    case ErrorCode.UnsupportedCmd:
      return "unsupported command";
    case ErrorCode.NotFound:
      return "not found";
    case ErrorCode.TableFull:
      return "table full";
    case ErrorCode.BadState:
      return "bad state";
    case ErrorCode.FileIoError:
      return "file I/O error";
    case ErrorCode.IllegalArg:
      return "illegal argument";
    default:
      return code == null ? "unspecified error" : `error code ${code}`;
  }
}
