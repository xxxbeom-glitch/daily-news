/**
 * 커스텀 RSS 소스 저장/로드 (localStorage)
 */

import type { NewsSource } from "../data/newsSources";

const CUSTOM_RSS_KEY = "newsbrief_custom_rss_sources";
const MAX_CUSTOM = 50;

export function getCustomSources(): NewsSource[] {
  try {
    const raw = localStorage.getItem(CUSTOM_RSS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s: unknown) => s && typeof s === "object" && "id" in s && "name" in s && "rssUrl" in s)
      : [];
  } catch {
    return [];
  }
}

export function addCustomSource(name: string, rssUrl: string): NewsSource {
  const list = getCustomSources();
  const id = `custom_${Date.now()}`;
  const source: NewsSource = { id, name: name.trim() || "커스텀 RSS", rssUrl: rssUrl.trim() };
  const next = [...list, source].slice(-MAX_CUSTOM);
  localStorage.setItem(CUSTOM_RSS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("newsbrief_settings_changed"));
  return source;
}

export function removeCustomSource(id: string): void {
  const list = getCustomSources().filter((s) => s.id !== id);
  localStorage.setItem(CUSTOM_RSS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("newsbrief_settings_changed"));
}

export function isCustomSourceId(id: string): boolean {
  return id.startsWith("custom_");
}
