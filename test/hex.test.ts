import { describe, expect, it } from "vitest";
import { fromHex, toBytes, toHex } from "../src/hex.js";

describe("hex", () => {
  it("round-trips bytes", () => {
    const bytes = new Uint8Array([0x00, 0x0f, 0xff, 0xab]);
    expect(toHex(bytes)).toBe("000fffab");
    expect(fromHex("000fffab")).toEqual(bytes);
  });

  it("strips a 0x prefix", () => {
    expect(fromHex("0xABCD")).toEqual(new Uint8Array([0xab, 0xcd]));
  });

  it("throws on odd-length input", () => {
    expect(() => fromHex("abc")).toThrow();
  });

  it("throws on non-hex characters", () => {
    expect(() => fromHex("zz")).toThrow();
  });

  it("throws when a valid nibble is followed by an invalid one", () => {
    // Regression: parseInt("1z", 16) returns 1, so per-pair parsing alone would
    // silently accept this; full validation must reject it.
    expect(() => fromHex("1z")).toThrow();
    expect(() => fromHex("ab1z")).toThrow();
  });

  it("toBytes passes through Uint8Array and decodes hex", () => {
    const u = new Uint8Array([1, 2, 3]);
    expect(toBytes(u)).toBe(u);
    expect(toBytes("010203")).toEqual(u);
  });
});
