"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  ColorInput,
  DownloadResult,
  ErrorAlert,
  Field,
  FileDropzone,
  LivePagePreview,
  ProcessingProgress,
  SliderInput,
  TextInput,
  useFileDocuments,
  useOperation,
} from "@paperzero/pdf-ui";
import type { ResultFile } from "@paperzero/pdf-ui";
import { PaperZeroError, parsePageRanges } from "@paperzero/shared";
import { expandTemplate, zoneX, zoneY } from "@paperzero/pdf-editor";
import { runHeadersFooters } from "@paperzero/pdf-operations";
import type { WorkerRunner } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";

interface Zones {
  header: boolean;
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footer: boolean;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
}

const DEFAULT_ZONES: Zones = {
  header: false,
  headerLeft: "",
  headerCenter: "",
  headerRight: "{filename}",
  footer: true,
  footerLeft: "",
  footerCenter: "Page {n} of {total}",
  footerRight: "{date}",
};

export function HeadersFootersClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [zones, setZones] = useState<Zones>(DEFAULT_ZONES);
  const [fontSize, setFontSize] = useState(10);
  const [colorHex, setColorHex] = useState("#444444");
  const [marginPt, setMarginPt] = useState(28);
  const [skipFirst, setSkipFirst] = useState(false);
  const [rangesText, setRangesText] = useState("");

  const file = docs.readyEntries[0]?.file;
  const fileName = docs.readyEntries[0]?.name ?? "document";

  const buildOptions = (pageCount: number) => {
    let pages: number[] | undefined;
    if (rangesText.trim()) pages = parsePageRanges(rangesText, pageCount).pages;
    const hexTo01 = (value: string): [number, number, number] => [
      parseInt(value.slice(1, 3), 16) / 255,
      parseInt(value.slice(3, 5), 16) / 255,
      parseInt(value.slice(5, 7), 16) / 255,
    ];
    return {
      header: {
        enabled: zones.header,
        template: [zones.headerLeft, zones.headerCenter, zones.headerRight].join("|"),
      },
      footer: {
        enabled: zones.footer,
        template: [zones.footerLeft, zones.footerCenter, zones.footerRight].join("|"),
      },
      fontSize,
      color: hexTo01(colorHex),
      marginPt,
      skipFirst,
      pages: pages ?? [],
      fileName,
    };
  };

  const handleApply = () => {
    if (!file) return;
    void op.start(async (signal, onProgress) => {
      const { countPdfPages } = await import("@paperzero/pdf-operations");
      const pageCount = await countPdfPages(file);
      if (!zones.header && !zones.footer) {
        throw new PaperZeroError("INVALID_INPUT", "Enable at least one header or footer zone.");
      }
      const options = buildOptions(pageCount);
      const outcome = await runHeadersFooters(getWorkerRunner() as unknown as WorkerRunner, file, options, {
        signal,
        onProgress,
      });
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  const hexToCss = (hex: string) => hex;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex flex-1 flex-col gap-4">
        <FileDropzone
          accept="application/pdf,.pdf"
          label="Choose a PDF or drop it here"
          hint="One PDF · stamped locally with live preview"
          disabled={op.isProcessing}
          onFiles={(files) => void docs.addFiles(files)}
          onError={() => undefined}
        />

        {file ? (
          <>
            <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-3 dark:border-slate-700">
              <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={zones.header} onChange={(e) => setZones((z) => ({ ...z, header: e.target.checked }))} className="accent-blue-600" aria-label="Enable header" />
                Header
              </legend>
              <Field label="Left" htmlFor="hl"><TextInput id="hl" value={zones.headerLeft} onChange={(e) => setZones((z) => ({ ...z, headerLeft: e.target.value }))} /></Field>
              <Field label="Center" htmlFor="hc"><TextInput id="hc" value={zones.headerCenter} onChange={(e) => setZones((z) => ({ ...z, headerCenter: e.target.value }))} /></Field>
              <Field label="Right" htmlFor="hr"><TextInput id="hr" value={zones.headerRight} onChange={(e) => setZones((z) => ({ ...z, headerRight: e.target.value }))} /></Field>
            </fieldset>

            <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-3 dark:border-slate-700">
              <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={zones.footer} onChange={(e) => setZones((z) => ({ ...z, footer: e.target.checked }))} className="accent-blue-600" aria-label="Enable footer" />
                Footer
              </legend>
              <Field label="Left" htmlFor="fl"><TextInput id="fl" value={zones.footerLeft} onChange={(e) => setZones((z) => ({ ...z, footerLeft: e.target.value }))} /></Field>
              <Field label="Center" htmlFor="fc"><TextInput id="fc" value={zones.footerCenter} onChange={(e) => setZones((z) => ({ ...z, footerCenter: e.target.value }))} /></Field>
              <Field label="Right" htmlFor="fr"><TextInput id="fr" value={zones.footerRight} onChange={(e) => setZones((z) => ({ ...z, footerRight: e.target.value }))} /></Field>
            </fieldset>

            <p className="rounded-lg bg-slate-100 p-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Variables: <code>{"{n}"}</code> page number · <code>{"{total}"}</code> ·{" "}
              <code>{"{date}"}</code> · <code>{"{filename}"}</code> — filled from the processed
              file name on your device.
            </p>

            <SliderInput label="Font size" min={6} max={24} value={fontSize} onChange={setFontSize} format={(v) => `${v} pt`} />
            <ColorInput label="Color" value={colorHex} onChange={setColorHex} />
            <SliderInput label="Distance from edge" min={8} max={80} value={marginPt} onChange={setMarginPt} format={(v) => `${v} pt`} />
            <Checkbox label="Skip first page" checked={skipFirst} onChange={setSkipFirst} />
            <Field label="Pages (optional)" htmlFor="hf-ranges" hint="Leave empty for all pages. Example: 2-10">
              <TextInput id="hf-ranges" value={rangesText} onChange={(e) => setRangesText(e.target.value)} />
            </Field>

            <Button onClick={handleApply} disabled={op.isProcessing}>
              Add headers & footers
            </Button>
          </>
        ) : null}

        {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Stamping" /> : null}
        {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
        {op.status === "success" && op.result ? (
          <DownloadResult
            toolId="headers-footers"
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
        <aside className="w-full shrink-0 lg:w-[440px]" aria-label="Live preview">
          <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Live preview</h2>
          <LivePagePreview
            file={file}
            pageNumber={skipFirst ? 2 : 1}
            widthCss={420}
            overlay={({ scale, widthPt, heightPt }) => {
              const items: React.ReactNode[] = [];
              const vars = { n: skipFirst ? 2 : 1, total: 99, filename: fileName };
              if (zones.header) {
                for (const [zoneKey, raw] of [["left", zones.headerLeft], ["center", zones.headerCenter], ["right", zones.headerRight]] as const) {
                  if (!raw.trim()) continue;
                  pushZone(items, expandTemplate(raw, vars), zoneKey, "header", heightPt, widthPt, fontSize, marginPt, scale, hexToCss(colorHex));
                }
              }
              if (zones.footer) {
                for (const [zoneKey, raw] of [["left", zones.footerLeft], ["center", zones.footerCenter], ["right", zones.footerRight]] as const) {
                  if (!raw.trim()) continue;
                  pushZone(items, expandTemplate(raw, vars), zoneKey, "footer", heightPt, widthPt, fontSize, marginPt, scale, hexToCss(colorHex));
                }
              }
              return <>{items}</>;
            }}
          />
        </aside>
      ) : null}
    </div>
  );
}

function pushZone(
  items: React.ReactNode[],
  text: string,
  zoneKey: import("@paperzero/pdf-editor").HeaderFooterZone,
  band: "header" | "footer",
  heightPt: number,
  widthPt: number,
  fontSize: number,
  marginPt: number,
  scale: number,
  cssColor: string
) {
  const approxWidth = text.length * fontSize * 0.52;
  const x = zoneX(zoneKey, widthPt, approxWidth, marginPt);
  const yBase = zoneY(band, heightPt, fontSize, marginPt);
  items.push(
    <span
      key={`${band}-${zoneKey}`}
      style={{
        position: "absolute",
        left: x * scale,
        top: (heightPt - yBase - fontSize * 0.85) * scale,
        fontFamily: "Helvetica, Arial, sans-serif",
        fontSize: `${fontSize * scale}px`,
        lineHeight: 1,
        color: cssColor,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}
