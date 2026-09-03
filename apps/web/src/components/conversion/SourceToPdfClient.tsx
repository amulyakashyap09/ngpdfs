"use client";

import { useMemo, useState } from "react";
import {
  decodeTextBytes,
  parseCsv,
  parseHtml,
  parseMarkdown,
  runSourceConversion,
  type CompatibilityReport as Report,
  type ConversionOrientation,
  type ConversionPageSize,
  type ConversionSourceFormat,
  type ConversionTheme,
  type PortableDocument,
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
  TextInput,
  useOperation,
  type ResultFile,
} from "@paperzero/pdf-ui";
import { getWorkerRunner } from "@/lib/worker-runner";
import { CompatibilityReport } from "./CompatibilityReport";
import { DocumentPreview } from "./DocumentPreview";

interface ConverterConfig {
  format: Exclude<ConversionSourceFormat, "rich-text" | "audio">;
  accept: string;
  uploadLabel: string;
  uploadHint: string;
  editorLabel: string;
  placeholder: string;
  initialSource: string;
}

interface ConversionUiResult {
  files: ResultFile[];
  report: Report;
}

export function SourceToPdfClient({ config }: { config: ConverterConfig }) {
  const operation = useOperation<ConversionUiResult>();
  const [source, setSource] = useState(config.initialSource);
  const [sourceName, setSourceName] = useState(`document.${config.format === "markdown" ? "md" : config.format}`);
  const [title, setTitle] = useState("");
  const [pageSize, setPageSize] = useState<ConversionPageSize>("a4");
  const [orientation, setOrientation] = useState<ConversionOrientation>(config.format === "csv" ? "landscape" : "portrait");
  const [theme, setTheme] = useState<ConversionTheme>(config.format === "markdown" ? "technical" : "clean");
  const [marginPt, setMarginPt] = useState(42);
  const [fontSize, setFontSize] = useState(11);
  const [pageNumbers, setPageNumbers] = useState(true);
  const [delimiter, setDelimiter] = useState<"auto" | "," | ";" | "\t" | "|">("auto");
  const [headerRow, setHeaderRow] = useState(true);
  const [striped, setStriped] = useState(true);
  const [rowLimit, setRowLimit] = useState(5000);
  const [inputMessage, setInputMessage] = useState("");

  const preview = useMemo<{ document: PortableDocument; report: Report }>(() => {
    try {
      if (config.format === "markdown") return parseMarkdown(source, title);
      if (config.format === "csv") return parseCsv(source, { delimiter, headerRow, striped, maxRows: Math.min(rowLimit, 200) }, title);
      return parseHtml(source, title);
    } catch (error) {
      return {
        document: { title, blocks: [] },
        report: { format: config.format, preserved: [], approximated: [], omitted: [], warnings: [error instanceof Error ? error.message : "Preview failed."] },
      };
    }
  }, [config.format, delimiter, headerRow, rowLimit, source, striped, title]);

  const importFile = async (file: File) => {
    setInputMessage("");
    if (file.size > 20 * 1024 * 1024) {
      setInputMessage("Text-based input is limited to 20 MB to protect browser memory.");
      return;
    }
    try {
      const decoded = decodeTextBytes(new Uint8Array(await file.arrayBuffer()));
      setSource(decoded.text);
      setSourceName(file.name);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      setInputMessage(decoded.warning ?? `${file.name} loaded locally as ${decoded.encoding.toUpperCase()}.`);
    } catch (error) {
      setInputMessage(error instanceof Error ? error.message : "Could not read that file.");
    }
  };

  const convert = () => {
    if (!source.trim()) return;
    void operation.start(async (signal, onProgress) => {
      const outcome = await runSourceConversion(getWorkerRunner(), {
        format: config.format,
        source,
        sourceName,
        options: {
          pageSize,
          orientation,
          marginPt,
          theme,
          fontSize,
          pageNumbers,
          title: title.trim() || undefined,
          csv: config.format === "csv" ? { delimiter, headerRow, striped, maxRows: rowLimit } : undefined,
        },
      }, { signal, onProgress });
      return { data: { files: outcome.files, report: outcome.report }, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone accept={config.accept} label={config.uploadLabel} hint={config.uploadHint} disabled={operation.isProcessing} onFiles={(files) => void importFile(files[0]!)} onError={setInputMessage} />
      {inputMessage ? <p role="status" className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">{inputMessage}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Field label={config.editorLabel} htmlFor={`${config.format}-source`}>
            <textarea id={`${config.format}-source`} value={source} onChange={(event) => setSource(event.target.value)} rows={18} placeholder={config.placeholder} spellCheck={config.format !== "csv"} className="w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-2 focus:outline-blue-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
          </Field>
          <Field label="Document title" htmlFor={`${config.format}-title`}><TextInput id={`${config.format}-title`} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional title" /></Field>
        </div>
        <DocumentPreview document={preview.document} />
      </div>

      <CompatibilityReport report={preview.report} />

      <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold">PDF layout</legend>
        <Field label="Page size" htmlFor={`${config.format}-page-size`}><SelectInput id={`${config.format}-page-size`} value={pageSize} onChange={(event) => setPageSize(event.target.value as ConversionPageSize)}><option value="a4">A4</option><option value="letter">Letter</option></SelectInput></Field>
        <Field label="Orientation" htmlFor={`${config.format}-orientation`}><SelectInput id={`${config.format}-orientation`} value={orientation} onChange={(event) => setOrientation(event.target.value as ConversionOrientation)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></SelectInput></Field>
        <Field label="Theme" htmlFor={`${config.format}-theme`}><SelectInput id={`${config.format}-theme`} value={theme} onChange={(event) => setTheme(event.target.value as ConversionTheme)}><option value="clean">Clean document</option><option value="academic">Academic</option><option value="technical">Technical</option><option value="minimal">Minimal</option></SelectInput></Field>
        <Field label="Margin (pt)" htmlFor={`${config.format}-margin`}><NumberInput id={`${config.format}-margin`} min={18} max={120} value={marginPt} onChange={(event) => setMarginPt(Number(event.target.value))} /></Field>
        <Field label="Body size (pt)" htmlFor={`${config.format}-font-size`}><NumberInput id={`${config.format}-font-size`} min={7} max={24} value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></Field>
        <Checkbox label="Add page numbers" checked={pageNumbers} onChange={setPageNumbers} />
      </fieldset>

      {config.format === "csv" ? (
        <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-700">
          <legend className="px-1 text-sm font-semibold">CSV table</legend>
          <Field label="Delimiter" htmlFor="csv-delimiter"><SelectInput id="csv-delimiter" value={delimiter} onChange={(event) => setDelimiter(event.target.value as typeof delimiter)}><option value="auto">Auto-detect</option><option value=",">Comma</option><option value=";">Semicolon</option><option value="\t">Tab</option><option value="|">Pipe</option></SelectInput></Field>
          <Field label="Maximum rows" htmlFor="csv-row-limit" hint="100–10,000"><NumberInput id="csv-row-limit" min={100} max={10000} value={rowLimit} onChange={(event) => setRowLimit(Number(event.target.value))} /></Field>
          <Checkbox label="First row is a header" checked={headerRow} onChange={setHeaderRow} />
          <Checkbox label="Stripe alternate rows" checked={striped} onChange={setStriped} />
        </fieldset>
      ) : null}

      <Button onClick={convert} disabled={operation.isProcessing || !source.trim()}>Convert to PDF</Button>
      {operation.isProcessing ? <ProcessingProgress progress={operation.progress} onCancel={operation.cancel} label="Converting locally" /> : null}
      {operation.error ? <ErrorAlert error={operation.error} onRetry={() => operation.reset()} /> : null}
      {operation.status === "success" && operation.result ? (
        <>
          <CompatibilityReport report={operation.result.report} />
          <DownloadResult toolId={`${config.format}-to-pdf`} files={operation.result.files} warnings={operation.warnings} onStartOver={() => operation.reset()} />
        </>
      ) : null}
      <p className="text-xs text-slate-500">Conversion runs in NGPDFs’ PDF worker. Scripts, macros, frames, and external resource loading are never executed.</p>
    </div>
  );
}
