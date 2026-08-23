"use client";

import { useState } from "react";
import {
  Button,
  DownloadResult,
  ErrorAlert,
  Field,
  FileDropzone,
  ProcessingProgress,
  SelectInput,
  SliderInput,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import type { ResultFile } from "@paperzero/pdf-ui";
import { extractPdfText } from "@paperzero/pdf-operations";
import {
  HANDWRITING_FONTS,
  PAPER_STYLES,
  renderHandwritingPages,
  type HandwritingStyle,
  type PaperStyle,
} from "@/lib/handwriting";
import { runImagesToPdf } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";

const A4_PT: [number, number] = [595.28, 841.89];
const RENDER_SCALE = 150 / 72;

export function PdfToHandwritingClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [sourceText, setSourceText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [paperStyle, setPaperStyle] = useState<PaperStyle>("ruled");
  const [fontIdx, setFontIdx] = useState(1);
  const [inkColor, setInkColor] = useState("#1a2f6b");
  const [fontSizePx, setFontSizePx] = useState(30);
  const [lineSpacing, setLineSpacing] = useState(46);

  const file = docs.readyEntries[0]?.file;
  const style: HandwritingStyle = {
    paperStyle,
    inkColor,
    fontIdx,
    fontSizePx,
    lineHeightPx: lineSpacing,
    topMarginPx: Math.round(lineSpacing * 1.6),
    sideMarginPx: Math.round(lineSpacing * 1.4),
  };

  const handleExtract = () => {
    if (!file) return;
    setExtracting(true);
    void (async () => {
      try {
        const result = await extractPdfText(file, {});
        setSourceText(result.pages.map((p) => p.lines.join("\n\n")).join("\n\n\n"));
      } finally {
        setExtracting(false);
      }
    })();
  };

  const handleRender = () => {
    void op.start(async (signal, onProgress) => {
      onProgress({ phase: "rendering", message: "Rendering handwriting pages…" });
      const pages = await renderHandwritingPages(sourceText, style, {
        pageWidthPx: Math.round(A4_PT[0] * RENDER_SCALE),
        pageHeightPx: Math.round(A4_PT[1] * RENDER_SCALE),
        signal,
        onProgress: (completed, total) =>
          onProgress({ phase: "rendering", completed, total, message: `Page ${completed}/${total}` }),
      });

      onProgress({ phase: "assembling", message: "Building PDF…" });
      const outcome = await runImagesToPdf(
        getWorkerRunner(),
        pages.map((p) => ({
          name: p.name,
          bytes: p.bytes,
          type: "jpeg" as const,
          widthPx: Math.round(A4_PT[0] * RENDER_SCALE),
          heightPx: Math.round(A4_PT[1] * RENDER_SCALE),
          widthPt: A4_PT[0],
          heightPt: A4_PT[1],
        })),
        { pageSize: "auto", orientation: "portrait", marginPt: 0, fit: "contain" },
        { signal, onProgress }
      );
      return {
        data: outcome.files,
        warnings: [
          ...outcome.warnings,
          "Rendered using your device's handwriting-style fonts as page images. This is a styling effect, not real handwriting — please don't use it to misrepresent authorship.",
        ],
      };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone
        accept="application/pdf,.pdf"
        label="Optional: choose a text PDF to pull words from"
        hint="Or simply paste/type your text below"
        disabled={op.isProcessing || extracting}
        onFiles={(files) => void docs.addFiles(files)}
        onError={() => undefined}
      />
      {file ? (
        <Button variant="secondary" onClick={handleExtract} disabled={extracting}>
          {extracting ? "Extracting…" : `Extract text from ${docs.readyEntries[0]?.name}`}
        </Button>
      ) : null}

      <Field label="Your text" htmlFor="hw-text">
        <textarea
          id="hw-text"
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          rows={10}
          placeholder="Paste or type the notes you want styled…"
          className="w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </Field>

      <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Paper & style</legend>
        <Field label="Paper style" htmlFor="hw-paper">
          <SelectInput id="hw-paper" value={paperStyle} onChange={(e) => setPaperStyle(e.target.value as PaperStyle)}>
            {PAPER_STYLES.map((style_) => (
              <option key={style_} value={style_}>{style_}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Writing style" htmlFor="hw-font">
          <SelectInput id="hw-font" value={String(fontIdx)} onChange={(e) => setFontIdx(Number(e.target.value))}>
            {HANDWRITING_FONTS.map((f, i) => (
              <option key={f.label} value={i}>{f.label}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Ink color" htmlFor="hw-ink">
          <input
            id="hw-ink"
            type="color"
            value={inkColor}
            onChange={(e) => setInkColor(e.target.value)}
            className="h-11 w-24 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-800"
          />
        </Field>
        <div className="flex flex-col justify-center gap-3">
          <SliderInput label="Letter size" min={18} max={54} value={fontSizePx} onChange={setFontSizePx} format={(v) => `${v}px`} />
          <SliderInput label="Line spacing" min={28} max={90} value={lineSpacing} onChange={setLineSpacing} format={(v) => `${v}px`} />
        </div>
      </fieldset>

      <Button onClick={handleRender} disabled={op.isProcessing || sourceText.trim().length === 0}>
        Render handwriting PDF
      </Button>

      {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Rendering" /> : null}
      {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
      {op.status === "success" && op.result ? (
        <DownloadResult
          toolId="pdf-to-handwriting"
          files={op.result}
          warnings={op.warnings}
          onStartOver={() => op.reset()}
        />
      ) : null}
    </div>
  );
}
