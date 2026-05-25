/**
 * Hex <-> byte helpers used throughout the wrapper.
 *
 * meshcore.js represents public keys, paths, secrets and signatures as raw
 * `Uint8Array`s. The wrapper surfaces these as lowercase hex strings (easy to
 * log, compare and store) while still accepting raw bytes as input.
 */

/** A value that can be supplied wherever raw bytes are expected. */
export type Bytes = Uint8Array | string;

/** Encode bytes as a lowercase hex string (no `0x` prefix). */
export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

/** Decode a hex string (with or without a leading `0x`) into bytes. */
export function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error(`Invalid hex string (odd length): "${hex}"`);
  }
  // Validate up front: per-pair `parseInt` would silently accept a valid nibble
  // followed by an invalid one (e.g. "1z" -> 1), so reject any non-hex char.
  if (!/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error(`Invalid hex string: "${hex}"`);
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Coerce a {@link Bytes} value (hex string or `Uint8Array`) to `Uint8Array`. */
export function toBytes(input: Bytes): Uint8Array {
  return typeof input === "string" ? fromHex(input) : input;
}
