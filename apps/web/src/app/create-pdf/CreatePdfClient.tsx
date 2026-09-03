"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  parseHtml,
  runSourceConversion,
  safeHref,
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
  NumberInput,
  ProcessingProgress,
  SelectInput,
  TextInput,
  useOperation,
  type ResultFile,
} from "@paperzero/pdf-ui";
import { getWorkerRunner } from "@/lib/worker-runner";
import { CompatibilityReport } from "@/components/conversion/CompatibilityReport";
import { DocumentPreview } from "@/components/conversion/DocumentPreview";

const DRAFT_KEY = "paperzero.phase6.create-pdf-draft";
const INITIAL_HTML = "<h1>Untitled document</h1><p>Compose a local document with the toolbar. Your draft stays in this browser.</p>";

interface CreateResult {
  files: ResultFile[];
  report: Report;
}

export function CreatePdfClient() {
  const editorRef = useRef<HTMLDivElement>(null);
  const operation = useOperation<CreateResult>();
  const [source, setSource] = useState(INITIAL_HTML);
  const [title, setTitle] = useState("Untitled document");
  const [pageSize, setPageSize] = useState<ConversionPageSize>("a4");
  const [orientation, setOrientation] = useState<ConversionOrientation>("portrait");
  const [theme, setTheme] = useState<ConversionTheme>("clean");
  const [marginPt, setMarginPt] = useState(42);
  const [fontSize, setFontSize] = useState(11);
  const [pageNumbers, setPageNumbers] = useState(true);
  const [link, setLink] = useState("https://");
  const [tableRows, setTableRows] = useState(3);
  const [tableColumns, setTableColumns] = useState(3);
  const [draftMessage, setDraftMessage] = useState("Draft is stored only in this browser.");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { html?: unknown; title?: unknown };
      const html = typeof parsed.html === "string" ? sanitizeEditorHtml(parsed.html) : INITIAL_HTML;
      const savedTitle = typeof parsed.title === "string" ? parsed.title.slice(0, 180) : "Untitled document";
      setSource(html);
      setTitle(savedTitle);
      if (editorRef.current) editorRef.current.innerHTML = html;
      setDraftMessage("Restored the local draft from this browser.");
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ html: source, title }));
    } catch {
      setDraftMessage("Browser storage is unavailable; the editor still works until this tab closes.");
    }
  }, [source, title]);

  const preview = useMemo(() => parseHtml(source, title, "rich-text"), [source, title]);

  const syncEditor = () => {
    if (editorRef.current) setSource(sanitizeEditorHtml(editorRef.current.innerHTML));
  };

  const command = (name: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, value);
    syncEditor();
  };

  const insertTable = () => {
    const rows = Math.max(1, Math.min(20, tableRows));
    const columns = Math.max(1, Math.min(10, tableColumns));
    const html = `<table><tbody>${Array.from({ length: rows }, (_, row) => `<tr>${Array.from({ length: columns }, (_, column) => row === 0 ? `<th>Header ${column + 1}</th>` : `<td>Cell ${row + 1}.${column + 1}</td>`).join("")}</tr>`).join("")}</tbody></table><p><br></p>`;
    command("insertHTML", html);
  };

  const insertImage = async (file: File) => {
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setDraftMessage("Create PDF currently embeds PNG and JPEG images only.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setDraftMessage("Embedded images are limited to 8 MB each.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    command("insertImage", dataUrl);
    setDraftMessage(`${file.name} embedded locally in the draft.`);
  };

  const convert = () => {
    const safeSource = sanitizeEditorHtml(editorRef.current?.innerHTML ?? source);
    void operation.start(async (signal, onProgress) => {
      const outcome = await runSourceConversion(getWorkerRunner(), {
        format: "rich-text",
        source: safeSource,
        sourceName: title.trim() || "document",
        options: { pageSize, orientation, marginPt, theme, fontSize, pageNumbers, title: title.trim() || undefined },
      }, { signal, onProgress });
      return { data: { files: outcome.files, report: outcome.report }, warnings: outcome.warnings };
    });
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setSource(INITIAL_HTML);
    setTitle("Untitled document");
    if (editorRef.current) editorRef.current.innerHTML = INITIAL_HTML;
    setDraftMessage("Local draft cleared.");
    operation.reset();
  };

  return (
    <div className="flex flex-col gap-6">
      <Field label="Document title" htmlFor="create-title"><TextInput id="create-title" value={title} onChange={(event) => setTitle(event.target.value)} /></Field>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700" aria-label="Rich text composer">
        <div className="flex flex-wrap gap-1 border-b border-slate-200 p-2 dark:border-slate-700" role="toolbar" aria-label="Document formatting">
          <Button variant="secondary" onClick={() => command("bold")} aria-label="Bold"><strong>B</strong></Button>
          <Button variant="secondary" onClick={() => command("italic")} aria-label="Italic"><em>I</em></Button>
          <Button variant="secondary" onClick={() => command("underline")} aria-label="Underline"><u>U</u></Button>
          <Button variant="secondary" onClick={() => command("insertUnorderedList")}>Bullets</Button>
          <Button variant="secondary" onClick={() => command("insertOrderedList")}>Numbers</Button>
          <Button variant="secondary" onClick={() => command("justifyLeft")}>Left</Button>
          <Button variant="secondary" onClick={() => command("justifyCenter")}>Center</Button>
          <Button variant="secondary" onClick={() => command("justifyRight")}>Right</Button>
          <SelectInput aria-label="Paragraph style" className="w-auto" defaultValue="p" onChange={(event) => command("formatBlock", event.target.value)}><option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option><option value="pre">Code block</option></SelectInput>
          <Button variant="secondary" onClick={() => command("insertHorizontalRule")}>Rule</Button>
          <Button variant="secondary" onClick={() => command("insertHTML", '<div style="page-break-before:always"><br></div>')}>Page break</Button>
          <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600">Image<input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void insertImage(file); event.target.value = ""; }} /></label>
        </div>
        <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={syncEditor} className="min-h-[320px] p-5 text-sm leading-6 outline-none" dangerouslySetInnerHTML={{ __html: INITIAL_HTML }} />
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex gap-2"><TextInput aria-label="Link URL" value={link} onChange={(event) => setLink(event.target.value)} /><Button variant="secondary" onClick={() => { const href = safeHref(link); if (href) command("createLink", href); else setDraftMessage("Links must use HTTP, HTTPS, or mailto."); }}>Link selection</Button></div>
        <div className="flex items-end gap-2"><Field label="Table rows" htmlFor="create-rows"><NumberInput id="create-rows" min={1} max={20} value={tableRows} onChange={(event) => setTableRows(Number(event.target.value))} /></Field><Field label="Columns" htmlFor="create-columns"><NumberInput id="create-columns" min={1} max={10} value={tableColumns} onChange={(event) => setTableColumns(Number(event.target.value))} /></Field><Button variant="secondary" onClick={insertTable}>Insert table</Button></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300"><span>{draftMessage}</span><Button variant="ghost" onClick={clearDraft}>Clear local draft</Button></div>

      <div className="grid gap-6 lg:grid-cols-2"><DocumentPreview document={preview.document} /><CompatibilityReport report={preview.report} /></div>

      <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold">PDF layout</legend>
        <Field label="Page size" htmlFor="create-size"><SelectInput id="create-size" value={pageSize} onChange={(event) => setPageSize(event.target.value as ConversionPageSize)}><option value="a4">A4</option><option value="letter">Letter</option></SelectInput></Field>
        <Field label="Orientation" htmlFor="create-orientation"><SelectInput id="create-orientation" value={orientation} onChange={(event) => setOrientation(event.target.value as ConversionOrientation)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></SelectInput></Field>
        <Field label="Theme" htmlFor="create-theme"><SelectInput id="create-theme" value={theme} onChange={(event) => setTheme(event.target.value as ConversionTheme)}><option value="clean">Clean document</option><option value="academic">Academic</option><option value="technical">Technical</option><option value="minimal">Minimal</option></SelectInput></Field>
        <Field label="Margin (pt)" htmlFor="create-margin"><NumberInput id="create-margin" min={18} max={120} value={marginPt} onChange={(event) => setMarginPt(Number(event.target.value))} /></Field>
        <Field label="Body size (pt)" htmlFor="create-font"><NumberInput id="create-font" min={7} max={24} value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></Field>
        <Checkbox label="Add page numbers" checked={pageNumbers} onChange={setPageNumbers} />
      </fieldset>

      <Button onClick={convert} disabled={operation.isProcessing || !source.trim()}>Create PDF</Button>
      {operation.isProcessing ? <ProcessingProgress progress={operation.progress} onCancel={operation.cancel} label="Creating PDF" /> : null}
      {operation.error ? <ErrorAlert error={operation.error} onRetry={() => operation.reset()} /> : null}
      {operation.status === "success" && operation.result ? <DownloadResult toolId="create-pdf" files={operation.result.files} warnings={operation.warnings} onStartOver={() => operation.reset()} /> : null}
    </div>
  );
}

function sanitizeEditorHtml(source: string): string {
  const parsed = new DOMParser().parseFromString(source, "text/html");
  const blocked = new Set(["SCRIPT", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON", "VIDEO", "AUDIO", "CANVAS", "SVG", "STYLE", "LINK", "META"]);
  const allowed = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "STRONG", "B", "EM", "I", "U", "OL", "UL", "LI", "A", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "HR", "BR", "BLOCKQUOTE", "PRE", "CODE", "IMG", "SPAN"]);
  for (const element of [...parsed.body.querySelectorAll("*")]) {
    if (blocked.has(element.tagName)) {
      element.remove();
      continue;
    }
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      continue;
    }
    const href = element.tagName === "A" ? safeHref(element.getAttribute("href") ?? undefined) : undefined;
    const src = element.tagName === "IMG" && /^data:image\/(?:png|jpeg);base64,/i.test(element.getAttribute("src") ?? "") ? element.getAttribute("src") : null;
    const alt = element.tagName === "IMG" ? (element.getAttribute("alt") ?? "").slice(0, 200) : null;
    const style = element.getAttribute("style") ?? "";
    const safeStyles = style.split(";").map((value) => value.trim()).filter((value) => /^(text-align\s*:\s*(?:left|center|right)|(?:page-break-(?:before|after)|break-(?:before|after))\s*:\s*(?:always|page))$/i.test(value));
    for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
    if (href) element.setAttribute("href", href);
    if (src) element.setAttribute("src", src);
    if (alt) element.setAttribute("alt", alt);
    if (safeStyles.length) element.setAttribute("style", safeStyles.join(";"));
  }
  return parsed.body.innerHTML;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Image encoding failed."));
    reader.onerror = () => reject(reader.error ?? new Error("Image reading failed."));
    reader.readAsDataURL(file);
  });
}
