import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How NGPDFs Works",
  description:
    "The engineering behind local-first PDF processing: File API, Web Workers, PDF.js, pdf-lib and offline caching.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-10">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">How NGPDFs works</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        NGPDFs turns your browser into a document workshop. Here is the journey a file takes -
        and how short that journey is compared to traditional online converters.
      </p>

      <section className="mt-10" aria-labelledby="lifecycle">
        <h2 id="lifecycle" className="text-xl font-bold text-slate-900 dark:text-white">The local file lifecycle</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <li><strong>Select</strong> - you pick files with the dropzone; the File API hands us references, never uploads.</li>
          <li><strong>Validate</strong> - magic bytes are checked so a renamed file cannot sneak through.</li>
          <li><strong>Transfer</strong> - bytes move into a Web Worker via transferable ArrayBuffers, keeping your UI at 60fps.</li>
          <li><strong>Process</strong> - pdf-lib rewrites structure (merge, split, rotate, watermark); PDF.js renders pages to canvas for previews and image exports.</li>
          <li><strong>Verify</strong> - outputs are re-parsed to confirm page counts and validity before we call it success.</li>
          <li><strong>Download</strong> - a Blob is created in memory and saved straight from your browser.</li>
        </ol>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">{`Your file
   |
   v
Browser memory (ArrayBuffer)
   |
   v
Web Worker  -->  pdf-lib / PDF.js
   |
   v
Validated output Blob
   |
   v
Download  (no server anywhere)`}</pre>
      </section>

      <section className="mt-10" aria-labelledby="engines">
        <h2 id="engines" className="text-xl font-bold text-slate-900 dark:text-white">One engine, many tools</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Every tool composes the same shared operations instead of being its own mini-app. Merge,
          organize and rotate all use one page-descriptor engine. Watermark and page numbers share
          one placement coordinate system - which is why the live preview matches the exported file.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="memory">
        <h2 id="memory" className="text-xl font-bold text-slate-900 dark:text-white">Memory and device safety</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Before high-resolution work we estimate render memory from page size and DPI, clamp canvas
          dimensions to what your device can handle, process pages in small batches, release canvases
          eagerly, and let you cancel anything mid-flight. Phones get conservative defaults;
          desktops can push higher quality.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="offline-section">
        <h2 id="offline-section" className="text-xl font-bold text-slate-900 dark:text-white">Offline by design</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          A service worker caches the app shell and all processing assets after your first visit.
          After that, every tool on this site keeps working without internet - see{" "}
          <a href="/offline" className="text-blue-600 hover:underline dark:text-blue-400">Offline mode</a>.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="roadmap-note">
        <h2 id="roadmap-note" className="text-xl font-bold text-slate-900 dark:text-white">What comes next</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          The roadmap adds compression (WASM), OCR, encryption, true redaction and a workflow
          builder - all under the same rule: if it can run locally, it will run locally. Tools that
          genuinely require network access will always disclose exactly what leaves your device.
        </p>
      </section>
    </div>
  );
}
