/**
 * 스크랩 기사 저장/로드 (localStorage)
 */

import type { RawRssArticle } from "./fetchRssFeeds";

const SCRAP_KEY = "newsbrief_scrap_articles";
const MAX_SCRAPS = 200;

export function getScrapArticles(): RawRssArticle[] {
  try {
    const raw = localStorage.getItem(SCRAP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addScrap(article: RawRssArticle): void {
  const list = getScrapArticles();
  if (list.some((a) => a.link === article.link)) return;
  const next = [article, ...list].slice(0, MAX_SCRAPS);
  localStorage.setItem(SCRAP_KEY, JSON.stringify(next));
}

export function removeScrap(link: string): void {
  const list = getScrapArticles().filter((a) => a.link !== link);
  localStorage.setItem(SCRAP_KEY, JSON.stringify(list));
}

export function isScrapped(link: string): boolean {
  return getScrapArticles().some((a) => a.link === link);
}
