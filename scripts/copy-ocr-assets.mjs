import { createRequire } from "node:module";
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const publicDir = join(root, "..", "apps", "web", "public", "ocr");

async function copyCore() {
  const pkg = require.resolve("tesseract.js-core/package.json");
  const sourceDir = dirname(pkg);
  const targetDir = join(publicDir, "core");
  await mkdir(targetDir, { recursive: true });
  for (const name of await readdir(sourceDir)) {
    if (/^tesseract-core(?:-simd|-relaxedsimd)?-lstm\.wasm\.js$/.test(name)) {
      await copyFile(join(sourceDir, name), join(targetDir, name));
    }
  }
}

async function copyWorker() {
  const pkg = require.resolve("tesseract.js/package.json");
  await mkdir(publicDir, { recursive: true });
  await copyFile(
    join(dirname(pkg), "dist", "worker.min.js"),
    join(publicDir, "worker.min.js")
  );
}

async function copyLanguage(code) {
  const pkg = require.resolve(`@tesseract.js-data/${code}/package.json`);
  const targetDir = join(publicDir, "lang");
  await mkdir(targetDir, { recursive: true });
  await copyFile(
    join(dirname(pkg), "4.0.0_best_int", `${code}.traineddata.gz`),
    join(targetDir, `${code}.traineddata.gz`)
  );
}

async function main() {
  try {
    // This directory is generated and gitignored. Recreate it so a build cannot
    // accidentally ship stale/non-LSTM core variants left by an older install.
    await rm(publicDir, { recursive: true, force: true });
    await Promise.all([copyCore(), copyWorker(), copyLanguage("eng"), copyLanguage("spa")]);
    console.log("[copy-ocr-assets] copied Tesseract worker, cores, and eng/spa data");
  } catch (error) {
    if (error?.code === "MODULE_NOT_FOUND") {
      console.log("[copy-ocr-assets] OCR dependencies not installed yet, skipping");
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.warn("[copy-ocr-assets] failed:", error?.message ?? error);
  process.exitCode = 1;
});
