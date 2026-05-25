// Post-build: ship the ambient type shim for the untyped `@liamcottle/meshcore.js`
// dependency and make the emitted entry point load it.
//
// Why: dist/*.d.ts import/re-export from "@liamcottle/meshcore.js", which has no
// types. Without the shim, downstream consumers hit `TS7016: Could not find a
// declaration file for module '@liamcottle/meshcore.js'`. The ambient
// declaration in src/meshcore.d.ts isn't emitted by tsc, and tsc strips the
// `/// <reference>` we add in src/index.ts — so we copy the shim and prepend the
// reference to dist/index.d.ts here, which TypeScript follows when a consumer
// imports the package.
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";

copyFileSync("src/meshcore.d.ts", "dist/meshcore.d.ts");

const entry = "dist/index.d.ts";
const reference = '/// <reference path="./meshcore.d.ts" />\n';
const current = readFileSync(entry, "utf8");
if (!current.startsWith(reference)) {
  writeFileSync(entry, reference + current);
}
