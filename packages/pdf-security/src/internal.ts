import type { ProgressUpdate } from "@paperzero/shared";

export interface OpProgressContext {
  progress?: (progress: ProgressUpdate) => void;
  throwIfCancelled?: () => void;
}

export interface NamedBytes {
  name: string;
  bytes: Uint8Array;
}

export interface OpOutcomePayload {
  files: NamedBytes[];
  warnings: string[];
}

export function toExactBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes;
  }
  return bytes.slice();
}
