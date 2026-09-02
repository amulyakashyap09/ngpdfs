"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  DownloadResult,
  ErrorAlert,
  Field,
  FileDropzone,
  NumberInput,
  ProcessingProgress,
  SelectInput,
  WarningsList,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import {
  runCompression,
  runCompressionAnalysis,
  type CompressionAnalysis,
  type CompressionClientResult,
  type CompressionPreset,
} from "@paperzero/pdf-compression";
import {
  createDocumentFile,
  loadPdfDocument,
  releasePdfDocument,
  renderPageToCanvas,
} from "@paperzero/pdf-core";
import {
  detectCapabilities,
  disposeCanvas,
  formatBytes,
  PaperZeroError,
  suggestOutputName,
  toPaperZeroError,
} from "@paperzero/shared";
import { getCompressionRunner } from "@/lib/compression-runner";

type CompressionMode = "preset" | "target";

const PRESET_COPY: Array<{
  id: CompressionPreset;
  title: string;
  description: string;
}> = [
  { id: "light", title: "Light", description: "220 DPI · high image quality · best for print" },
  { id: "medium", title: "Medium", description: "150 DPI · balanced quality and size" },
  { id: "heavy", title: "Heavy", description: "96 DPI · stronger image recompression" },
];

async function renderValidate(blob: Blob, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw PaperZeroError.cancelled();
  const local = createDocumentFile(blob, {
    name: "compressed-validation.pdf",
    type: "application/pdf",
  });
  try {
    const pdf = await loadPdfDocument(local);
    if (pdf.numPages < 1) {
      throw new PaperZeroError("OUTPUT_INVALID", "The compressed PDF contains no pages.");
    }
    const rendered = await renderPageToCanvas(pdf, 1, {
      scale: 0.35,
      maxDimension: 2048,
      maxPixels: 2 * 1024 * 1024,
    });
    disposeCanvas(rendered.canvas);
  } finally {
    releasePdfDocument(local.id);
    local.dispose();
  }
}

export function CompressClient({ defaultTargetBytes }: { defaultTargetBytes?: number }) {
  const docs = useFileDocuments("pdf");
  const operation = useOperation<CompressionClientResult>();
  const [analysis, setAnalysis] = useState<CompressionAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<PaperZeroError | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [mode, setMode] = useState<CompressionMode>(defaultTargetBytes ? "target" : "preset");
  const [preset, setPreset] = useState<CompressionPreset>("medium");
  const [targetKb, setTargetKb] = useState(Math.round((defaultTargetBytes ?? 200 * 1024) / 1024));
  const capabilities = useMemo(() => detectCapabilities(), []);
  const file = docs.readyEntries[0]?.file;

  useEffect(() => {
    let active = true;
    if (!file) {
      setAnalysis(null);
      setAnalysisError(null);
      return () => {
        active = false;
      };
    }
    setAnalyzing(true);
    setAnalysis(null);
    setAnalysisError(null);
    void runCompressionAnalysis(getCompressionRunner(), file)
      .then((result) => {
        if (active) setAnalysis(result);
      })
      .catch((error) => {
        if (active) setAnalysisError(toPaperZeroError(error));
      })
      .finally(() => {
        if (active) setAnalyzing(false);
      });
    return () => {
      active = false;
    };
  }, [file]);

  const tooLarge = Boolean(file && file.meta.size > capabilities.maxRecommendedFileBytes);
  const constrained = capabilities.deviceClass !== "desktop" || capabilities.memoryClass === "low";

  const handleCompress = () => {
    if (!file || !analysis || tooLarge) return;
    void operation.start(async (signal, onProgress) => {
      const result = await runCompression(
        getCompressionRunner(),
        file,
        {
          preset,
          targetBytes: mode === "target" ? Math.max(20, targetKb) * 1024 : undefined,
          maxAttempts: constrained ? 2 : 4,
        },
        { signal, onProgress }
      );
      if (result.file) {
        onProgress({ phase: "render-check", message: "Rendering a sample page for validation" });
        await renderValidate(result.file.blob, signal);
        result.file.name = suggestOutputName({
          baseNames: [file.meta.name],
          suffix: "compressed",
          extension: "pdf",
        });
      }
      return { data: result, warnings: result.warnings };
    });
  };

  const reset = () => {
    operation.reset();
    docs.clearAll();
    setAnalysis(null);
    setAnalysisError(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <strong>Processed locally in your browser.</strong> Compression runs in a dedicated
        Ghostscript WebAssembly worker. No file is uploaded, and target sizes are best-effort—not
        guaranteed.
      </p>

      <FileDropzone
        accept="application/pdf,.pdf"
        label="Choose a PDF or drop it here"
        hint={`One PDF · recommended maximum on this device: ${formatBytes(capabilities.maxRecommendedFileBytes)}`}
        disabled={operation.isProcessing || analyzing}
        onFiles={(files) => {
          operation.reset();
          docs.clearAll();
          void docs.addFiles(files.slice(0, 1));
        }}
        onError={() => undefined}
      />

      {analyzing ? (
        <ProcessingProgress
          progress={{ phase: "analyzing", message: "Inspecting size, pages, images and optimization hints…" }}
          label="Analyzing"
        />
      ) : null}
      {analysisError ? <ErrorAlert error={analysisError} onRetry={() => setAnalysisError(null)} /> : null}

      {analysis ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-label="Compression preflight">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Preflight</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Metric label="Input" value={formatBytes(analysis.inputBytes)} />
            <Metric label="Pages" value={String(analysis.pageCount)} />
            <Metric label="Content" value={analysis.contentKind.replace("-", " / ")} />
            <Metric label="Compressibility" value={analysis.compressibility} />
            <Metric label="Memory risk" value={analysis.memoryRisk} />
            <Metric label="Time class" value={analysis.timeClass} />
          </dl>
          {analysis.alreadyOptimized ? (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
              This PDF already shows common optimization signals. Compression may save little or
              even make it larger; PaperZero will not offer a larger replacement.
            </p>
          ) : null}
          {analysis.hasSignatureFields ? (
            <p className="mt-3 text-xs text-red-700 dark:text-red-300">
              This PDF contains a signature field. Rewriting the document will normally invalidate
              any existing digital signature, so compress an unsigned copy instead.
            </p>
          ) : null}
        </section>
      ) : null}

      {tooLarge ? (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          This file exceeds the {formatBytes(capabilities.maxRecommendedFileBytes)} safety limit for
          this device. Use a higher-memory desktop or split the PDF first.
        </p>
      ) : null}

      {analysis ? (
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-label="Compression settings">
          <fieldset>
            <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">Workflow</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <ModeOption label="Quality preset" checked={mode === "preset"} onChange={() => setMode("preset")} />
              <ModeOption label="Try a target size" checked={mode === "target"} onChange={() => setMode("target")} />
            </div>
          </fieldset>

          {mode === "preset" ? (
            <fieldset>
              <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">Quality level</legend>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {PRESET_COPY.map((item) => (
                  <label key={item.id} className={`cursor-pointer rounded-xl border p-3 ${preset === item.id ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-slate-200 dark:border-slate-700"}`}>
                    <input type="radio" name="compression-preset" value={item.id} checked={preset === item.id} onChange={() => setPreset(item.id)} className="mr-2 accent-blue-600" />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{item.description}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Common target" htmlFor="compression-target-preset">
                <SelectInput id="compression-target-preset" value={String(targetKb)} onChange={(event) => setTargetKb(Number(event.target.value))}>
                  <option value="100">About 100 KB</option>
                  <option value="200">About 200 KB</option>
                  <option value="1024">About 1 MB</option>
                  <option value="2048">About 2 MB</option>
                  {!([100, 200, 1024, 2048] as number[]).includes(targetKb) ? <option value={targetKb}>Custom</option> : null}
                </SelectInput>
              </Field>
              <Field label="Custom target (KB)" htmlFor="compression-target-kb" hint="Minimum 20 KB. The engine stops after a bounded number of passes.">
                <NumberInput id="compression-target-kb" min={20} max={1024 * 100} value={targetKb} onChange={(event) => setTargetKb(Math.max(20, Number(event.target.value)))} />
              </Field>
            </div>
          )}

          {constrained && mode === "target" ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              This device will use at most two target-size attempts to reduce memory and battery use.
            </p>
          ) : null}
          <Button onClick={handleCompress} disabled={operation.isProcessing || tooLarge}>
            {mode === "target" ? `Try to compress under ${formatBytes(targetKb * 1024)}` : `Compress with ${preset} preset`}
          </Button>
        </section>
      ) : null}

      {operation.isProcessing ? (
        <ProcessingProgress progress={operation.progress} onCancel={operation.cancel} label="Compressing" />
      ) : null}
      {operation.error ? <ErrorAlert error={operation.error} onRetry={() => operation.reset()} /> : null}

      {operation.status === "success" && operation.result ? (
        <CompressionSummary result={operation.result} onStartOver={reset} />
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-semibold capitalize text-slate-800 dark:text-slate-100">{value}</dd>
    </div>
  );
}

function ModeOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-center rounded-lg border px-3 text-sm font-medium ${checked ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-slate-200 dark:border-slate-700"}`}>
      <input type="radio" name="compression-mode" checked={checked} onChange={onChange} className="mr-2 accent-blue-600" />
      {label}
    </label>
  );
}

function CompressionSummary({ result, onStartOver }: { result: CompressionClientResult; onStartOver: () => void }) {
  const { stats } = result;
  return (
    <div className="flex flex-col gap-4">
      <section className={`rounded-xl border p-5 ${stats.beneficial ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40" : "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"}`} aria-label="Compression result">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {stats.beneficial ? `Saved ${stats.percentSaved}%` : "Already optimized"}
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Original" value={formatBytes(stats.originalBytes)} />
          <Metric label="Compressed" value={formatBytes(stats.compressedBytes)} />
          <Metric label="Bytes saved" value={formatBytes(stats.bytesSaved)} />
          <Metric label="Attempts" value={String(stats.attempts)} />
        </dl>
        <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">Final profile: {stats.profileUsed}</p>
        {stats.targetBytes !== undefined ? (
          <p className={`mt-2 text-sm font-semibold ${stats.targetReached ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
            {stats.targetReached ? "✓ Target reached" : "Target not reached within the retry limit"} · {formatBytes(stats.targetBytes)} target
          </p>
        ) : null}
      </section>

      {result.attempts.length > 1 ? (
        <details className="rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700">
          <summary className="cursor-pointer font-semibold">Show bounded compression attempts</summary>
          <ul className="mt-3 space-y-2">
            {result.attempts.map((attempt) => (
              <li key={attempt.profileId} className="flex justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
                <span>{attempt.label} · {attempt.colorDpi} DPI · JPEG {attempt.jpegQuality}</span>
                <span className="font-semibold tabular-nums">{formatBytes(attempt.outputBytes)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {result.file ? (
        <DownloadResult toolId="compress-pdf" files={[result.file]} warnings={result.warnings} onStartOver={onStartOver} />
      ) : (
        <>
          <WarningsList warnings={result.warnings} />
          <Button variant="secondary" onClick={onStartOver}>Try another PDF</Button>
        </>
      )}
    </div>
  );
}
