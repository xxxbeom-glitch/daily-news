import { fetchViaCorsProxy } from "./corsProxy";

const FINNHUB_NEWS = "https://finnhub.io/api/v1/news";
const FINNHUB_TIMEOUT_MS = 15000;

function getFinnhubKey(): string {
  let key = (import.meta.env.VITE_FINNHUB_API_KEY as string) ?? "";
  key = key.trim().replace(/^["']|["']$/g, "");
  return key;
}

interface FinnhubNewsItem {
  headline?: string;
  summary?: string;
  url?: string;
  source?: string;
  datetime?: number;
}

async function fetchFinnhubNews(sourceId: string, sourceName: string): Promise<RawRssArticle[]> {
  const key = getFinnhubKey();
  if (!key) return [];

  const url = `${FINNHUB_NEWS}?category=general&token=${key}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FINNHUB_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const data = (await res.json()) as FinnhubNewsItem[];
    if (!Array.isArray(data) || data.length === 0) return [];

    return data
      .filter((item) => item?.headline && item?.url)
      .map((item) => {
        const pubDate = item.datetime
          ? new Date(item.datetime * 1000).toISOString()
          : new Date().toISOString();
        return {
          title: item.headline ?? "",
          link: item.url ?? "",
          pubDate,
          sourceId,
          sourceName,
          body: item.summary ?? undefined,
        };
      });
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

/** 기사 검색 기간 - 설정값 → 밀리초 */
export const RECENT_RANGE_MS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "3h": 3 * 60 * 60 * 1000,
  "1h": 60 * 60 * 1000,
};

const RECENT_RANGE_KEY = "newsbrief_recent_range";
const RSS_TIMEOUT_MS = 15000;

export interface RawRssArticle {
  title: string;
  link: string;
  pubDate: string; // ISO8601 or RFC2822
  sourceId: string;
  sourceName: string;
  /** 본문 요약(RSS description) - 필터/유사도 판단용 */
  body?: string;
}

function parsePubDate(str: string | undefined): Date | null {
  if (!str || typeof str !== "string") return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function parseRssXml(xmlText: string, sourceId: string, sourceName: string): RawRssArticle[] {
  const articles: RawRssArticle[] = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) return [];

    // RSS 2.0: channel > item
    const rssItems = doc.querySelectorAll("channel item");
    if (rssItems.length > 0) {
      rssItems.forEach((item) => {
        const title = item.querySelector("title")?.textContent?.trim() ?? "";
        const link = item.querySelector("link")?.textContent?.trim() ?? "";
        const pubDate = item.querySelector("pubDate")?.textContent?.trim() ?? "";
        const body =
          item.querySelector("description")?.textContent?.trim() ??
          item.querySelector("content\\:encoded")?.textContent?.trim() ??
          "";
        if (title && link) {
          articles.push({ title, link, pubDate, sourceId, sourceName, body: body || undefined });
        }
      });
      return articles;
    }

    // Atom: feed > entry
    const atomEntries = doc.querySelectorAll("entry");
    atomEntries.forEach((entry) => {
      const title = entry.querySelector("title")?.textContent?.trim() ?? "";
      const linkEl = entry.querySelector('link[rel="alternate"]') ?? entry.querySelector("link");
      const link = linkEl?.getAttribute("href") ?? linkEl?.textContent?.trim() ?? "";
      const published = entry.querySelector("published")?.textContent ?? entry.querySelector("updated")?.textContent ?? "";
      const body =
        entry.querySelector("summary")?.textContent?.trim() ??
        entry.querySelector("content")?.textContent?.trim() ??
        "";
      if (title && link) {
        articles.push({ title, link, pubDate: published, sourceId, sourceName, body: body || undefined });
      }
    });
  } catch {
    // ignore parse errors
  }
  return articles;
}

/** 설정에서 저장된 기사 검색 기간 값 읽기 */
export function getRecentRangeFromSettings(): string {
  try {
    return localStorage.getItem(RECENT_RANGE_KEY) || "24h";
  } catch {
    return "24h";
  }
}

/** 기간 범위 내 기사만 필터링 */
export function filterArticlesByRange<T extends { pubDate: string }>(
  articles: T[],
  rangeKey: string
): T[] {
  const ms = RECENT_RANGE_MS[rangeKey] ?? RECENT_RANGE_MS["24h"];
  const cutoff = Date.now() - ms;
  return articles.filter((a) => {
    const d = parsePubDate(a.pubDate);
    return d && d.getTime() >= cutoff;
  });
}

export interface FetchRssOptions {
  sources: { id: string; name: string; rssUrl: string }[];
  onProgress?: (fetched: number, total: number) => void;
}

export interface FetchRssResult {
  articles: RawRssArticle[];
  error?: string; // 모든 피드 실패 시 오류 메시지
}

/**
 * 여러 RSS 피드에서 기사 수집
 * @returns 수집된 기사 및 오류 정보 (모든 피드 실패 시 error 설정)
 */
export async function fetchRssFeeds(options: FetchRssOptions): Promise<FetchRssResult> {
  const { sources, onProgress } = options;
  if (sources.length === 0) return { articles: [] };

  const allArticles: RawRssArticle[] = [];
  const failedSources: string[] = [];
  const total = sources.length;

  for (let i = 0; i < sources.length; i++) {
    onProgress?.(i + 1, total);
    const s = sources[i];

    if (s.id === "finnhub") {
      const items = await fetchFinnhubNews(s.id, s.name);
      if (items.length === 0) failedSources.push(s.name);
      else allArticles.push(...items);
      continue;
    }

    const { ok, text } = await fetchViaCorsProxy(s.rssUrl, { timeoutMs: RSS_TIMEOUT_MS });
    if (!ok) {
      failedSources.push(s.name);
      continue;
    }
    const items = parseRssXml(text, s.id, s.name);
    allArticles.push(...items);
  }

  if (allArticles.length === 0 && failedSources.length > 0) {
    return {
      articles: [],
      error: `RSS 피드 수집 실패: ${failedSources.join(", ")}에서 기사를 가져올 수 없습니다. 네트워크를 확인하거나 나중에 다시 시도해주세요.`,
    };
  }

  return { articles: allArticles };
}
