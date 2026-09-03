"use client";

import { useState } from "react";
import { runPdfExport, type AnalyzedPdf, type DetectedTable, type OutputCompatibility, type ReadingOrderMode } from "@paperzero/pdf-extraction";
import { Button, Checkbox, DownloadResult, ErrorAlert, Field, FileDropzone, ProcessingProgress, SelectInput, TextInput, useFileDocuments, useOperation, type ResultFile } from "@paperzero/pdf-ui";
import { parsePageRanges } from "@paperzero/shared";
import { ExtractionCompatibilityReport } from "@/components/extraction/ExtractionCompatibilityReport";
import { analyzeLocalPdf } from "@/lib/pdf-layout-analysis";
import { getWorkerRunner } from "@/lib/worker-runner";

interface ExportResult { files: ResultFile[]; compatibility: OutputCompatibility }

const EXPECTED: OutputCompatibility = {
  format: "xlsx", mode: "detected tables", preserved: ["selected table cells", "separate worksheet per table", "text values", "header-row emphasis"], approximated: ["row grouping", "column boundaries", "wrapped-cell merging", "header inference"], omitted: ["low-confidence prose", "source formulas", "cell types", "images", "charts", "PDF JavaScript"], warnings: [],
};

export function PdfToExcelClient() {
  const docs = useFileDocuments("pdf");
  const analysis = useOperation<AnalyzedPdf>();
  const exporting = useOperation<ExportResult>();
  const [ranges, setRanges] = useState("");
  const [order, setOrder] = useState<ReadingOrderMode>("columns");
  const [removeMargins, setRemoveMargins] = useState(true);
  const [integrateOcr, setIntegrateOcr] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const entry = docs.readyEntries[0];
  const tables = analysis.result?.pages.flatMap((page) => page.tables) ?? [];

  const detect = () => {
    if (!entry) return;
    void analysis.start(async (signal, onProgress) => {
      const pages = ranges.trim() && entry.pageCount ? parsePageRanges(ranges, entry.pageCount).pages : undefined;
      const document = await analyzeLocalPdf(entry.file, { pages, readingOrder: order, removeRepeatedHeadersFooters: removeMargins, integrateOcr, tableMinConfidence: 0.68, signal, onProgress });
      setSelected(document.pages.flatMap((page) => page.tables).filter((table) => table.confidence >= 0.68).map((table) => table.id));
      return { data: document, warnings: document.warnings };
    });
  };

  const exportTables = () => {
    if (!entry || !analysis.result || !selected.length) return;
    void exporting.start(async (signal, onProgress) => {
      const result = await runPdfExport(getWorkerRunner(), { format: "xlsx", document: analysis.result!, sourceName: entry.name, selectedTableIds: selected }, { signal, onProgress });
      return { data: { files: result.files, compatibility: result.compatibility }, warnings: result.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"><strong>Table extraction, not arbitrary page conversion:</strong> only recurring aligned rows and columns receive a confidence score. Low-confidence prose is not forced into spreadsheet cells.</p>
      <FileDropzone accept="application/pdf,.pdf" label="Choose a PDF containing tables" hint="One PDF · detection and XLSX generation stay local" disabled={analysis.isProcessing || exporting.isProcessing} onFiles={(files) => { analysis.reset(); exporting.reset(); setSelected([]); docs.clearAll(); void docs.addFiles(files.slice(0, 1)); }} onError={() => undefined} />
      {entry ? (
        <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-700">
          <legend className="px-1 text-sm font-semibold">Detection settings</legend>
          <Field label="Pages (optional)" htmlFor="excel-pages" hint={`Leave empty for all ${entry.pageCount ?? ""} pages`}><TextInput id="excel-pages" value={ranges} onChange={(event) => setRanges(event.target.value)} placeholder="Example: 1-3,8" /></Field>
          <Field label="Reading order" htmlFor="excel-order"><SelectInput id="excel-order" value={order} onChange={(event) => setOrder(event.target.value as ReadingOrderMode)}><option value="columns">Detect columns</option><option value="visual">Visual top-to-bottom</option></SelectInput></Field>
          <div className="flex flex-col gap-2 pt-6"><Checkbox label="Remove repeated headers/footers" checked={removeMargins} onChange={setRemoveMargins} /><Checkbox label="Run integrated local OCR on scanned pages" checked={integrateOcr} onChange={setIntegrateOcr} /></div>
        </fieldset>
      ) : null}
      {entry ? <Button onClick={detect} disabled={analysis.isProcessing || exporting.isProcessing}>Detect tables locally</Button> : null}
      {analysis.isProcessing ? <ProcessingProgress progress={analysis.progress} onCancel={analysis.cancel} label="Analyzing table geometry" /> : null}
      {analysis.error ? <ErrorAlert error={analysis.error} onRetry={() => analysis.reset()} /> : null}
      {analysis.result ? (
        <section className="flex flex-col gap-4" aria-label="Detected tables">
          <div><h2 className="text-base font-bold">Detected tables</h2><p className="text-xs text-slate-500">{tables.length ? `${tables.length} candidate${tables.length === 1 ? "" : "s"}; only confidence of 68% or higher can be exported.` : "No sufficiently aligned table candidates were found. Prose was not converted into a grid."}</p></div>
          {tables.map((table) => <TableCandidate key={table.id} table={table} checked={selected.includes(table.id)} onChange={(checked) => setSelected((current) => checked ? [...current, table.id] : current.filter((id) => id !== table.id))} />)}
        </section>
      ) : null}
      <ExtractionCompatibilityReport report={exporting.result?.compatibility ?? EXPECTED} />
      {analysis.result && tables.length ? <Button onClick={exportTables} disabled={!selected.length || exporting.isProcessing}>Export {selected.length} selected table{selected.length === 1 ? "" : "s"} to XLSX</Button> : null}
      {exporting.isProcessing ? <ProcessingProgress progress={exporting.progress} onCancel={exporting.cancel} label="Building local XLSX" /> : null}
      {exporting.error ? <ErrorAlert error={exporting.error} onRetry={() => exporting.reset()} /> : null}
      {exporting.status === "success" && exporting.result ? <DownloadResult toolId="pdf-to-excel" files={exporting.result.files} warnings={exporting.warnings} onStartOver={() => { exporting.reset(); analysis.reset(); docs.clearAll(); }} /> : null}
    </div>
  );
}

function TableCandidate({ table, checked, onChange }: { table: DetectedTable; checked: boolean; onChange: (checked: boolean) => void }) {
  const exportable = table.confidence >= 0.68;
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 dark:bg-slate-900"><Checkbox label={`Page ${table.pageNumber} · ${table.rows.length} × ${Math.max(...table.rows.map((row) => row.length))}`} checked={checked} disabled={!exportable} onChange={onChange} /><span className={`rounded-full px-2 py-1 text-xs font-bold ${exportable ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"}`}>{Math.round(table.confidence * 100)}% confidence</span></div>
      <div className="overflow-auto"><table className="min-w-full border-collapse text-xs"><tbody>{table.rows.slice(0, 8).map((row, rowIndex) => <tr key={rowIndex}>{row.slice(0, 8).map((cell, columnIndex) => <td key={columnIndex} className="border border-slate-200 p-2 dark:border-slate-700">{cell}</td>)}</tr>)}</tbody></table></div>
      <p className="p-3 text-xs text-slate-500">{table.confidenceReasons.join(" · ")}</p>
    </article>
  );
}
