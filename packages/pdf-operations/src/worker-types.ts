export interface WorkerDoneResult {
  files: Array<{ name: string; bytes: Uint8Array }>;
  warnings: string[];
}
