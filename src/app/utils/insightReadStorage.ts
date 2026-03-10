/**
 * 인사이트 아티클 읽음 상태 (localStorage)
 */

const INSIGHT_READ_IDS_KEY = "newsbrief_insight_read_ids";

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(INSIGHT_READ_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function isInsightRead(id: string): boolean {
  return loadReadIds().has(id);
}

export function markInsightAsRead(id: string): void {
  try {
    const ids = loadReadIds();
    ids.add(id);
    localStorage.setItem(INSIGHT_READ_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}
