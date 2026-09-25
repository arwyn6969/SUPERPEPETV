import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const context = {
  console,
  URLSearchParams,
  document: { getElementById: () => null, addEventListener() {}, readyState: "complete" },
  window: {},
};
context.window = context;
vm.runInNewContext(readFileSync(join(root, "mint.js"), "utf8"), context, { filename: "mint.js" });
const code = context.SPTVMint.encode("0123456789abcdef", 1, 0xabcd);
const back = context.SPTVMint.decode(code);
if (!back || back.seed !== "0123456789abcdef" || back.channel !== 1 || back.variation !== 0xabcd) {
  throw new Error("roundtrip failed " + code + " " + JSON.stringify(back));
}
const bad = context.SPTVMint.decode(code.slice(0, -1) + (code.endsWith("0") ? "1" : "0"));
if (bad) throw new Error("bad checksum was accepted");
if (!context.SPTVMint.decode("  " + code.toUpperCase() + "  ")) throw new Error("uppercase paste failed");
console.log("SPTV1 ok", code);
