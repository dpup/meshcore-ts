/**
 * Monitor a MeshCore node for traffic and print easy-to-read, color-coded logs.
 *
 * Connects over TCP/WiFi, prints the node's identity, then logs every event the
 * device emits — incoming messages, adverts, received packets (RX), path
 * updates, telemetry, traces, etc. — until interrupted (Ctrl-C) or an optional
 * duration elapses.
 *
 * Usage:
 *   bun examples/monitor.ts [host] [port] [seconds]
 *   bun examples/monitor.ts 172.16.0.23 5000 30
 *
 * Defaults: host 172.16.0.23, port 5000, run until Ctrl-C.
 */
// in your project: import { MeshCoreClient } from "@dpup/meshcore-ts"
import { MeshCoreClient } from "../src/index.js";

const host = process.argv[2] ?? "172.16.0.23";
const port = Number(process.argv[3] ?? 5000);
const durationSec = process.argv[4] ? Number(process.argv[4]) : undefined;

// --- tiny ANSI helpers (no-op when not a TTY) ---
const useColor = process.stdout.isTTY === true;
const paint = (code: string, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = (s: string) => paint("2", s);
const bold = (s: string) => paint("1", s);
const C = {
  red: "31",
  green: "32",
  yellow: "33",
  blue: "34",
  magenta: "35",
  cyan: "36",
  gray: "90",
} as const;

const counts = new Map<string, number>();

function log(label: string, color: string, detail = ""): void {
  counts.set(label, (counts.get(label) ?? 0) + 1);
  const ts = dim(new Date().toISOString().slice(11, 23)); // HH:MM:SS.mmm
  console.log(`${ts}  ${paint(color, label.padEnd(14))} ${detail}`);
}

const short = (hex: string, n = 12) => hex.slice(0, n) + (hex.length > n ? "…" : "");

const client = MeshCoreClient.tcp(host, port, { autoSync: true });

// --- traffic events ---
client.on("contactMessage", (m) =>
  log("MESSAGE", C.green, `${dim(short(m.pubKeyPrefix))} ${bold(`"${m.text}"`)}`),
);
client.on("channelMessage", (m) =>
  log("CHANNEL MSG", C.green, `${dim(`ch${m.channelIdx}`)} ${bold(`"${m.text}"`)}`),
);
client.on("channelData", (d) =>
  log("CHANNEL DATA", C.cyan, `ch${d.channelIdx} type=0x${d.dataType.toString(16)} ${d.data.length}B snr=${d.snr}`),
);
client.on("advert", (a) => log("ADVERT", C.blue, dim(short(a.publicKey))));
client.on("newAdvert", (a) =>
  log("NEW ADVERT", C.blue, `${bold(a.advName || "(unnamed)")} type=${a.type} ${dim(short(a.publicKey))}`),
);
client.on("pathUpdated", (p) => log("PATH UPDATED", C.magenta, dim(short(p.publicKey))));
client.on("rawData", (r) => log("RAW DATA", C.gray, `${r.payload.length}B snr=${r.lastSnr} rssi=${r.lastRssi}`));
client.on("logRxData", (r) =>
  log("RX LOG", C.yellow, `${r.raw.length}B snr=${r.lastSnr} rssi=${r.lastRssi}`),
);
client.on("traceData", (t) =>
  log("TRACE", C.magenta, `tag=${t.tag} hops=${t.pathSnrs.length} lastSnr=${t.lastSnr}`),
);
client.on("telemetryResponse", (t) =>
  log("TELEMETRY", C.cyan, `${dim(short(t.pubKeyPrefix))} ${t.lppSensorData.length}B`),
);
client.on("statusResponse", (s) => log("STATUS", C.cyan, `${dim(short(s.pubKeyPrefix))} ${s.statusData.length}B`));
client.on("binaryResponse", (b) => log("BINARY", C.cyan, `tag=${b.tag} ${b.responseData.length}B`));
client.on("sendConfirmed", (s) => log("SEND ACK", C.gray, `ack=${s.ackCode} rtt=${s.roundTrip}`));
client.on("loginSuccess", (l) => log("LOGIN OK", C.green, dim(short(l.pubKeyPrefix))));

// Every raw frame off the wire — the lowest-level view of traffic.
client.on("rx", (frame) => {
  const code = frame.length > 0 ? `0x${frame[0]!.toString(16).padStart(2, "0")}` : "—";
  log("RX FRAME", C.gray, dim(`${frame.length}B code=${code}`));
});

client.on("disconnected", () => {
  log("DISCONNECTED", C.red, "");
  void shutdown("connection closed");
});
client.on("error", (e) => log("ERROR", C.red, e.message));

function printSummary(): void {
  if (counts.size === 0) {
    console.log(dim("\nNo traffic observed."));
    return;
  }
  console.log(bold("\nEvent summary:"));
  for (const [label, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${label.padEnd(14)} ${n}`);
  }
}

let shuttingDown = false;
async function shutdown(reason: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(dim(`\n${reason} — closing…`));
  printSummary();
  try {
    await client.close();
  } catch {
    // ignore close errors during shutdown
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("interrupted"));

async function main(): Promise<void> {
  console.log(bold(`MeshCore traffic monitor`) + dim(` → ${host}:${port}`));
  console.log(dim("connecting…"));
  try {
    await client.connect();
  } catch (error) {
    console.error(paint(C.red, `Failed to connect: ${(error as Error).message}`));
    process.exit(1);
  }

  log("CONNECTED", C.green, dim(`${host}:${port}`));
  try {
    const self = await client.getSelfInfo();
    log("SELF", C.green, `${bold(self.name || "(unnamed)")} ${dim(short(self.publicKey))} freq=${self.radioFreq}`);
  } catch (error) {
    log("SELF", C.yellow, `could not read self info: ${(error as Error).message}`);
  }

  console.log(dim(durationSec ? `monitoring for ${durationSec}s…\n` : "monitoring (Ctrl-C to stop)…\n"));
  if (durationSec) {
    setTimeout(() => void shutdown(`reached ${durationSec}s`), durationSec * 1000);
  }
}

void main();
