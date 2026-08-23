import {
  clearAllHistory,
  deleteHistoryItem,
  listHistory,
  putHistory,
  type HistoryRecord,
} from "./db";

const MAX_HISTORY_ITEMS = 50;
const ENABLED_KEY = "pz.history.enabled";

export const HISTORY_LIMIT = MAX_HISTORY_ITEMS;

export function isHistoryEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setHistoryEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? "true" : "false");
  } catch {
    void 0;
  }
}

export async function recordHistory(entry: Omit<HistoryRecord, "id" | "timestamp">): Promise<void> {
  if (!isHistoryEnabled()) return;
  try {
    const record: HistoryRecord = {
      ...entry,
      id: `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    await putHistory(record);
    const all = await listHistory();
    for (const stale of all.slice(MAX_HISTORY_ITEMS)) {
      await deleteHistoryItem(stale.id);
    }
  } catch {
    void 0;
  }
}

export async function getRecentHistory(): Promise<HistoryRecord[]> {
  try {
    return await listHistory();
  } catch {
    return [];
  }
}

export async function removeHistoryItem(id: string): Promise<void> {
  try {
    await deleteHistoryItem(id);
  } catch {
    void 0;
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await clearAllHistory();
  } catch {
    void 0;
  }
}
