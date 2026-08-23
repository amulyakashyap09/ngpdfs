import { openDB, type IDBPDatabase } from "idb";
import { PaperZeroError, toPaperZeroError } from "@paperzero/shared";

export const DB_NAME = "paperzero";
export const DB_VERSION = 1;

export interface HistoryRecord {
  id: string;
  toolId: string;
  fileName: string;
  size: number;
  outputType: string;
  timestamp: number;
}

export interface PreviewCacheRecord {
  key: string;
  blob: Blob;
  createdAt: number;
}

export interface WorkflowDraftRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

export interface AppSettingRecord {
  key: string;
  value: unknown;
}

interface Stores {
  history: HistoryRecord;
  previews: PreviewCacheRecord;
  drafts: WorkflowDraftRecord;
  settings: AppSettingRecord;
}

let dbPromise: Promise<IDBPDatabase<Stores>> | null = null;

function storageAvailable(): boolean {
  try {
    if (typeof indexedDB === "undefined") return false;
    const probe = "__pz_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

async function getDb(): Promise<IDBPDatabase<Stores>> {
  if (!storageAvailable()) {
    throw new PaperZeroError("STORAGE_UNAVAILABLE");
  }
  if (!dbPromise) {
    dbPromise = openDB<Stores>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("history")) {
          const store = db.createObjectStore("history", { keyPath: "id" });
          store.createIndex("by-timestamp", "timestamp");
        }
        if (!db.objectStoreNames.contains("previews")) {
          db.createObjectStore("previews", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("drafts")) {
          db.createObjectStore("drafts", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

function mapStorageError(error: unknown): never {
  const mapped = toPaperZeroError(error);
  if (mapped.code === "QUOTA_EXCEEDED" || mapped.code === "UNKNOWN") {
    if (error instanceof DOMException && /quota/i.test(error.name)) {
      throw new PaperZeroError("QUOTA_EXCEEDED");
    }
  }
  if (mapped.code === "STORAGE_UNAVAILABLE") throw mapped;
  if (typeof error === "object" && error !== null && "name" in error) {
    const name = String((error as { name?: unknown }).name);
    if (/Quota/i.test(name)) throw new PaperZeroError("QUOTA_EXCEEDED");
    if (/InvalidState|Security|Unknown/i.test(name)) throw new PaperZeroError("STORAGE_UNAVAILABLE");
  }
  throw new PaperZeroError("STORAGE_UNAVAILABLE", undefined, error instanceof Error ? error.message : undefined);
}

export async function putHistory(record: HistoryRecord): Promise<void> {
  try {
    const db = await getDb();
    await db.put("history", record);
  } catch (error) {
    mapStorageError(error);
  }
}

export async function listHistory(): Promise<HistoryRecord[]> {
  try {
    const db = await getDb();
    const all = (await db.getAll("history")) as HistoryRecord[];
    return all.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    mapStorageError(error);
  }
}

export async function deleteHistoryItem(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete("history", id);
  } catch (error) {
    mapStorageError(error);
  }
}

export async function clearAllHistory(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear("history");
  } catch (error) {
    mapStorageError(error);
  }
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  try {
    const db = await getDb();
    const record = (await db.get("settings", key)) as AppSettingRecord | undefined;
    return record?.value as T | undefined;
  } catch {
    return undefined;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  try {
    const db = await getDb();
    await db.put("settings", { key, value });
  } catch {
    void 0;
  }
}
