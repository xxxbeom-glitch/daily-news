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
  "7d": 7 * 24 * 60 * 60 * 1000,
  "48h": 48 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "3h": 3 * 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "1h": 60 * 60 * 1000,
};

/** 계층형 검색: 3h → 6h → 12h → 24h 순으로 넓혀가며 최소 기사수 도달 시까지 시도 */
export const TIERED_RANGE_KEYS = ["3h", "6h", "12h", "24h"] as const;

/** 계층형 검색 시 최소 유효 기사 수 (이 수 이상이면 해당 범위 사용) */
export const MIN_ARTICLES_FOR_TIERED = 10;

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

/** rss2json API - IP 차단 우회 (한국경제 등) */
interface Rss2JsonItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  content?: string;
}

async function fetchViaRss2Json(
  rssUrl: string,
  sourceId: string,
  sourceName: string
): Promise<RawRssArticle[] | null> {
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RSS_TIMEOUT_MS);
  try {
    const { ok, text } = await fetchViaCorsProxy(apiUrl, { timeoutMs: RSS_TIMEOUT_MS });
    clearTimeout(timeout);
    if (!ok || !text) return null;
    const json = JSON.parse(text) as { status?: string; items?: Rss2JsonItem[] };
    if (json?.status !== "ok" || !Array.isArray(json.items)) return null;
    return json.items
      .filter((item) => item?.title && item?.link)
      .map((item) => ({
        title: item.title ?? "",
        link: item.link ?? "",
        pubDate: item.pubDate ?? new Date().toISOString(),
        sourceId,
        sourceName,
        body: (item.description ?? item.content ?? "").trim() || undefined,
      }));
  } catch {
    clearTimeout(timeout);
    return null;
  }
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

/** 기사 검색 기간 기본값 (24시간 - 수집량 확보 우선) */
export function getRecentRangeFromSettings(): string {
  return "24h";
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

/**
 * 3h → 6h → 12h → 24h 순으로 범위를 넓혀가며, process 결과가 비어있지 않을 때까지 시도
 * @param process 범위 필터 적용된 기사에 대한 추가 처리 (키워드 매칭, 품질 필터 등)
 */
export function filterArticlesByRangeTiered<T extends { pubDate: string }>(
  articles: T[],
  process: (rangeFiltered: T[]) => T[]
): { articles: T[]; rangeKey: string } {
  for (const key of TIERED_RANGE_KEYS) {
    const byRange = filterArticlesByRange(articles, key);
    const result = process(byRange);
    if (result.length > 0) return { articles: result, rangeKey: key };
  }
  const lastKey = TIERED_RANGE_KEYS[TIERED_RANGE_KEYS.length - 1];
  const byRange = filterArticlesByRange(articles, lastKey);
  return { articles: process(byRange), rangeKey: lastKey };
}

/**
 * 계층형 검색: 최소 기사 수(MIN_ARTICLES_FOR_TIERED)에 도달할 때까지 범위를 넓힘
 * @param articles 원본 기사 목록
 * @param process 범위 필터 적용된 기사에 대한 추가 처리 (품질 필터 등)
 * @param minArticles 최소 목표 기사 수 (기본: MIN_ARTICLES_FOR_TIERED)
 */
export function filterArticlesByRangeTieredWithMin<T extends { pubDate: string }>(
  articles: T[],
  process: (rangeFiltered: T[]) => T[],
  minArticles = MIN_ARTICLES_FOR_TIERED
): { articles: T[]; rangeKey: string } {
  for (const key of TIERED_RANGE_KEYS) {
    const byRange = filterArticlesByRange(articles, key);
    const result = process(byRange);
    if (result.length >= minArticles) return { articles: result, rangeKey: key };
  }
  // 모든 범위 시도 후에도 최소 미달 시, 가장 넓은 범위(24h) 결과 반환
  const lastKey = TIERED_RANGE_KEYS[TIERED_RANGE_KEYS.length - 1];
  const byRange = filterArticlesByRange(articles, lastKey);
  return { articles: process(byRange), rangeKey: lastKey };
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
 * 여러 RSS 피드에서 기사 수집 (병렬)
 * @returns 수집된 기사 및 오류 정보 (모든 피드 실패 시 error 설정)
 */
export async function fetchRssFeeds(options: FetchRssOptions): Promise<FetchRssResult> {
  const { sources, onProgress } = options;
  if (sources.length === 0) return { articles: [] };

  const results = await Promise.all(
    sources.map(async (s, idx) => {
      if (s.id === "finnhub") {
        const items = await fetchFinnhubNews(s.id, s.name);
        onProgress?.(idx + 1, sources.length);
        return { sourceName: s.name, articles: items, ok: items.length > 0 };
      }
      const useRss2Json = s.id.startsWith("gn_") || s.id === "sbs_economy" || s.id === "yna_economy";
      let items: RawRssArticle[] = [];
      if (useRss2Json) {
        const urlsToTry = s.id === "hankyung_finance"
          ? ["https://www.hankyung.com/feed/finance", "https://www.hankyung.com/feed/economy"]
          : [s.rssUrl];
        for (const u of urlsToTry) {
          const parsed = await fetchViaRss2Json(u, s.id, s.name);
          if (parsed && parsed.length > 0) {
            items = parsed;
            break;
          }
        }
      }
      if (items.length === 0) {
        const urlsToTry = [s.rssUrl];
        let ok = false;
        let text = "";
        for (const u of urlsToTry) {
          const r = await fetchViaCorsProxy(u, { timeoutMs: RSS_TIMEOUT_MS });
          if (r.ok && r.text) {
            ok = true;
            text = r.text;
            break;
          }
        }
        if (!ok) {
          onProgress?.(idx + 1, sources.length);
          return { sourceName: s.name, articles: [], ok: false };
        }
        items = parseRssXml(text, s.id, s.name);
      }
      onProgress?.(idx + 1, sources.length);
      return { sourceName: s.name, articles: items, ok: items.length > 0 };
    })
  );

  const allArticles: RawRssArticle[] = [];
  const failedSources: string[] = [];
  for (const r of results) {
    if (r.ok) allArticles.push(...r.articles);
    else failedSources.push(r.sourceName);
  }

  if (allArticles.length === 0 && failedSources.length > 0) {
    return {
      articles: [],
      error: `RSS 피드 수집 실패: ${failedSources.join(", ")}에서 기사를 가져올 수 없습니다. 네트워크를 확인하거나 나중에 다시 시도해주세요.`,
    };
  }

  return { articles: allArticles };
}
