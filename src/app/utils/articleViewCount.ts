/**
 * 기사 조회수 추적 (localStorage)
 * 가장 많이본 기사 정렬용
 */

const VIEW_COUNT_KEY = "newsbrief_article_views";

function loadViewCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(VIEW_COUNT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function getArticleViewCount(link: string): number {
  const counts = loadViewCounts();
  return counts[link] ?? 0;
}

export function getArticleViewCounts(): Record<string, number> {
  return loadViewCounts();
}

export function recordArticleView(link: string): void {
  try {
    const counts = loadViewCounts();
    counts[link] = (counts[link] ?? 0) + 1;
    localStorage.setItem(VIEW_COUNT_KEY, JSON.stringify(counts));
  } catch {
    /* ignore */
  }
}

/** @deprecated use recordArticleView */
export function incrementArticleView(link: string): void {
  recordArticleView(link);
}
