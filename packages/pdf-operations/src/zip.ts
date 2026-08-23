import JSZip from "jszip";
import { PaperZeroError } from "@paperzero/shared";

export interface ZipEntry {
  name: string;
  blob: Blob;
}

export async function zipBlobs(entries: ZipEntry[]): Promise<Blob> {
  if (entries.length === 0) {
    throw new PaperZeroError("INVALID_INPUT", "Nothing to package.");
  }
  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.name, await entry.blob.arrayBuffer());
  }
  return await zip.generateAsync({ type: "blob", compression: "STORE" });
}

export async function zipBytes(entries: Array<{ name: string; bytes: Uint8Array }>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.name, entry.bytes);
  }
  const out = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return out;
}

export async function countZipEntries(bytes: Uint8Array): Promise<number> {
  const zip = await JSZip.loadAsync(bytes);
  return Object.keys(zip.files).length;
}
