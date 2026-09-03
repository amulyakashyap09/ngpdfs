"use client";

import { useState } from "react";
import { buildLayoutJson, buildLayoutMarkdown, buildLayoutPlainText, pageReadingText, type AnalyzedPdf, type ReadingOrderMode } from "@paperzero/pdf-extraction";
import { Button, Checkbox, ErrorAlert, Field, FileDropzone, ProcessingProgress, SelectInput, TextInput, useFileDocuments, useOperation } from "@paperzero/pdf-ui";
import { triggerDownload } from "@paperzero/pdf-core";
import { parsePageRanges } from "@paperzero/shared";
import { analyzeLocalPdf } from "@/lib/pdf-layout-analysis";

export function ExtractTextClient() {
  const docs = useFileDocuments("pdf");
  const operation = useOperation<AnalyzedPdf>();
  const [ranges, setRanges] = useState("");
  const [order, setOrder] = useState<ReadingOrderMode>("columns");
  const [removeMargins, setRemoveMargins] = useState(true);
  const [integrateOcr, setIntegrateOcr] = useState(true);
  const [copied, setCopied] = useState(false);
  const entry = docs.readyEntries[0];

  const extract = () => {
    if (!entry) return;
    void operation.start(async (signal, onProgress) => {
      const pages = ranges.trim() && entry.pageCount ? parsePageRanges(ranges, entry.pageCount).pages : undefined;
      const result = await analyzeLocalPdf(entry.file, { pages, readingOrder: order, removeRepeatedHeadersFooters: removeMargins, integrateOcr, signal, onProgress });
      return { data: result, warnings: result.warnings };
    });
  };
  const save = (content: string, filename: string, mimeType: string) => triggerDownload({ blob: new Blob([content], { type: mimeType }), filename });
  const copy = async () => {
    if (!operation.result) return;
    try { await navigator.clipboard.writeText(buildLayoutPlainText(operation.result)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard permission can be denied */ }
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone accept="application/pdf,.pdf" label="Choose a PDF or drop it here" hint="Text positions, reading order, and OCR stay on this device" disabled={operation.isProcessing} onFiles={(files) => { operation.reset(); docs.clearAll(); void docs.addFiles(files.slice(0, 1)); }} onError={() => undefined} />
      {entry ? <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-700"><legend className="px-1 text-sm font-semibold">Extract Text V2</legend><Field label="Pages (optional)" htmlFor="extract-ranges" hint={`Leave empty for all ${entry.pageCount ?? ""} pages`}><TextInput id="extract-ranges" value={ranges} onChange={(event) => setRanges(event.target.value)} placeholder="Example: 1-5,8" /></Field><Field label="Reading order" htmlFor="extract-order"><SelectInput id="extract-order" value={order} onChange={(event) => setOrder(event.target.value as ReadingOrderMode)}><option value="columns">Detect columns</option><option value="visual">Visual top-to-bottom</option></SelectInput></Field><div className="flex flex-col gap-2 pt-6"><Checkbox label="Remove repeated headers/footers" checked={removeMargins} onChange={setRemoveMargins} /><Checkbox label="Run integrated local OCR on scanned pages" checked={integrateOcr} onChange={setIntegrateOcr} /></div></fieldset> : null}
      {entry ? <Button onClick={extract} disabled={operation.isProcessing}>Analyze layout and extract text</Button> : null}
      {operation.isProcessing ? <ProcessingProgress progress={operation.progress} onCancel={operation.cancel} label="Extracting positioned text" /> : null}
      {operation.error ? <ErrorAlert error={operation.error} onRetry={() => operation.reset()} /> : null}
      {operation.result ? (
        <>
          <p role="status" className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">{operation.result.pages.length} pages · {operation.result.pages.reduce((sum, page) => sum + page.items.length, 0)} positioned items · {operation.result.removedHeadersFooters.length} repeated margin patterns removed</p>
          <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => void copy()}>{copied ? "Copied ✓" : "Copy all"}</Button><Button variant="secondary" onClick={() => save(buildLayoutPlainText(operation.result!), "extracted-text.txt", "text/plain")}>Download TXT</Button><Button variant="secondary" onClick={() => save(buildLayoutMarkdown(operation.result!), "extracted-text.md", "text/markdown")}>Download Markdown</Button><Button variant="secondary" onClick={() => save(buildLayoutJson(operation.result!), "extracted-layout.json", "application/json")}>Download JSON + bounding boxes</Button><Button variant="secondary" onClick={() => { operation.reset(); docs.clearAll(); }}>Start over</Button></div>
          {operation.warnings.length ? <ul role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">{operation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
          <section aria-label="Extracted text" className="flex flex-col gap-4">{operation.result.pages.map((page) => <article key={page.pageNumber} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Page {page.pageNumber} · {page.columnCount} column{page.columnCount === 1 ? "" : "s"}</h3>{page.items.length ? <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-sans text-sm text-slate-700 dark:text-slate-200">{pageReadingText(page)}</pre> : <p className="text-sm italic text-slate-400">No usable text was found.</p>}</article>)}</section>
        </>
      ) : null}
    </div>
  );
}
