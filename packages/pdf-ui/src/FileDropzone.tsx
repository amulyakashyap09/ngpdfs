"use client";

import { useCallback, useId, useRef, useState, type DragEvent } from "react";
import { PaperZeroError } from "@paperzero/shared";

export interface DropzoneProps {
  accept?: string;
  multiple?: boolean;
  label?: string;
  hint?: string;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  onError: (message: string) => void;
}

export function FileDropzone({
  accept = "application/pdf,.pdf",
  multiple = false,
  label = "Choose files or drop them here",
  hint,
  disabled,
  onFiles,
  onError,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputId = useId();

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      if (!multiple && files.length > 1) {
        onError("This tool processes one file at a time. Select a single file.");
        return;
      }
      onFiles(files);
    },
    [multiple, onError, onFiles]
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (disabled) return;
    handleFiles(event.dataTransfer.files);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-labelledby={inputId}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
      className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
        dragActive
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
          : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-blue-500"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V6m0 0l-4 4m4-4l4 4M4 20h16" />
      </svg>
      <p id={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </p>
      {hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}

export function dropzoneErrorHandler(message: string): (error: unknown) => void {
  return (error: unknown) => {
    if (error instanceof PaperZeroError) throw error;
    throw new PaperZeroError("UNSUPPORTED_FILE", message);
  };
}
