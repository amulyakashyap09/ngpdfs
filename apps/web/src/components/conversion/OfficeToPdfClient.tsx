"use client";

import { useState } from "react";
import {
  runBinaryConversion,
  inspectXlsx,
  type BinaryConversionPayload,
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
import { CompatibilityReport } from "./CompatibilityReport";

type OfficeFormat = Extract<BinaryConversionPayload["format"], "docx" | "xlsx" | "pptx">;

interface OfficeConfig {
  format: OfficeFormat;
  accept: string;
  extensions: string[];
  label: string;
  hint: string;
  button: string;
  maxBytes: number;
  defaultOrientation: ConversionOrientation;
  expectedReport: Report;
  sectionSelection?: boolean;
  preserveSourcePageSize?: boolean;
}

interface OfficeResult {
  files: ResultFile[];
  report: Report;
}

export function OfficeToPdfClient({ config }: { config: OfficeConfig }) {
  const operation = useOperation<OfficeResult>();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [pageSize, setPageSize] = useState<ConversionPageSize>("a4");
  const [orientation, setOrientation] = useState<ConversionOrientation>(config.defaultOrientation);
  const [theme, setTheme] = useState<ConversionTheme>(config.format === "docx" ? "academic" : "clean");
  const [marginPt, setMarginPt] = useState(42);
  const [fontSize, setFontSize] = useState(10);
  const [pageNumbers, setPageNumbers] = useState(true);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);

  const choose = async (selected: File) => {
    const extension = selected.name.toLowerCase().split(".").at(-1) ?? "";
    if (!config.extensions.includes(extension)) {
      setMessage(`This route supports ${config.extensions.map((item) => `.${item}`).join(", ")} only.`);
      return;
    }
    if (selected.size > config.maxBytes) {
      setMessage(`${config.format.toUpperCase()} input is limited to ${formatBytes(config.maxBytes)} to protect browser memory.`);
      return;
    }
    setFile(selected);
    setMessage(`${selected.name} · ${formatBytes(selected.size)} · macros and scripts are never executed`);
    operation.reset();
    if (config.sectionSelection && config.format === "xlsx") {
      try {
        const sections = await inspectXlsx(new Uint8Array(await selected.arrayBuffer()));
        setAvailableSections(sections);
        setSelectedSections(sections);
        setMessage(`${selected.name} · ${formatBytes(selected.size)} · ${sections.length} worksheet${sections.length === 1 ? "" : "s"} found locally`);
      } catch (error) {
        setFile(null);
        setMessage(error instanceof Error ? error.message : "Could not inspect this workbook.");
      }
    }
  };

  const convert = () => {
    if (!file) return;
    void operation.start(async (signal, onProgress) => {
      onProgress({ phase: "read", completed: 0, total: 1, message: `Reading local ${config.format.toUpperCase()} file` });
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (signal.aborted) throw PaperZeroError.cancelled();
      const outcome = await runBinaryConversion(getWorkerRunner(), {
        format: config.format,
        bytes,
        sourceName: file.name,
        selectedSections: config.sectionSelection ? selectedSections : undefined,
        options: { pageSize, orientation, marginPt, theme, fontSize, pageNumbers, title: file.name.replace(/\.[^.]+$/, "") },
      }, { signal, onProgress });
      return { data: { files: outcome.files, report: outcome.report }, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone accept={config.accept} label={config.label} hint={config.hint} disabled={operation.isProcessing} onFiles={(files) => void choose(files[0]!)} onError={setMessage} />
      {message ? <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">{message}</p> : null}
      {availableSections.length ? (
        <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <legend className="px-1 text-sm font-semibold">Worksheets to include</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {availableSections.map((section) => <Checkbox key={section} label={section} checked={selectedSections.includes(section)} onChange={(checked) => setSelectedSections((current) => checked ? [...current, section] : current.filter((item) => item !== section))} />)}
          </div>
          <div className="mt-2 flex gap-2"><Button variant="ghost" onClick={() => setSelectedSections(availableSections)}>Select all</Button><Button variant="ghost" onClick={() => setSelectedSections([])}>Clear</Button></div>
        </fieldset>
      ) : null}
      <CompatibilityReport report={operation.result?.report ?? config.expectedReport} />
      {config.preserveSourcePageSize ? (
        <p className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          Each PDF page keeps the source slide dimensions and orientation. No document theme, margins, or page numbers are imposed over the presentation.
        </p>
      ) : (
        <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-700">
          <legend className="px-1 text-sm font-semibold">PDF layout</legend>
          <Field label="Page size" htmlFor={`${config.format}-size`}><SelectInput id={`${config.format}-size`} value={pageSize} onChange={(event) => setPageSize(event.target.value as ConversionPageSize)}><option value="a4">A4</option><option value="letter">Letter</option></SelectInput></Field>
          <Field label="Orientation" htmlFor={`${config.format}-orientation`}><SelectInput id={`${config.format}-orientation`} value={orientation} onChange={(event) => setOrientation(event.target.value as ConversionOrientation)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></SelectInput></Field>
          <Field label="Fallback theme" htmlFor={`${config.format}-theme`}><SelectInput id={`${config.format}-theme`} value={theme} onChange={(event) => setTheme(event.target.value as ConversionTheme)}><option value="clean">Clean document</option><option value="academic">Academic</option><option value="technical">Technical</option><option value="minimal">Minimal</option></SelectInput></Field>
          <Field label="Margin (pt)" htmlFor={`${config.format}-margin`}><NumberInput id={`${config.format}-margin`} min={18} max={120} value={marginPt} onChange={(event) => setMarginPt(Number(event.target.value))} /></Field>
          <Field label="Fallback body size" htmlFor={`${config.format}-font`}><NumberInput id={`${config.format}-font`} min={7} max={24} value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></Field>
          <Checkbox label="Add page numbers" checked={pageNumbers} onChange={setPageNumbers} />
        </fieldset>
      )}
      <Button onClick={convert} disabled={!file || operation.isProcessing || (Boolean(availableSections.length) && selectedSections.length === 0)}>{config.button}</Button>
      {operation.isProcessing ? <ProcessingProgress progress={operation.progress} onCancel={operation.cancel} label={`Converting ${config.format.toUpperCase()}`} /> : null}
      {operation.error ? <ErrorAlert error={operation.error} onRetry={() => operation.reset()} /> : null}
      {operation.status === "success" && operation.result ? <DownloadResult toolId={`${config.format}-to-pdf`} files={operation.result.files} warnings={operation.warnings} onStartOver={() => { operation.reset(); setFile(null); }} /> : null}
    </div>
  );
}
