/**
 * Connect to a MeshCore device over TCP, print self info + contacts, and log
 * incoming messages until interrupted.
 *
 * Run with a TS runner, e.g.:
 *   bunx tsx examples/list-contacts.ts 192.168.1.50 5000
 */
import { MeshCoreClient } from "../src/index.js";

async function main(): Promise<void> {
  const [host, portStr] = process.argv.slice(2);
  if (!host || !portStr) {
    console.error("Usage: list-contacts <host> <port>");
    process.exit(1);
  }

  const client = MeshCoreClient.tcp(host, Number(portStr));

  client.on("contactMessage", (msg) => {
    console.log(`[${msg.senderTimestamp.toISOString()}] ${msg.pubKeyPrefix}: ${msg.text}`);
  });
  client.on("disconnected", () => console.log("disconnected"));

  await client.connect();

  const self = await client.getSelfInfo();
  console.log(`Connected to "${self.name}" (${self.publicKey.slice(0, 12)}…)`);

  const contacts = await client.getContacts();
  console.log(`\n${contacts.length} contacts:`);
  for (const contact of contacts) {
    console.log(
      `  - ${contact.advName} [${contact.publicKey.slice(0, 12)}…]` +
        ` last seen ${contact.lastAdvert.toISOString()}`,
    );
  }

  console.log("\nListening for messages (Ctrl-C to exit)…");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
