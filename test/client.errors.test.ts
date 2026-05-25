import { Constants } from "@liamcottle/meshcore.js";
import { describe, expect, it, vi } from "vitest";
import { MeshCoreClient } from "../src/client.js";
import {
  MeshCoreDeviceError,
  MeshCoreError,
  MeshCoreTimeoutError,
  normalizeRejection,
} from "../src/errors.js";
import { ErrorCode } from "../src/enums.js";
import { FakeConnection } from "./fake-connection.js";

describe("normalizeRejection", () => {
  it("maps a bare reject() to a device error", () => {
    expect(normalizeRejection(undefined)).toBeInstanceOf(MeshCoreDeviceError);
  });

  it('maps "timeout" to a timeout error', () => {
    expect(normalizeRejection("timeout")).toBeInstanceOf(MeshCoreTimeoutError);
  });

  it('maps "disabled" and "data_too_long" to MeshCoreError', () => {
    expect(normalizeRejection("disabled")).toBeInstanceOf(MeshCoreError);
    expect(normalizeRejection("data_too_long")).toBeInstanceOf(MeshCoreError);
  });

  it("maps an { errCode } object to a device error carrying the code", () => {
    const err = normalizeRejection({ errCode: ErrorCode.NotFound });
    expect(err).toBeInstanceOf(MeshCoreDeviceError);
    expect((err as MeshCoreDeviceError).code).toBe(ErrorCode.NotFound);
  });

  it("passes through an existing Error", () => {
    const original = new Error("boom");
    const result = normalizeRejection(original);
    expect(result).toBeInstanceOf(MeshCoreError);
    expect(result.message).toBe("boom");
  });
});

describe("MeshCoreClient error handling", () => {
  it("times out a request that never resolves", async () => {
    const fake = new FakeConnection();
    fake.getSelfInfo = () => new Promise(() => {}); // never resolves
    const client = new MeshCoreClient(fake.asConnection(), {
      requestTimeoutMs: 30,
      autoSync: false,
    });
    await expect(client.getSelfInfo()).rejects.toBeInstanceOf(MeshCoreTimeoutError);
  });

  it("maps a raw bare rejection to a typed device error", async () => {
    const fake = new FakeConnection();
    fake.getContacts = () => Promise.reject(undefined);
    const client = new MeshCoreClient(fake.asConnection(), { autoSync: false });
    await expect(client.getContacts()).rejects.toBeInstanceOf(MeshCoreDeviceError);
  });
});

describe("MeshCoreClient auto-sync error handling", () => {
  it("does not crash when a drain fails and no 'error' listener is attached", async () => {
    const fake = new FakeConnection();
    fake.getWaitingMessages = async () => {
      throw new Error("device gone");
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Deliberately do NOT register an "error" listener: a Node EventEmitter would
    // otherwise throw, crashing the process from this detached drain.
    new MeshCoreClient(fake.asConnection(), { autoSync: true });
    fake.emitRawSync(Constants.PushCodes.MsgWaiting);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("delivers the failure to an 'error' listener when one is attached", async () => {
    const fake = new FakeConnection();
    fake.getWaitingMessages = async () => {
      throw new Error("device gone");
    };
    const client = new MeshCoreClient(fake.asConnection(), { autoSync: true });
    const error = await new Promise<Error>((resolve) => {
      client.on("error", resolve);
      fake.emitRawSync(Constants.PushCodes.MsgWaiting);
    });
    expect(error).toBeInstanceOf(MeshCoreError);
  });
});
