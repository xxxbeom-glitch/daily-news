/**
 * 인사이트 칩 아카이브 localStorage
 */

import type { InsightArchiveItem } from "../data/insightReport";

export const INSIGHT_ARCHIVES_KEY = "newsbrief_insight_archives";

export function loadInsightArchives(): InsightArchiveItem[] {
  try {
    const raw = localStorage.getItem(INSIGHT_ARCHIVES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InsightArchiveItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveInsightArchives(items: InsightArchiveItem[]): void {
  try {
    localStorage.setItem(INSIGHT_ARCHIVES_KEY, JSON.stringify(items));
  } catch {
    console.warn("[InsightArchive] localStorage 저장 실패");
  }
}

export function addInsightArchive(item: InsightArchiveItem): void {
  const items = loadInsightArchives();
  items.unshift(item);
  saveInsightArchives(items);
}
