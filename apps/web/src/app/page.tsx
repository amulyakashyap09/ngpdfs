import Link from "next/link";
import Script from "next/script";
import { createElement } from "react";
import { ToolCatalog } from "@/components/ToolCatalog";

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20">
      <section className="py-14 text-center sm:py-20">
        <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
          <span aria-hidden="true">🔒</span> 100% local processing for standard tools
        </p>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          PDF tools that never see <span className="text-blue-600">your</span> PDFs.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
          Merge, split, organize, convert, watermark and protect documents directly in your
          browser. Your files stay on your device - no uploads, no watermarks, no account.
        </p>
      </section>
      <ToolCatalog />
      <section className="mt-16 rounded-2xl border border-violet-200 bg-violet-50 p-8 text-center dark:border-violet-900 dark:bg-violet-950/30" aria-labelledby="support-paperzero">
        <h2 id="support-paperzero" className="text-xl font-bold text-slate-900 dark:text-white">Donate ❤️</h2>
        <p className="mx-auto mb-5 mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          If private, browser-local PDF tools save you time, you can support their continued development through Bondin.
        </p>
        <Script async src="https://bondin.io/embed/v1.js" strategy="afterInteractive" />
        {createElement("bondin-support", { username: "amulya", label: "Support me" })}
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          This homepage loads the support widget from bondin.io. No PDF or document content is shared with it.
        </p>
      </section>
      <section className="mt-16 grid gap-6 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-sm leading-relaxed text-slate-600 md:grid-cols-3 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <div>
          <h2 className="mb-2 font-bold text-slate-900 dark:text-white">Zero uploads</h2>
          <p>Every standard operation runs in your browser using Web Workers and WebAssembly-ready libraries. There is no server to trust, because your files never reach one.</p>
        </div>
        <div>
          <h2 className="mb-2 font-bold text-slate-900 dark:text-white">Works offline</h2>
          <p>Once loaded, the app is cached as a PWA. Disconnect and keep working - ideal for sensitive documents on flights or insecure networks.</p>
        </div>
        <div>
          <h2 className="mb-2 font-bold text-slate-900 dark:text-white">No strings attached</h2>
          <p>No sign-up, no email, no watermarks stamped on your output. Just pick a tool and go. See <Link href="/how-it-works" className="text-blue-600 hover:underline dark:text-blue-400">how it works</Link>.</p>
        </div>
      </section>
    </div>
  );
}
