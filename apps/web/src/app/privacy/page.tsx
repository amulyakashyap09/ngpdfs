import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How PaperZero handles your documents: local-first processing, no uploads, no tracking of file content.",
  alternates: { canonical: "/privacy" },
};

const MATRIX: Array<[string, string, string, string]> = [
  ["Merge / Split / Organize / Rotate", "No", "No", "No (after first load)"],
  ["Images to PDF", "No", "No", "No (after first load)"],
  ["PDF to JPG / PNG / ZIP", "No", "No", "No (after first load)"],
  ["Watermark / Page numbers", "No", "No", "No (after first load)"],
  ["Extract text", "No", "No", "No (after first load)"],
  ["Remove metadata", "No", "No", "No (after first load)"],
  ["PDF fingerprint (hash)", "No", "No", "No (after first load)"],
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-10">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Privacy at PaperZero</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        PaperZero is built privacy-first by architecture, not by policy. For every standard tool,
        your document is opened, processed and rendered entirely inside your own browser tab.
        There is no upload step to trust, because there is no server receiving your files.
      </p>

      <h2 id="principles" className="mt-10 text-xl font-bold text-slate-900 dark:text-white">
        Our principles
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        <li><strong>Local first.</strong> If an operation can run on your device, it runs on your device.</li>
        <li><strong>No accounts for core tools.</strong> Every tool on this site works anonymously.</li>
        <li><strong>No watermarks.</strong> We do not degrade free output to push upgrades.</li>
        <li><strong>Minimal analytics.</strong> We only record anonymous usage counters like tool name and duration bucket - never file names, file contents, or extracted text.</li>
        <li><strong>Honesty about exceptions.</strong> When a future feature genuinely needs network access (for example cloud AI), we will say exactly what leaves your device before it does.</li>
      </ul>

      <h2 id="matrix" className="mt-10 text-xl font-bold text-slate-900 dark:text-white">
        Data flow matrix
      </h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th scope="col" className="px-4 py-3">Tool</th>
              <th scope="col" className="px-4 py-3">File uploaded?</th>
              <th scope="col" className="px-4 py-3">Content sent to third party?</th>
              <th scope="col" className="px-4 py-3">Internet required?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
            {MATRIX.map(([tool, uploaded, thirdParty, internet]) => (
              <tr key={tool}>
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{tool}</td>
                <td className="px-4 py-3">{uploaded}</td>
                <td className="px-4 py-3">{thirdParty}</td>
                <td className="px-4 py-3">{internet}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="local-storage" className="mt-10 text-xl font-bold text-slate-900 dark:text-white">
        What stays in your browser
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        Optional convenience data (like a recent-activity list) is stored only in your browser using
        IndexedDB and localStorage. It never syncs anywhere, and you can clear it at any time from
        your browser settings. Clearing site data removes everything instantly.
      </p>

      <h2 id="security" className="mt-10 text-xl font-bold text-slate-900 dark:text-white">
        Security measures
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        <li>A strict Content Security Policy restricts scripts to this origin.</li>
        <li>Documents are processed inside Web Workers with strict input validation.</li>
        <li>Embedded PDF JavaScript is never executed.</li>
        <li>All processing assets are self-hosted; no third-party scripts run on tool pages.</li>
      </ul>

      <p className="mt-10 text-xs text-slate-400">
        This page describes the current PaperZero release. Features under active development may
        update these guarantees, and any change will be documented here before launch.
      </p>
    </div>
  );
}
