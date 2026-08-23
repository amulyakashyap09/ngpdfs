"use client";

import { useState } from "react";
import {
  Button,
  ColorInput,
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
  overlayTextStyle,
  useFileDocuments,
  useOperation,
  type ResultFile,
} from "@paperzero/pdf-ui";
import { parsePageRanges, PaperZeroError } from "@paperzero/shared";
import { NINE_POSITIONS, resolvePosition, toCssOverlay, type NinePosition } from "@paperzero/pdf-operations";
import { runImageWatermark, runTextWatermark } from "@paperzero/pdf-operations";
import { getWorkerRunner } from "@/lib/worker-runner";

export function WatermarkClient() {
  const docs = useFileDocuments("pdf");
  const op = useOperation<ResultFile[]>();
  const [mode, setMode] = useState<"text" | "image">("text");
  const [text, setText] = useState("CONFIDENTIAL");
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState("#ff0000");
  const [opacity, setOpacity] = useState(20);
  const [rotation, setRotation] = useState(45);
  const [position, setPosition] = useState<NinePosition>("middle-center");
  const [rangesText, setRangesText] = useState("");
  const [imageFile, setImageFile] = useState<{ bytes: Uint8Array; type: "png" | "jpeg" } | null>(null);
  const [imageScale, setImageScale] = useState(40);

  const file = docs.readyEntries[0]?.file;

  const hexToRgb01 = (hex: string): [number, number, number] => {
    const value = hex.replace("#", "");
    return [
      parseInt(value.slice(0, 2), 16) / 255,
      parseInt(value.slice(2, 4), 16) / 255,
      parseInt(value.slice(4, 6), 16) / 255,
    ];
  };

  const handleApply = () => {
    if (!file) return;
    void op.start(async (signal, onProgress) => {
      let pages: number[] | undefined;
      if (rangesText.trim()) {
        const pdfCount = docs.readyEntries[0]?.pageCount;
        if (pdfCount) pages = parsePageRanges(rangesText, pdfCount).pages;
      }
      let outcome;
      if (mode === "image") {
        if (!imageFile) throw new PaperZeroError("INVALID_INPUT", "Choose a PNG or JPG watermark image first.");
        outcome = await runImageWatermark(
          getWorkerRunner(),
          file,
          imageFile,
          {
            scaleFraction: imageScale / 100,
            opacity: opacity / 100,
            rotationDeg: rotation,
            position,
            pages: pages ?? [],
          },
          { signal, onProgress }
        );
      } else {
        outcome = await runTextWatermark(
          getWorkerRunner(),
          file,
          {
            text,
            fontSize,
            opacity: opacity / 100,
            rotationDeg: rotation,
            color: hexToRgb01(color),
            position,
            pages: pages ?? [],
          },
          { signal, onProgress }
        );
      }
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  const handleWatermarkImage = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    const isPng = f.type === "image/png" || /\.png$/i.test(f.name);
    setImageFile({ bytes, type: isPng ? "png" : "jpeg" });
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex flex-1 flex-col gap-4">
        <FileDropzone
          accept="application/pdf,.pdf"
          label="Choose a PDF or drop it here"
          hint="One PDF · live preview updates as you configure"
          disabled={op.isProcessing}
          onFiles={(files) => void docs.addFiles(files)}
          onError={() => undefined}
        />

        {file ? (
          <>
            <Field label="Watermark type" htmlFor="wm-type">
              <SelectInput id="wm-type" value={mode} onChange={(e) => setMode(e.target.value as "text" | "image")}>
                <option value="text">Text</option>
                <option value="image">Image</option>
              </SelectInput>
            </Field>

            {mode === "text" ? (
              <>
                <Field label="Watermark text" htmlFor="wm-text">
                  <TextInput id="wm-text" value={text} onChange={(e) => setText(e.target.value)} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Font size (pt)" htmlFor="wm-size">
                    <NumberInput
                      id="wm-size"
                      min={8}
                      max={200}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                    />
                  </Field>
                  <ColorInput label="Color" value={color} onChange={setColor} />
                </div>
              </>
            ) : (
              <>
                <Field label="Watermark image (PNG or JPG)" htmlFor="wm-image-file">
                  <input
                    id="wm-image-file"
                    type="file"
                    accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files?.[0]) void handleWatermarkImage(Array.from(e.target.files));
                    }}
                    className="block w-full text-sm text-slate-600 dark:text-slate-300"
                  />
                </Field>
                {imageFile ? (
                  <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400">Image loaded ✓</p>
                ) : null}
                <SliderInput label="Image size (% of page width)" min={5} max={100} value={imageScale} onChange={setImageScale} format={(v) => `${v}%`} />
              </>
            )}

            <SliderInput label="Opacity" min={5} max={100} step={5} value={opacity} onChange={setOpacity} format={(v) => `${v}%`} />
            <SliderInput label="Rotation" min={0} max={359} step={15} value={rotation} onChange={setRotation} format={(v) => `${v}°`} />

            <Field label="Position">
              <div className="grid w-fit grid-cols-3 gap-1" role="group" aria-label="Watermark position">
                {NINE_POSITIONS.map((posOption) => (
                  <button
                    key={posOption}
                    type="button"
                    aria-pressed={position === posOption}
                    aria-label={`Position ${posOption.replace("-", " ")}`}
                    onClick={() => setPosition(posOption)}
                    className={`h-11 w-11 rounded border text-xs ${
                      position === posOption
                        ? "border-blue-600 bg-blue-100 dark:bg-blue-900"
                        : "border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                    }`}
                  >
                    ●
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Pages (optional)" htmlFor="wm-ranges" hint="Leave empty for all pages. Example: 2-5">
              <TextInput id="wm-ranges" value={rangesText} onChange={(e) => setRangesText(e.target.value)} placeholder="All pages" />
            </Field>

            <Button onClick={handleApply} disabled={op.isProcessing}>
              Apply watermark & download
            </Button>
          </>
        ) : null}

        {op.isProcessing ? <ProcessingProgress progress={op.progress} onCancel={op.cancel} label="Watermarking" /> : null}
        {op.error ? <ErrorAlert error={op.error} onRetry={() => op.reset()} /> : null}
        {op.status === "success" && op.result ? (
          <DownloadResult
            toolId="watermark-pdf"
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
          <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Live preview — page 1</h2>
          <LivePagePreview
            file={file}
            widthCss={380}
            overlay={({ scale, widthPt, heightPt }) => {
              if (mode === "image") return null;
              const itemWidth = text.length * fontSize * 0.55;
              const point = resolvePosition(position, widthPt, heightPt, itemWidth, fontSize, 0);
              const css = toCssOverlay(point, heightPt, fontSize, scale);
              return (
                <span style={{ ...overlayTextStyle(fontSize, color, opacity / 100, rotation, scale), left: css.left, top: css.top }}>
                  {text || " "}
                </span>
              );
            }}
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Preview uses the same placement math as the exported PDF.
          </p>
        </aside>
      ) : null}
    </div>
  );
}
