import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline mode",
  description: "PaperZero keeps working without internet after its first load. Here is how offline mode works.",
  alternates: { canonical: "/offline" },
};

export default function OfflinePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-10">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Offline mode</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        You are viewing this page, which usually means the network dropped. If you had opened
        PaperZero before, all tools remain fully functional - your files were always going to be
        processed on this device anyway.
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
        <li>Navigate back to <Link href="/" className="text-blue-600 underline dark:text-blue-400">the home page</Link> and pick a tool.</li>
        <li>Everything you used at least once is cached, including the PDF engines.</li>
        <li>No document data is lost when connectivity drops mid-session.</li>
      </ul>
      <p className="mt-6 text-xs text-slate-400">
        First-time visitors need one online visit to cache the app. After that, PaperZero is a
        locally installed web app.
      </p>
    </div>
  );
}
