"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatAudioTimestamp,
  runSourceConversion,
  type CompatibilityReport as Report,
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
  TextInput,
  useOperation,
  type ResultFile,
} from "@paperzero/pdf-ui";
import { formatBytes } from "@paperzero/shared";
import { CompatibilityReport } from "@/components/conversion/CompatibilityReport";
import { getWorkerRunner } from "@/lib/worker-runner";

interface AudioResult { files: ResultFile[]; report: Report }

const EXPECTED_REPORT: Report = {
  format: "audio",
  preserved: ["editable transcript text", "optional title and date", "user-inserted timestamps", "paragraph breaks"],
  approximated: [],
  omitted: ["audio media embedding", "automatic speech recognition in this build", "speaker diarization"],
  warnings: [],
};

const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg", "oga", "webm", "flac"];

export function AudioToPdfClient() {
  const operation = useOperation<AudioResult>();
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptRef = useRef<HTMLTextAreaElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [transcript, setTranscript] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [pageSize, setPageSize] = useState<ConversionPageSize>("a4");
  const [theme, setTheme] = useState<ConversionTheme>("clean");
  const [marginPt, setMarginPt] = useState(48);
  const [fontSize, setFontSize] = useState(11);
  const [pageNumbers, setPageNumbers] = useState(true);

  useEffect(() => {
    if (!file) { setAudioUrl(""); return; }
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const choose = (selected: File) => {
    const extension = selected.name.toLowerCase().split(".").at(-1) ?? "";
    if (!AUDIO_EXTENSIONS.includes(extension) && !selected.type.startsWith("audio/")) {
      setMessage("Choose an MP3, WAV, M4A, AAC, OGG, WebM, FLAC, or another browser-decodable audio file.");
      return;
    }
    if (selected.size > 250 * 1024 * 1024) {
      setMessage("Audio input is limited to 250 MB to protect browser memory.");
      return;
    }
    setFile(selected);
    setTitle(selected.name.replace(/\.[^.]+$/, ""));
    setDuration(null);
    setMessage(`${selected.name} · ${formatBytes(selected.size)} · audio stays in this tab`);
    operation.reset();
  };

  const insertTimestamp = () => {
    const textarea = transcriptRef.current;
    const stamp = `[${formatAudioTimestamp(audioRef.current?.currentTime ?? 0)}] `;
    const start = textarea?.selectionStart ?? transcript.length;
    const end = textarea?.selectionEnd ?? start;
    const next = `${transcript.slice(0, start)}${stamp}${transcript.slice(end)}`;
    setTranscript(next);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + stamp.length, start + stamp.length);
    });
  };

  const convert = () => {
    if (!file || !transcript.trim()) return;
    void operation.start(async (signal, onProgress) => {
      const outcome = await runSourceConversion(getWorkerRunner(), {
        format: "audio",
        source: transcript,
        sourceName: file.name,
        options: { pageSize, orientation: "portrait", marginPt, theme, fontSize, pageNumbers, title: title.trim() || file.name.replace(/\.[^.]+$/, ""), audio: { date } },
      }, { signal, onProgress });
      return { data: { files: outcome.files, report: outcome.report }, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <strong>Conservative local fallback:</strong> this build does not bundle a roughly 100 MB on-device speech model. It never sends audio to a browser or cloud speech API. Listen locally, paste or type a reviewed transcript, and optionally insert timestamps from the player.
      </p>
      <FileDropzone
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.webm,.flac"
        label="Choose an audio recording"
        hint="MP3/WAV/M4A or browser-decodable audio · one file · maximum 250 MB"
        disabled={operation.isProcessing}
        onFiles={(files) => choose(files[0]!)}
        onError={setMessage}
      />
      {message ? <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">{message}</p> : null}
      {audioUrl ? (
        <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-label="Local audio player">
          <audio
            ref={audioRef}
            className="w-full"
            controls
            preload="metadata"
            src={audioUrl}
            onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : null)}
            onError={() => setMessage("This browser could not decode the selected audio. You can try WAV/MP3 or use another browser.")}
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{duration === null ? "Reading local audio metadata…" : `Duration ${formatAudioTimestamp(duration)} · media is not embedded in the output PDF`}</p>
        </section>
      ) : null}
      <section className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-700" aria-label="Transcript details">
        <Field label="Transcript title" htmlFor="audio-title"><TextInput id="audio-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Interview or recording title" /></Field>
        <Field label="Document date (optional)" htmlFor="audio-date"><TextInput id="audio-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
        <Field label="Reviewed transcript" htmlFor="audio-transcript" hint="Separate paragraphs with a blank line. Timestamps use [MM:SS] or [HH:MM:SS].">
          <textarea
            ref={transcriptRef}
            id="audio-transcript"
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            rows={14}
            maxLength={2 * 1024 * 1024}
            placeholder="Play the local recording and paste or type its reviewed transcript here."
            className="min-h-72 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-2 focus:outline-blue-500/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </Field>
        <div className="flex items-end"><Button type="button" variant="secondary" onClick={insertTimestamp} disabled={!file}>Insert current player timestamp</Button></div>
      </section>
      <CompatibilityReport report={operation.result?.report ?? EXPECTED_REPORT} />
      <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold">Transcript PDF layout</legend>
        <Field label="Page size" htmlFor="audio-size"><SelectInput id="audio-size" value={pageSize} onChange={(event) => setPageSize(event.target.value as ConversionPageSize)}><option value="a4">A4</option><option value="letter">Letter</option></SelectInput></Field>
        <Field label="Theme" htmlFor="audio-theme"><SelectInput id="audio-theme" value={theme} onChange={(event) => setTheme(event.target.value as ConversionTheme)}><option value="clean">Clean document</option><option value="academic">Academic</option><option value="technical">Technical</option><option value="minimal">Minimal</option></SelectInput></Field>
        <Field label="Margin (pt)" htmlFor="audio-margin"><NumberInput id="audio-margin" min={18} max={120} value={marginPt} onChange={(event) => setMarginPt(Number(event.target.value))} /></Field>
        <Field label="Body size (pt)" htmlFor="audio-font"><NumberInput id="audio-font" min={7} max={24} value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></Field>
        <Checkbox label="Add page numbers" checked={pageNumbers} onChange={setPageNumbers} />
      </fieldset>
      <Button onClick={convert} disabled={!file || !transcript.trim() || operation.isProcessing}>Create transcript PDF</Button>
      {operation.isProcessing ? <ProcessingProgress progress={operation.progress} onCancel={operation.cancel} label="Building transcript PDF" /> : null}
      {operation.error ? <ErrorAlert error={operation.error} onRetry={() => operation.reset()} /> : null}
      {operation.status === "success" && operation.result ? <DownloadResult toolId="audio-to-pdf" files={operation.result.files} warnings={operation.warnings} onStartOver={() => { operation.reset(); setFile(null); setTranscript(""); }} /> : null}
    </div>
  );
}
