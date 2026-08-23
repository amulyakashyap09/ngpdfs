import { formatBytes, suggestOutputName } from "@paperzero/shared";

export interface DownloadOptions {
  filename: string;
  blob: Blob;
}

export function triggerDownload({ filename, blob }: DownloadOptions): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || !("canShare" in navigator)) return false;
  try {
    return navigator.canShare({ files: [new File([new Uint8Array([0])], "x.pdf")] });
  } catch {
    return false;
  }
}

export async function shareFile(blob: Blob, filename: string): Promise<boolean> {
  if (!canShareFiles()) return false;
  const file = new File([blob], filename, { type: blob.type });
  try {
    await navigator.share({ files: [file], title: filename });
    return true;
  } catch {
    return false;
  }
}

export interface NamedOutput {
  name: string;
  blob: Blob;
}

export function buildMergedFilename(baseNames: string[], suffix: string, extension: string): string {
  return suggestOutputName({ baseNames, suffix, extension });
}

export function describeSize(bytes: number): string {
  return formatBytes(bytes);
}
