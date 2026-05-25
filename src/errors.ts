import { type ErrorCode, errorCodeName } from "./enums.js";

/** Base class for every error thrown by the wrapper. */
export class MeshCoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "MeshCoreError";
  }
}

/** Thrown when a request times out waiting for a device response. */
export class MeshCoreTimeoutError extends MeshCoreError {
  constructor(message = "Request timed out waiting for a device response") {
    super(message);
    this.name = "MeshCoreTimeoutError";
  }
}

/** Thrown when the device reports an error response. */
export class MeshCoreDeviceError extends MeshCoreError {
  /** The device error code, if one was provided. */
  readonly code: ErrorCode | undefined;

  constructor(message: string, code?: ErrorCode) {
    super(message);
    this.name = "MeshCoreDeviceError";
    this.code = code;
  }
}

/**
 * Map the assorted rejection values meshcore.js produces into a typed
 * {@link MeshCoreError}. The underlying library variously calls `reject()` with
 * no argument, with bare strings (`"timeout"`, `"disabled"`, `"data_too_long"`),
 * with an `{ errCode }` object, or with a thrown `Error`.
 */
export function normalizeRejection(reason: unknown): MeshCoreError {
  if (reason instanceof MeshCoreError) {
    return reason;
  }

  if (reason instanceof Error) {
    return new MeshCoreError(reason.message, { cause: reason });
  }

  if (reason == null) {
    return new MeshCoreDeviceError("Device returned an error or did not respond");
  }

  if (typeof reason === "string") {
    switch (reason) {
      case "timeout":
        return new MeshCoreTimeoutError();
      case "disabled":
        return new MeshCoreError("Operation is disabled on this device");
      case "data_too_long":
        return new MeshCoreError("Data is too long for the device to sign");
      default:
        return new MeshCoreError(reason);
    }
  }

  if (typeof reason === "object" && "errCode" in reason) {
    const code = (reason as { errCode: number | null }).errCode ?? undefined;
    return new MeshCoreDeviceError(
      `Device error: ${errorCodeName(code)}`,
      code as ErrorCode | undefined,
    );
  }

  return new MeshCoreError("Unknown device error", { cause: reason });
}
