import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist", "hosted");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const files = [
  "index.html",
  "styles.css",
  "brushes.js",
  "channels.js",
  "engine.js",
  "effects.js",
  "audio.js",
  "bootloader.js",
  "manifest.json",
  "mint.js",
  "LICENSE",
];
for (const name of files) cpSync(join(root, name), join(out, name));
cpSync(join(root, "tools", "yt.js"), join(out, "yt.js"));
console.log("hosted bundle", out);
