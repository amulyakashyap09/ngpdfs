"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalyzedPdf, ReadingOrderMode } from "@paperzero/pdf-extraction";
import { Button, Checkbox, ErrorAlert, Field, FileDropzone, ProcessingProgress, SelectInput, TextInput, useFileDocuments, useOperation } from "@paperzero/pdf-ui";
import { parsePageRanges } from "@paperzero/shared";
import { analyzeLocalPdf } from "@/lib/pdf-layout-analysis";

export function PdfToAudioClient() {
  const docs = useFileDocuments("pdf");
  const operation = useOperation<AnalyzedPdf>();
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [ranges, setRanges] = useState("");
  const [order, setOrder] = useState<ReadingOrderMode>("columns");
  const [removeMargins, setRemoveMargins] = useState(true);
  const [integrateOcr, setIntegrateOcr] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceUri, setVoiceUri] = useState("");
  const [rate, setRate] = useState("1");
  const [pageChoice, setPageChoice] = useState("all");
  const [playback, setPlayback] = useState<"idle" | "playing" | "paused">("idle");
  const entry = docs.readyEntries[0];
  const supported = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

  useEffect(() => {
    if (!supported) return;
    const refresh = () => {
      const local = window.speechSynthesis.getVoices().filter((voice) => voice.localService);
      setVoices(local);
      setVoiceUri((current) => current || local[0]?.voiceURI || "");
    };
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => { window.speechSynthesis.removeEventListener("voiceschanged", refresh); window.speechSynthesis.cancel(); };
  }, [supported]);

  const readingText = useMemo(() => {
    if (!operation.result) return "";
    const pages = pageChoice === "all" ? operation.result.pages : operation.result.pages.filter((page) => page.pageNumber === Number(pageChoice));
    return pages.map((page) => `Page ${page.pageNumber}. ${page.blocks.flatMap((block) => block.kind === "table" ? page.tables.find((table) => table.id === block.tableId)?.rows.flat().join(". ") ?? "" : block.kind === "list" ? block.items.join(". ") : block.text).join("\n\n")}`).join("\n\n");
  }, [operation.result, pageChoice]);

  const extract = () => {
    if (!entry) return;
    void operation.start(async (signal, onProgress) => {
      const pages = ranges.trim() && entry.pageCount ? parsePageRanges(ranges, entry.pageCount).pages : undefined;
      const result = await analyzeLocalPdf(entry.file, { pages, readingOrder: order, removeRepeatedHeadersFooters: removeMargins, integrateOcr, signal, onProgress });
      setPageChoice("all");
      return { data: result, warnings: result.warnings };
    });
  };

  const play = () => {
    if (!supported || !readingText || !voiceUri) return;
    if (playback === "paused") { window.speechSynthesis.resume(); setPlayback("playing"); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(readingText);
    utterance.rate = Number(rate);
    utterance.voice = voices.find((voice) => voice.voiceURI === voiceUri) ?? null;
    if (!utterance.voice) return;
    utterance.onend = () => setPlayback("idle");
    utterance.onerror = () => setPlayback("idle");
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setPlayback("playing");
  };
  const pause = () => { if (supported && playback === "playing") { window.speechSynthesis.pause(); setPlayback("paused"); } };
  const stop = () => { if (supported) window.speechSynthesis.cancel(); utteranceRef.current = null; setPlayback("idle"); };

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-blue-300 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100"><strong>Listen in this browser:</strong> NGPDFs extracts reading text locally and uses the browser&apos;s installed SpeechSynthesis voices. Browsers do not expose the synthesized PCM as a reliable audio Blob, so this route intentionally offers no fake MP3/WAV download.</p>
      <FileDropzone accept="application/pdf,.pdf" label="Choose a PDF to listen to" hint="One PDF · no microphone, upload, or cloud TTS" disabled={operation.isProcessing} onFiles={(files) => { stop(); operation.reset(); docs.clearAll(); void docs.addFiles(files.slice(0, 1)); }} onError={() => undefined} />
      {entry ? <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-700"><legend className="px-1 text-sm font-semibold">Reading extraction</legend><Field label="Pages (optional)" htmlFor="audio-pages" hint={`Leave empty for all ${entry.pageCount ?? ""} pages`}><TextInput id="audio-pages" value={ranges} onChange={(event) => setRanges(event.target.value)} placeholder="Example: 1-5" /></Field><Field label="Reading order" htmlFor="audio-order"><SelectInput id="audio-order" value={order} onChange={(event) => setOrder(event.target.value as ReadingOrderMode)}><option value="columns">Detect columns</option><option value="visual">Visual top-to-bottom</option></SelectInput></Field><div className="flex flex-col gap-2 pt-6"><Checkbox label="Remove repeated headers/footers" checked={removeMargins} onChange={setRemoveMargins} /><Checkbox label="Run integrated local OCR on scanned pages" checked={integrateOcr} onChange={setIntegrateOcr} /></div></fieldset> : null}
      {entry ? <Button onClick={extract} disabled={operation.isProcessing}>Prepare local reading text</Button> : null}
      {operation.isProcessing ? <ProcessingProgress progress={operation.progress} onCancel={operation.cancel} label="Preparing reading order" /> : null}
      {operation.error ? <ErrorAlert error={operation.error} onRetry={() => operation.reset()} /> : null}
      {operation.result ? (
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-label="Browser speech controls">
          {!supported || !voices.length ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">No device-local SpeechSynthesis voice is available in this browser. Remote voices are excluded to protect document text; the extracted text remains readable below.</p> : null}
          <div className="grid gap-4 sm:grid-cols-3"><Field label="Page or chapter" htmlFor="listen-page"><SelectInput id="listen-page" value={pageChoice} onChange={(event) => { stop(); setPageChoice(event.target.value); }}><option value="all">All selected pages</option>{operation.result.pages.map((page) => <option key={page.pageNumber} value={String(page.pageNumber)}>Page {page.pageNumber}</option>)}</SelectInput></Field><Field label="Device-local voice" htmlFor="listen-voice"><SelectInput id="listen-voice" value={voiceUri} onChange={(event) => setVoiceUri(event.target.value)} disabled={!voices.length}>{voices.length ? null : <option value="">No local voice found</option>}{voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}</option>)}</SelectInput></Field><Field label="Speed" htmlFor="listen-rate"><SelectInput id="listen-rate" value={rate} onChange={(event) => setRate(event.target.value)}><option value="0.6">0.6×</option><option value="0.8">0.8×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></SelectInput></Field></div>
          <div className="flex flex-wrap gap-2"><Button onClick={play} disabled={!supported || !voiceUri || !readingText}>{playback === "paused" ? "Resume" : "Play"}</Button><Button variant="secondary" onClick={pause} disabled={playback !== "playing"}>Pause</Button><Button variant="secondary" onClick={stop} disabled={playback === "idle"}>Stop</Button></div>
          <Field label="Extracted reading text" htmlFor="reading-text"><textarea id="reading-text" readOnly value={readingText} rows={16} className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" /></Field>
        </section>
      ) : null}
    </div>
  );
}
