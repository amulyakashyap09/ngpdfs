"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./primitives";

export interface SignatureResult {
  bytes: Uint8Array;
  type: "png";
}

export interface SignatureModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (result: SignatureResult) => void;
}

const TYPE_FONTS = [
  { label: "Script", stack: "'Segoe Script', 'Brush Script MT', cursive" },
  { label: "Handwriting", stack: "'Bradley Hand', 'Comic Sans MS', cursive" },
  { label: "Serif italic", stack: "Georgia, 'Times New Roman', serif" },
];

const CANVAS_W = 500;
const CANVAS_H = 160;

export function SignatureModal({ open, onCancel, onConfirm }: SignatureModalProps) {
  const [mode, setMode] = useState<"draw" | "type" | "upload">("draw");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const strokesRef = useRef<Array<Array<{ x: number; y: number }>>>([]);
  const [typedName, setTypedName] = useState("");
  const [typeFontIdx, setTypeFontIdx] = useState(0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [removeWhite, setRemoveWhite] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && mode === "draw") {
      requestAnimationFrame(() => clearCanvas());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- canvas reset only when opening/mode switch
  }, [open, mode]);

  if (!open) return null;

  const ctx2d = () => canvasRef.current?.getContext("2d") ?? null;

  function clearCanvas() {
    const ctx = ctx2d();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    strokesRef.current = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#101010";
  }

  function strokeTo(x: number, y: number) {
    const ctx = ctx2d();
    if (!ctx) return;
    const last = lastPtRef.current;
    if (!last) return;
    const midX = (last.x + x) / 2;
    const midY = (last.y + y) / 2;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.quadraticCurveTo(last.x, last.y, midX, midY);
    ctx.stroke();
    lastPtRef.current = { x, y };
  }

  function pointerPos(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * CANVAS_W,
      y: ((event.clientY - bounds.top) / bounds.height) * CANVAS_H,
    };
  }

  function redrawTyped() {
    const canvas = canvasRef.current;
    const ctx = ctx2d();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (!typedName.trim()) return;
    let fontSize = 64;
    ctx.textBaseline = "middle";
    do {
      ctx.font = `${fontSize}px ${TYPE_FONTS[typeFontIdx]!.stack}`;
      fontSize -= 4;
    } while (ctx.measureText(typedName).width > CANVAS_W - 40 && fontSize > 18);
    ctx.fillStyle = "#101010";
    ctx.fillText(typedName, 20, CANVAS_H / 2);
  }

  async function finalize(): Promise<void> {
    setError(null);
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Canvas is unavailable in this browser.");
      return;
    }
    if (mode === "draw") {
      const hasInk = strokesRef.current.some((s) => s.length > 1);
      if (!hasInk) {
        setError("Draw your signature in the box first.");
        return;
      }
      ctx.drawImage(canvasRef.current!, 0, 0);
    } else if (mode === "type") {
      if (!typedName.trim()) {
        setError("Type your name first.");
        return;
      }
      redrawTyped();
      ctx.drawImage(canvasRef.current!, 0, 0);
    } else {
      if (!uploadFile) {
        setError("Choose a PNG or JPG image of your signature.");
        return;
      }
      try {
        const bytes = new Uint8Array(await uploadFile.arrayBuffer());
        const bitmap = await createImageBitmap(new Blob([bytes.slice().buffer as ArrayBuffer]));
        const scaleFit = Math.min(CANVAS_W / bitmap.width, CANVAS_H / bitmap.height);
        canvas.width = Math.max(1, Math.round(bitmap.width * scaleFit));
        canvas.height = Math.max(1, Math.round(bitmap.height * scaleFit));
        if (removeWhite) {
          const offscreen = document.createElement("canvas");
          offscreen.width = canvas.width;
          offscreen.height = canvas.height;
          const offCtx = offscreen.getContext("2d", { willReadFrequently: true })!;
          offCtx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          const image = offCtx.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < image.data.length; i += 4) {
            const r = image.data[i]!, g = image.data[i + 1]!, b = image.data[i + 2]!;
            if (r > 232 && g > 232 && b > 232) image.data[i + 3] = 0;
          }
          offCtx.putImageData(image, 0, 0);
          ctx.drawImage(offscreen, 0, 0);
        } else {
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        }
        bitmap.close?.();
      } catch {
        setError("That image could not be decoded.");
        return;
      }
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob || blob.size === 0) {
      setError("Could not encode the signature.");
      return;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    onConfirm({ bytes, type: "png" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Create signature">
      <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create your signature</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Signatures are processed locally and never stored or uploaded.
        </p>

        <div className="mt-4 flex gap-1" role="tablist" aria-label="Signature input mode">
          {(["draw", "type", "upload"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                mode === m
                  ? "bg-blue-600 text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === "type" ? (
          <div className="mt-4 flex flex-col gap-3">
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Your name"
              aria-label="Type your name"
              className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
            <select
              value={typeFontIdx}
              onChange={(e) => setTypeFontIdx(Number(e.target.value))}
              aria-label="Handwriting style"
              className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              {TYPE_FONTS.map((f, i) => (
                <option key={f.label} value={i}>{f.label} style</option>
              ))}
            </select>
          </div>
        ) : null}

        {mode === "upload" ? (
          <div className="mt-4 flex flex-col gap-2">
            <input
              type="file"
              accept="image/png,image/jpeg,.png,.jpg,.jpeg"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              aria-label="Signature image file"
              className="text-sm text-slate-700 dark:text-slate-200"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={removeWhite} onChange={(e) => setRemoveWhite(e.target.checked)} className="accent-blue-600" />
              Make white background transparent
            </label>
          </div>
        ) : null}

        <div className="relative mt-4">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className={`w-full rounded-xl border-2 border-dashed border-slate-300 bg-[repeating-linear-gradient(transparent,transparent_31px,#e2e8f0_32px)] dark:border-slate-600 ${
              mode === "draw" ? "" : "pointer-events-none opacity-90"
            }`}
            style={{ touchAction: "none", aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
            onPointerDown={(e) => {
              if (mode !== "draw") return;
              drawingRef.current = true;
              const pos = pointerPos(e);
              lastPtRef.current = pos;
              strokesRef.current.push([pos]);
            }}
            onPointerMove={(e) => {
              if (mode !== "draw" || !drawingRef.current) return;
              const pos = pointerPos(e);
              const current = strokesRef.current[strokesRef.current.length - 1];
              current?.push(pos);
              strokeTo(pos.x, pos.y);
            }}
            onPointerUp={() => {
              drawingRef.current = false;
              lastPtRef.current = null;
            }}
            onPointerLeave={() => {
              drawingRef.current = false;
              lastPtRef.current = null;
            }}
          />
          {mode === "draw" ? (
            <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-slate-300">
              Draw here
            </span>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {mode === "draw" ? (
            <Button variant="secondary" onClick={clearCanvas}>Clear</Button>
          ) : null}
          {mode === "type" ? (
            <Button variant="secondary" onClick={redrawTyped}>Preview</Button>
          ) : null}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => void finalize()}>Use signature</Button>
        </div>
      </div>
    </div>
  );
}
