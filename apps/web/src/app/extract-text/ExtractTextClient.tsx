"use client";

import { useState } from "react";
import {
  Button,
  ErrorAlert,
  Field,
  FileDropzone,
  ProcessingProgress,
  TextInput,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import { parsePageRanges } from "@paperzero/shared";
import { buildMarkdown, buildPlainText, extractPdfText, type ExtractedPageText } from "@paperzero/pdf-operations";
import { triggerDownload } from "@paperzero/pdf-core";

export function ExtractTextClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ExtractedPageText[]>();
  const [rangesText, setRangesText] = useState("");
  const [copied, setCopied] = useState(false);

  const file = docs.readyEntries[0]?.file;

  const handleExtract = () => {
    if (!file) return;
    void op.start(async (signal, onProgress) => {
      let pages: number[] | undefined;
      if (rangesText.trim()) {
        const { countPdfPages } = await import("@paperzero/pdf-operations");
        const total = await countPdfPages(file);
        pages = parsePageRanges(rangesText, total).pages;
      }
      const result = await extractPdfText(file, {
        pages,
        signal,
        onProgress: (completed, total) =>
          onProgress({ phase: "extracting", completed, total, message: `Extracting page ${completed}/${total}` }),
      });
      return { data: result.pages, warnings: result.warnings };
    });
  };

  const fullText = () => buildPlainText(op.result ?? []);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(fullText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      void 0;
    }
  };

  const saveAs = (content: string, filename: string, mime: string) => {
    triggerDownload({ blob: new Blob([content], { type: mime }), filename });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint="One PDF · text never leaves your device"
        disabled={op.isProcessing}
        onFiles={(files) => void docs.addFiles(files)}
        onError={() => undefined}
      />

      {file ? (
        <>
          <Field label="Pages (optional)" htmlFor="et-ranges" hint="Leave empty to extract all pages. Example: 1-5,8">
            <TextInput id="et-ranges" value={rangesText} onChange={(e) => setRangesText(e.target.value)} placeholder="All pages" />
          </Field>
          <Button onClick={handleExtract} disabled={op.isProcessing}>
            Extract text
          </Button>
        </>
      ) : null}

      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Extracting text" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}

      {op.status === "success" && op.result ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void copyAll()}>
              {copied ? "Copied ✓" : "Copy all"}
            </Button>
            <Button variant="secondary" onClick={() => saveAs(fullText(), "extracted-text.txt", "text/plain")}>
              Download .txt
            </Button>
            <Button variant="secondary" onClick={() => saveAs(buildMarkdown(op.result ?? []), "extracted-text.md", "text/markdown")}>
              Download .md
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                op.reset();
                docs.clearAll();
              }}
            >
              Start over
            </Button>
          </div>
          {op.warnings.length > 0 ? (
            <ul className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200" role="note">
              {op.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}
          <section aria-label="Extracted text" className="flex flex-col gap-4">
            {op.result.map((page) => (
              <article key={page.pageNumber} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Page {page.pageNumber}</h3>
                {page.lines.length === 0 ? (
                  <p className="text-sm italic text-slate-400">No text found on this page (possibly scanned).</p>
                ) : (
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-sans text-sm text-slate-700 dark:text-slate-200">{page.lines.join("\n\n")}</pre>
                )}
              </article>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
