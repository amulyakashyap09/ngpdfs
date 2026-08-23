"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  DownloadResult,
  ErrorAlert,
  Field,
  FileDropzone,
  LivePagePreview,
  NumberInput,
  ProcessingProgress,
  SelectInput,
  SliderInput,
  TextInput,
  useFileDocuments,
  useOperation,
  type ResultFile,
} from "@paperzero/pdf-ui";
import { parsePageRanges } from "@paperzero/shared";
import { formatPageLabel, runPageNumbers, type PageNumberAlign, type PageNumberFormat, type PageNumberPosition } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";

const MARGIN_PT = 36;

export function PageNumbersClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [position, setPosition] = useState<PageNumberPosition>("footer");
  const [align, setAlign] = useState<PageNumberAlign>("center");
  const [startNumber, setStartNumber] = useState(1);
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [format, setFormat] = useState<PageNumberFormat>("plain");
  const [fontSize, setFontSize] = useState(12);
  const [skipFirst, setSkipFirst] = useState(false);
  const [rangesText, setRangesText] = useState("");

  const file = docs.readyEntries[0]?.file;
  const pageCount = docs.readyEntries[0]?.pageCount ?? null;

  const previewLabel =
    prefix + formatPageLabel(format, startNumber, Math.max(1, (pageCount ?? 1) - (skipFirst ? 1 : 0))) + suffix;

  const handleApply = () => {
    if (!file) return;
    void op.start(async (signal, onProgress) => {
      let pages: number[] | undefined;
      if (rangesText.trim()) {
        if (!pageCount) throw new Error("Page count unavailable");
        pages = parsePageRanges(rangesText, pageCount).pages;
      }
      const outcome = await runPageNumbers(
        getWorkerRunner(),
        file,
        {
          position,
          align,
          startNumber,
          prefix,
          suffix,
          format,
          fontSize,
          skipFirst,
          pages: pages ?? [],
        },
        { signal, onProgress }
      );
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex flex-1 flex-col gap-4">
        <FileDropzone
          accept="application/pdf,.pdf"
          label="Choose a PDF or drop it here"
          hint="One PDF · live preview included"
          disabled={op.isProcessing}
          onFiles={(files) => void docs.addFiles(files)}
          onError={() => undefined}
        />

        {file ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Position" htmlFor="pn-position">
                <SelectInput id="pn-position" value={position} onChange={(e) => setPosition(e.target.value as PageNumberPosition)}>
                  <option value="footer">Footer</option>
                  <option value="header">Header</option>
                </SelectInput>
              </Field>
              <Field label="Alignment" htmlFor="pn-align">
                <SelectInput id="pn-align" value={align} onChange={(e) => setAlign(e.target.value as PageNumberAlign)}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </SelectInput>
              </Field>
              <Field label="Format" htmlFor="pn-format">
                <SelectInput id="pn-format" value={format} onChange={(e) => setFormat(e.target.value as PageNumberFormat)}>
                  <option value="plain">1</option>
                  <option value="page-n">Page 1</option>
                  <option value="n-of-total">1 / N</option>
                </SelectInput>
              </Field>
              <Field label="Starting number" htmlFor="pn-start">
                <NumberInput id="pn-start" min={1} value={startNumber} onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value)))} />
              </Field>
              <Field label="Prefix" htmlFor="pn-prefix">
                <TextInput id="pn-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. A-" />
              </Field>
              <Field label="Suffix" htmlFor="pn-suffix">
                <TextInput id="pn-suffix" value={suffix} onChange={(e) => setSuffix(e.target.value)} />
              </Field>
            </div>
            <SliderInput label="Font size" min={6} max={36} value={fontSize} onChange={setFontSize} format={(v) => `${v} pt`} />
            <Checkbox label="Skip first page (cover)" checked={skipFirst} onChange={setSkipFirst} />
            <Field label="Pages (optional)" htmlFor="pn-ranges" hint="Leave empty for all pages. Example: 1-10">
              <TextInput id="pn-ranges" value={rangesText} onChange={(e) => setRangesText(e.target.value)} placeholder="All pages" />
            </Field>
            <Button onClick={handleApply} disabled={op.isProcessing}>
              Add page numbers & download
            </Button>
          </>
        ) : null}

        {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Adding page numbers" /> : null}
        {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
        {op.status === "success" && op.result ? (
          <DownloadResult
            toolId="add-page-numbers"
            files={op.result}
            warnings={op.warnings}
            onStartOver={() => {
              op.reset();
              docs.clearAll();
            }}
          />
        ) : null}
      </div>

      {file ? (
        <aside className="w-full shrink-0 lg:w-[420px]" aria-label="Live preview">
          <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Live preview — {skipFirst && pageCount ? "page 2 (numbering starts here)" : "page 1"}
          </h2>
          <LivePagePreview
            file={file}
            pageNumber={skipFirst && pageCount && pageCount > 1 ? 2 : 1}
            widthCss={380}
            overlay={({ scale, widthPt, heightPt }) => {
              const labelWidth = previewLabel.length * fontSize * 0.52;
              const x =
                align === "left"
                  ? MARGIN_PT
                  : align === "right"
                    ? widthPt - labelWidth - MARGIN_PT
                    : (widthPt - labelWidth) / 2;
              const y =
                position === "header"
                  ? heightPt - MARGIN_PT - fontSize * 0.8
                  : heightPt - MARGIN_PT;
              return (
                <span
                  style={{
                    position: "absolute",
                    left: x * scale,
                    top: (heightPt - y - fontSize * 0.9) * scale,
                    fontFamily: "Helvetica, Arial, sans-serif",
                    fontSize: `${fontSize * scale}px`,
                    lineHeight: 1,
                    color: "#111",
                    whiteSpace: "nowrap",
                  }}
                >
                  {previewLabel}
                </span>
              );
            }}
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Shows exactly where the number will appear.
          </p>
        </aside>
      ) : null}
    </div>
  );
}
