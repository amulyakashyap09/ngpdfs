"use client";

import { useState } from "react";
import {
  runBinaryConversion,
  type CompatibilityReport as Report,
  type ConversionOrientation,
  type ConversionPageSize,
  type ConversionTheme,
} from "@paperzero/pdf-conversion";
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
  useOperation,
  type ResultFile,
} from "@paperzero/pdf-ui";
import { formatBytes, PaperZeroError } from "@paperzero/shared";
import { getWorkerRunner } from "@/lib/worker-runner";
import { CompatibilityReport } from "@/components/conversion/CompatibilityReport";

interface EbookResult {
  files: ResultFile[];
  report: Report;
}

const EXPECTED_REPORT: Report = {
  format: "epub",
  preserved: ["EPUB spine order", "chapter page breaks", "headings and paragraphs", "lists and tables", "local PNG/JPEG images", "TXT and HTML ebooks"],
  approximated: ["basic CSS", "ebook fonts", "widows and orphans"],
  omitted: ["scripts", "DRM", "interactive media", "remote resources", "MOBI/AZW3"],
  warnings: [],
};

export function EbookToPdfClient() {
  const operation = useOperation<EbookResult>();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [pageSize, setPageSize] = useState<ConversionPageSize>("a4");
  const [orientation, setOrientation] = useState<ConversionOrientation>("portrait");
  const [theme, setTheme] = useState<ConversionTheme>("academic");
  const [marginPt, setMarginPt] = useState(48);
  const [fontSize, setFontSize] = useState(11);
  const [pageNumbers, setPageNumbers] = useState(true);

  const choose = (selected: File) => {
    const extension = selected.name.toLowerCase().split(".").at(-1);
    if (!extension || !["epub", "txt", "html", "htm"].includes(extension)) {
      setMessage("Choose an EPUB, TXT, HTML, or HTM ebook. MOBI/AZW3 are not supported or advertised.");
      return;
    }
    if (selected.size > 100 * 1024 * 1024) {
      setMessage("eBook input is limited to 100 MB to protect browser memory.");
      return;
    }
    setFile(selected);
    setMessage(`${selected.name} · ${formatBytes(selected.size)} · held only in this tab`);
    operation.reset();
  };

  const convert = () => {
    if (!file) return;
    void operation.start(async (signal, onProgress) => {
      onProgress({ phase: "read", completed: 0, total: 1, message: "Reading local ebook" });
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (signal.aborted) throw PaperZeroError.cancelled();
      const outcome = await runBinaryConversion(getWorkerRunner(), {
        format: "epub",
        bytes,
        sourceName: file.name,
        options: { pageSize, orientation, marginPt, theme, fontSize, pageNumbers, title: file.name.replace(/\.[^.]+$/, "") },
      }, { signal, onProgress });
      return { data: { files: outcome.files, report: outcome.report }, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone accept="application/epub+zip,text/plain,text/html,.epub,.txt,.html,.htm" label="Choose an EPUB, TXT, or HTML ebook" hint="EPUB/TXT/HTML · local parsing · maximum 100 MB" disabled={operation.isProcessing} onFiles={(files) => choose(files[0]!)} onError={setMessage} />
      {message ? <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">{message}</p> : null}
      <CompatibilityReport report={operation.result?.report ?? EXPECTED_REPORT} />
      <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold">Book layout</legend>
        <Field label="Page size" htmlFor="ebook-size"><SelectInput id="ebook-size" value={pageSize} onChange={(event) => setPageSize(event.target.value as ConversionPageSize)}><option value="a4">A4</option><option value="letter">Letter</option></SelectInput></Field>
        <Field label="Orientation" htmlFor="ebook-orientation"><SelectInput id="ebook-orientation" value={orientation} onChange={(event) => setOrientation(event.target.value as ConversionOrientation)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></SelectInput></Field>
        <Field label="Theme" htmlFor="ebook-theme"><SelectInput id="ebook-theme" value={theme} onChange={(event) => setTheme(event.target.value as ConversionTheme)}><option value="clean">Clean document</option><option value="academic">Academic</option><option value="technical">Technical</option><option value="minimal">Minimal</option></SelectInput></Field>
        <Field label="Margin (pt)" htmlFor="ebook-margin"><NumberInput id="ebook-margin" min={18} max={120} value={marginPt} onChange={(event) => setMarginPt(Number(event.target.value))} /></Field>
        <Field label="Body size (pt)" htmlFor="ebook-font"><NumberInput id="ebook-font" min={7} max={24} value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></Field>
        <Checkbox label="Add page numbers" checked={pageNumbers} onChange={setPageNumbers} />
      </fieldset>
      <Button onClick={convert} disabled={!file || operation.isProcessing}>Convert eBook to PDF</Button>
      {operation.isProcessing ? <ProcessingProgress progress={operation.progress} onCancel={operation.cancel} label="Converting eBook" /> : null}
      {operation.error ? <ErrorAlert error={operation.error} onRetry={() => operation.reset()} /> : null}
      {operation.status === "success" && operation.result ? <DownloadResult toolId="ebook-to-pdf" files={operation.result.files} warnings={operation.warnings} onStartOver={() => { operation.reset(); setFile(null); }} /> : null}
    </div>
  );
}
