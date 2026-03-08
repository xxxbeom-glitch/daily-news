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
    const items = Array.isArray(parsed) ? parsed : [];
    return [...items].sort((a, b) => {
      const tsA = a.publishedAt ? new Date(a.publishedAt).getTime() : new Date(a.createdAt).getTime();
      const tsB = b.publishedAt ? new Date(b.publishedAt).getTime() : new Date(b.createdAt).getTime();
      return tsB - tsA;
    });
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

export function removeInsightArchive(id: string): void {
  const items = loadInsightArchives().filter((i) => i.id !== id);
  saveInsightArchives(items);
}
