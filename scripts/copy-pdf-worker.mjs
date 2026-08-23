import { createRequire } from "node:module";
import { copyFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let pdfjsDir;
  try {
    const pkg = require.resolve("pdfjs-dist/package.json");
    pdfjsDir = dirname(pkg);
  } catch {
    console.log("[copy-pdf-worker] pdfjs-dist not installed yet, skipping");
    return;
  }
  const candidates = [
    "build/pdf.worker.min.mjs",
    "build/pdf.worker.min.js",
    "legacy/build/pdf.worker.min.mjs",
  ];
  for (const rel of candidates) {
    const src = join(pdfjsDir, rel);
    if (await exists(src)) {
      const dest = join(root, "..", "apps", "web", "public", "pdf.worker.min.mjs");
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(src, dest);
      console.log(`[copy-pdf-worker] copied ${rel} -> apps/web/public/pdf.worker.min.mjs`);
      return;
    }
  }
  console.log("[copy-pdf-worker] no worker bundle found in pdfjs-dist");
}

main().catch((err) => {
  console.warn("[copy-pdf-worker] failed:", err?.message ?? err);
});
