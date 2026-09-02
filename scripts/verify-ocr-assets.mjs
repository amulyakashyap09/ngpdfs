import { readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = join(root, "..", "apps", "web", "public", "ocr");
const expected = new Map([
  ["worker.min.js", 100_000],
  ["core/tesseract-core-lstm.wasm.js", 3_000_000],
  ["core/tesseract-core-simd-lstm.wasm.js", 3_000_000],
  ["core/tesseract-core-relaxedsimd-lstm.wasm.js", 3_000_000],
  ["lang/eng.traineddata.gz", 2_000_000],
  ["lang/spa.traineddata.gz", 1_500_000],
]);

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else files.push(relative(publicDir, path));
  }
  return files;
}

async function main() {
  const actual = (await filesBelow(publicDir)).sort();
  const wanted = [...expected.keys()].sort();
  if (actual.join("\n") !== wanted.join("\n")) {
    throw new Error(`OCR asset set differs from the pinned manifest.\nExpected: ${wanted.join(", ")}\nActual: ${actual.join(", ")}`);
  }
  for (const [name, minimumBytes] of expected) {
    const details = await stat(join(publicDir, name));
    if (details.size < minimumBytes) {
      throw new Error(`${name} is unexpectedly small (${details.size} bytes).`);
    }
  }
  console.log(`[verify-ocr-assets] verified ${expected.size} pinned local OCR assets`);
}

main().catch((error) => {
  console.error("[verify-ocr-assets] failed:", error?.message ?? error);
  process.exitCode = 1;
});
