import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
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

mkdirSync(join(root, "dist"), { recursive: true });
const zipPath = join(root, "dist", "superpepetv.zip");
rmSync(zipPath, { force: true });

const py = `
import zipfile, sys
root, dest = sys.argv[1], sys.argv[2]
names = sys.argv[3:]
with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as z:
    for name in names:
        z.write(root + "/" + name, arcname=name)
`;
execFileSync("python3", ["-c", py, root, zipPath, ...files], { cwd: root });

const listing = execFileSync("python3", ["-c", `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
print("\\n".join(z.namelist()))
`, zipPath], { encoding: "utf8" });
const names = listing.split("\n").map((line) => line.trim()).filter(Boolean);
if (!names.includes("index.html")) {
  throw new Error("zip is missing index.html at the archive root");
}
if (names.some((name) => name.includes("/") || name.includes("\\"))) {
  throw new Error("zip entries must sit at the root, found " + names.join(", "));
}

const banned = [
  /fonts\.googleapis/i,
  /youtube\.com/i,
  /youtu\.be/i,
  /fxhash\.min|fxhash-adapter|https?:\/\/[^\s"'<>]*fxhash/i,
  /unpkg\.com/i,
  /jsdelivr/i,
  /cdnjs/i,
  /cdn\./i,
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /new\s+WebSocket/,
];

const allowUrl = /https?:\/\/(?:objkt\.com\/create|superpepetv\.mrarwyn\.workers\.dev|github\.com\/|viznut\.fi\/unscii)/i;

for (const name of names) {
  const text = readFileSync(join(root, name), "utf8");
  if (/<script[^>]+src\s*=\s*["']https?:/i.test(text)) {
    throw new Error(name + " loads an external script");
  }
  if (/<link[^>]+href\s*=\s*["']https?:/i.test(text)) {
    throw new Error(name + " loads an external stylesheet");
  }
  for (const rule of banned) {
    if (rule.test(text)) throw new Error(name + " matches banned pattern " + rule);
  }
  const urls = text.match(/https?:\/\/[^\s"'`)<>]+/g) || [];
  for (const url of urls) {
    if (!allowUrl.test(url)) throw new Error(name + " has a non-allowlisted URL " + url);
  }
}

const brushes = readFileSync(join(root, "brushes.js"), "utf8");
const uris = (brushes.match(/data:image\/png/g) || []).length;
if (uris < 16 || uris > 24) {
  throw new Error("expected 16–24 brush data URIs, found " + uris);
}
if (!brushes.includes("var BRUSHES")) throw new Error("brushes.js missing BRUSHES");

writeFileSync(join(root, "dist", "zip-ok.txt"), names.join("\n") + "\nuris " + uris + "\n");
console.log("wrote " + zipPath);
console.log(names.join("\n"));
console.log("brush data URIs: " + uris);
