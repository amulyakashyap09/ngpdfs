"use client";

import { useState } from "react";
import {
  runPdfExport,
  type AnalyzedPdf,
  type OutputCompatibility,
  type ReadingOrderMode,
} from "@paperzero/pdf-extraction";
import {
  Button,
  Checkbox,
  DownloadResult,
  ErrorAlert,
  Field,
  FileDropzone,
  NumberInput,
  ProcessingProgress,
  SelectInput,
  TextInput,
  useFileDocuments,
  useOperation,
  type ResultFile,
} from "@paperzero/pdf-ui";
import { parsePageRanges } from "@paperzero/shared";
import { analyzeLocalPdf } from "@/lib/pdf-layout-analysis";
import { getWorkerRunner } from "@/lib/worker-runner";
import { ExtractionCompatibilityReport } from "./ExtractionCompatibilityReport";

type SemanticFormat = "docx" | "html" | "epub";

interface SemanticConfig {
  format: SemanticFormat;
  toolId: string;
  button: string;
  tradeoff: string;
  expected: OutputCompatibility;
}

interface SemanticResult {
  files: ResultFile[];
  compatibility: OutputCompatibility;
  document: AnalyzedPdf;
}

export function SemanticPdfExportClient({ config }: { config: SemanticConfig }) {
  const docs = useFileDocuments("pdf");
  const operation = useOperation<SemanticResult>();
  const [ranges, setRanges] = useState("");
  const [readingOrder, setReadingOrder] = useState<ReadingOrderMode>("columns");
  const [removeMargins, setRemoveMargins] = useState(true);
  const [integrateOcr, setIntegrateOcr] = useState(true);
  const [includePageBreaks, setIncludePageBreaks] = useState(true);
  const [htmlMode, setHtmlMode] = useState<"semantic" | "layout">("semantic");
  const [pagesPerChapter, setPagesPerChapter] = useState(5);
  const entry = docs.readyEntries[0];

  const convert = () => {
    if (!entry) return;
    void operation.start(async (signal, onProgress) => {
      const pages = ranges.trim() && entry.pageCount ? parsePageRanges(ranges, entry.pageCount).pages : undefined;
      const document = await analyzeLocalPdf(entry.file, { pages, readingOrder, removeRepeatedHeadersFooters: removeMargins, integrateOcr, signal, onProgress });
      const payload = config.format === "docx"
        ? { format: "docx" as const, document, sourceName: entry.name, includePageBreaks }
        : config.format === "html"
          ? { format: "html" as const, document, sourceName: entry.name, mode: htmlMode }
          : { format: "epub" as const, document, sourceName: entry.name, pagesPerChapter };
      const output = await runPdfExport(getWorkerRunner(), payload, { signal, onProgress });
      return { data: { files: output.files, compatibility: output.compatibility, document }, warnings: output.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"><strong>Fidelity mode:</strong> {config.tradeoff}</p>
      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint="One PDF · layout analysis and output generation stay on this device"
        disabled={operation.isProcessing}
        onFiles={(files) => { operation.reset(); docs.clearAll(); void docs.addFiles(files.slice(0, 1)); }}
        onError={() => undefined}
      />
      {entry ? (
        <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-700">
          <legend className="px-1 text-sm font-semibold">Reconstruction settings</legend>
          <Field label="Pages (optional)" htmlFor={`${config.toolId}-pages`} hint={`Leave empty for all ${entry.pageCount ?? ""} pages`}><TextInput id={`${config.toolId}-pages`} value={ranges} onChange={(event) => setRanges(event.target.value)} placeholder="Example: 1-5,8" /></Field>
          <Field label="Reading order" htmlFor={`${config.toolId}-order`}><SelectInput id={`${config.toolId}-order`} value={readingOrder} onChange={(event) => setReadingOrder(event.target.value as ReadingOrderMode)}><option value="columns">Detect columns</option><option value="visual">Visual top-to-bottom</option></SelectInput></Field>
          <div className="flex flex-col gap-2 pt-6"><Checkbox label="Remove repeated headers/footers" checked={removeMargins} onChange={setRemoveMargins} /><Checkbox label="Run integrated local OCR on scanned pages" checked={integrateOcr} onChange={setIntegrateOcr} /></div>
          {config.format === "docx" ? <Checkbox label="Insert page breaks between source pages" checked={includePageBreaks} onChange={setIncludePageBreaks} /> : null}
          {config.format === "html" ? <Field label="HTML mode" htmlFor="pdf-html-mode"><SelectInput id="pdf-html-mode" value={htmlMode} onChange={(event) => setHtmlMode(event.target.value as typeof htmlMode)}><option value="semantic">Semantic and responsive</option><option value="layout">Positioned page layout</option></SelectInput></Field> : null}
          {config.format === "epub" ? <Field label="Pages per chapter" htmlFor="epub-chapter-pages" hint="1–25 source pages"><NumberInput id="epub-chapter-pages" min={1} max={25} value={pagesPerChapter} onChange={(event) => setPagesPerChapter(Number(event.target.value))} /></Field> : null}
        </fieldset>
      ) : null}
      <ExtractionCompatibilityReport report={operation.result?.compatibility ?? config.expected} />
      {operation.result ? <AnalysisSummary document={operation.result.document} /> : null}
      {entry ? <Button onClick={convert} disabled={operation.isProcessing}>{config.button}</Button> : null}
      {operation.isProcessing ? <ProcessingProgress progress={operation.progress} onCancel={operation.cancel} label="Analyzing and reconstructing locally" /> : null}
      {operation.error ? <ErrorAlert error={operation.error} onRetry={() => operation.reset()} /> : null}
      {operation.status === "success" && operation.result ? <DownloadResult toolId={config.toolId} files={operation.result.files} warnings={operation.warnings} onStartOver={() => { operation.reset(); docs.clearAll(); }} /> : null}
    </div>
  );
}

function AnalysisSummary({ document }: { document: AnalyzedPdf }) {
  const tables = document.pages.flatMap((page) => page.tables).filter((table) => table.confidence >= 0.68).length;
  const scanned = document.pages.filter((page) => page.scanned).length;
  return <p role="status" className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">Analyzed {document.pages.length} page{document.pages.length === 1 ? "" : "s"} · {tables} high-confidence table{tables === 1 ? "" : "s"} · {document.removedHeadersFooters.length} repeated margin pattern{document.removedHeadersFooters.length === 1 ? "" : "s"} removed{scanned ? ` · ${scanned} pages still have no usable text` : ""}</p>;
}
