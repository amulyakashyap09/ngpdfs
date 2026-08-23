"use client";

import { useState } from "react";
import { Button, Field, SelectInput, NumberInput } from "@paperzero/pdf-ui";
import type { LocalDocumentFile } from "@paperzero/pdf-core";
import type { WorkerRunner } from "@paperzero/pdf-operations";
import { runResize } from "@paperzero/pdf-operations";

import type { ResultFile } from "@paperzero/pdf-ui";

export interface ResizePanelProps {
  file: LocalDocumentFile;
  exporting: boolean;
  runner: WorkerRunner;
  onRun: (task: RunTask) => void;
}

export type RunTask = (
  signal: AbortSignal,
  onProgress: (p: { phase: string; completed?: number; total?: number; message?: string }) => void
) => Promise<{ data: ResultFile[]; warnings?: string[] }>;

const PRESETS = [
  { value: "a4", label: "A4 (210 × 297 mm)" },
  { value: "a3", label: "A3 (297 × 420 mm)" },
  { value: "letter", label: "Letter (8.5 × 11 in)" },
  { value: "legal", label: "Legal (8.5 × 14 in)" },
  { value: "custom", label: "Custom size…" },
];

export function ResizePanel({ file, exporting, runner, onRun }: ResizePanelProps) {
  const state = useResizeState();

  const handleApply = () => {
    onRun(async (signal, onProgress) => {
      const outcome = await runResize(
        runner,
        file,
        {
          preset: state.preset,
          orientation: state.orientation,
          mode: state.mode,
          custom:
            state.preset === "custom"
              ? { width: state.customW, height: state.customH, unit: state.unit }
              : undefined,
        },
        { signal, onProgress }
      );
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Pages are rebuilt at the target size with their content scaled as a vector
        layer — text stays sharp. Choose how content should fit the new page.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Target size" htmlFor="rs-preset">
          <SelectInput id="rs-preset" value={state.preset} onChange={(e) => state.setPreset(e.target.value as typeof state.preset)}>
            {PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>{preset.label}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Orientation" htmlFor="rs-orient" hint={state.preset === "custom" ? "Swaps width/height for custom sizes too" : undefined}>
          <SelectInput id="rs-orient" value={state.orientation} onChange={(e) => state.setOrientation(e.target.value as typeof state.orientation)}>
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </SelectInput>
        </Field>
      </div>

      {state.preset === "custom" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Width" htmlFor="rs-w">
            <NumberInput id="rs-w" min={1} step="any" value={state.customW} onChange={(e) => state.setCustomW(Number(e.target.value))} />
          </Field>
          <Field label="Height" htmlFor="rs-h">
            <NumberInput id="rs-h" min={1} step="any" value={state.customH} onChange={(e) => state.setCustomH(Number(e.target.value))} />
          </Field>
          <Field label="Unit" htmlFor="rs-unit">
            <SelectInput id="rs-unit" value={state.unit} onChange={(e) => state.setUnit(e.target.value as typeof state.unit)}>
              <option value="mm">mm</option>
              <option value="in">inches</option>
              <option value="pt">points</option>
            </SelectInput>
          </Field>
        </div>
      ) : null}

      <Field label="Content fit" htmlFor="rs-mode">
        <SelectInput id="rs-mode" value={state.mode} onChange={(e) => state.setMode(e.target.value as typeof state.mode)}>
          <option value="center">Center — scale down to fit, keep aspect</option>
          <option value="fit">Fit — always fill as much as possible</option>
          <option value="fill">Fill — stretch to cover (may crop)</option>
        </SelectInput>
      </Field>

      <Button onClick={handleApply} disabled={exporting}>
        Resize document & download
      </Button>
    </div>
  );
}

function useResizeState() {
  const [preset, setPreset] = useState<"a3" | "a4" | "letter" | "legal" | "custom">("a4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [mode, setMode] = useState<"center" | "fit" | "fill">("center");
  const [customW, setCustomW] = useState(210);
  const [customH, setCustomH] = useState(297);
  const [unit, setUnit] = useState<"mm" | "in" | "pt">("mm");
  return {
    preset,
    setPreset,
    orientation,
    setOrientation,
    mode,
    setMode,
    customW,
    setCustomW,
    customH,
    setCustomH,
    unit,
    setUnit,
  };
}
