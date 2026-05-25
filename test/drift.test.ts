/**
 * Drift guard: assert our hand-maintained mirrors of `@liamcottle/meshcore.js`
 * still match the *installed* library. This runs in normal CI, so the moment the
 * dependency is bumped, any divergence (a new/renamed constant, a new push code
 * we don't surface, a removed method we delegate to) fails here instead of
 * silently shipping a wrapper that ignores upstream changes.
 *
 * It can only check runtime *values and method presence* — type shapes (the
 * `Raw*` types in src/meshcore.d.ts) are erased and must be reconciled by hand
 * when this or the scheduled upstream-drift workflow flags a new release.
 */
import { Connection, Constants } from "@liamcottle/meshcore.js";
import { describe, expect, it } from "vitest";
import {
  AdvType,
  BinaryRequestType,
  ErrorCode,
  SelfAdvertType,
  StatsType,
  TxtType,
} from "../src/enums.js";

describe("enum mirrors match installed meshcore.js Constants", () => {
  it("AdvType", () => expect({ ...AdvType }).toEqual(Constants.AdvType));
  it("SelfAdvertType", () => expect({ ...SelfAdvertType }).toEqual(Constants.SelfAdvertTypes));
  it("TxtType", () => expect({ ...TxtType }).toEqual(Constants.TxtTypes));
  it("StatsType", () => expect({ ...StatsType }).toEqual(Constants.StatsTypes));
  it("ErrorCode", () => expect({ ...ErrorCode }).toEqual(Constants.ErrorCodes));
  it("BinaryRequestType", () =>
    expect({ ...BinaryRequestType }).toEqual(Constants.BinaryRequestTypes));
});

describe("push codes are all accounted for", () => {
  // Push codes MeshCoreClient.bindEvents() surfaces as named events.
  const HANDLED = [
    "Advert",
    "PathUpdated",
    "SendConfirmed",
    "MsgWaiting",
    "RawData",
    "LoginSuccess",
    "StatusResponse",
    "LogRxData",
    "TraceData",
    "NewAdvert",
    "TelemetryResponse",
    "BinaryResponse",
  ];
  // Intentionally not surfaced: the library marks LoginFail "not usable yet" and
  // never dispatches it.
  const INTENTIONALLY_UNHANDLED = ["LoginFail"];

  it("every upstream PushCode is handled or explicitly ignored", () => {
    const unknown = Object.keys(Constants.PushCodes).filter(
      (key) => !HANDLED.includes(key) && !INTENTIONALLY_UNHANDLED.includes(key),
    );
    expect(
      unknown,
      `New upstream PushCode(s) ${JSON.stringify(unknown)} — wire them in client.ts bindEvents() and MeshCoreEvents, or add to INTENTIONALLY_UNHANDLED.`,
    ).toEqual([]);
  });

  it("every push code we handle still exists upstream", () => {
    const codes = Constants.PushCodes as Record<string, number>;
    const missing = HANDLED.filter((key) => codes[key] === undefined);
    expect(missing, `We bind PushCode(s) that no longer exist upstream: ${JSON.stringify(missing)}`).toEqual([]);
  });
});

describe("delegated Connection methods still exist", () => {
  // Every high-level method MeshCoreClient delegates to.
  const METHODS = [
    "getSelfInfo",
    "getContacts",
    "findContactByName",
    "findContactByPublicKeyPrefix",
    "sendTextMessage",
    "sendChannelTextMessage",
    "syncNextMessage",
    "getWaitingMessages",
    "getDeviceTime",
    "setDeviceTime",
    "getBatteryVoltage",
    "deviceQuery",
    "reboot",
    "exportPrivateKey",
    "importPrivateKey",
    "sendAdvert",
    "sendFloodAdvert",
    "sendZeroHopAdvert",
    "setAdvertName",
    "setAdvertLatLong",
    "setTxPower",
    "setRadioParams",
    "importContact",
    "exportContact",
    "shareContact",
    "removeContact",
    "addOrUpdateContact",
    "resetPath",
    "setAutoAddContacts",
    "setManualAddContacts",
    "getChannel",
    "getChannels",
    "setChannel",
    "deleteChannel",
    "findChannelByName",
    "findChannelBySecret",
    "login",
    "getStatus",
    "getTelemetry",
    "sendBinaryRequest",
    "getNeighbours",
    "getStats",
    "getStatsCore",
    "getStatsRadio",
    "getStatsPackets",
    "sign",
    "tracePath",
  ];

  const proto = Connection.prototype as unknown as Record<string, unknown>;

  it("all delegated methods are present on Connection.prototype", () => {
    const missing = METHODS.filter((name) => typeof proto[name] !== "function");
    expect(missing, `Connection no longer defines: ${JSON.stringify(missing)} — upstream renamed/removed them.`).toEqual([]);
  });
});
