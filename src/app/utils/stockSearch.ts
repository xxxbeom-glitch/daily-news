import { fetchViaCorsProxy } from "./corsProxy";

/**
 * 관심종목 검색 - Finnhub + Yahoo Finance
 * - 공공데이터 API와 충돌 없음: 공공데이터는 지수(코스피/코스닥)·개별종목 시세용이고,
 *   종목 검색 기능은 없음. Finnhub이 국내(.KS/.KQ)·해외 종목 모두 검색 가능.
 */
/** 종목 검색 결과 (국내 .KS/.KQ, 해외 등) */
export interface StockSearchResult {
  symbol: string;      // "005930.KS", "AAPL"
  name: string;        // "삼성전자", "Apple Inc."
  exchange: string;    // "KSC", "NMS"
  type: string;       // "EQUITY"
  isDomestic: boolean; // .KS .KQ면 국내
}

const SEARCH_TIMEOUT_MS = 10000;

function isDomesticSymbol(symbol: string): boolean {
  return symbol.endsWith(".KS") || symbol.endsWith(".KQ");
}

function getFinnhubKey(): string {
  let key = (import.meta.env.VITE_FINNHUB_API_KEY as string) ?? "";
  key = key.trim().replace(/^["']|["']$/g, "");
  return key;
}

/** Finnhub 검색 API (API 키 있으면 CORS 없이 직접 호출) */
async function searchViaFinnhub(query: string): Promise<StockSearchResult[]> {
  const key = getFinnhubKey();
  if (!key) return [];

  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${key}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const data = (await res.json()) as { count?: number; result?: Array<{ description?: string; displaySymbol?: string; symbol?: string; type?: string }> };
    const results = data?.result ?? [];
    if (results.length === 0) return [];

    return results
      .filter((r) => r?.symbol && (r?.type === "Common Stock" || r?.type === "ETF" || !r?.type))
      .slice(0, 15)
      .map((r) => ({
        symbol: r.displaySymbol ?? r.symbol ?? "",
        name: r.description ?? r.symbol ?? "",
        exchange: r.symbol?.includes(".KS") ? "KSC" : r.symbol?.includes(".KQ") ? "KQC" : "",
        type: r.type ?? "EQUITY",
        isDomestic: isDomesticSymbol(r.displaySymbol ?? r.symbol ?? ""),
      }))
      .filter((s) => s.symbol);
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

/** Yahoo Finance 검색 (CORS 프록시 필요) */
async function searchViaYahoo(query: string): Promise<StockSearchResult[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0`;
  const { ok, text } = await fetchViaCorsProxy(url, { timeoutMs: SEARCH_TIMEOUT_MS });
  if (!ok) return [];

  try {
    const data = JSON.parse(text);
    const quotes = data?.quotes ?? [];
    return quotes
      .filter((q: { symbol?: string; quoteType?: string }) =>
        q?.symbol && (q?.quoteType === "EQUITY" || q?.quoteType === "ETF")
      )
      .map((q: { symbol: string; shortname?: string; longname?: string; exchange?: string; quoteType?: string }) => ({
        symbol: q.symbol,
        name: (q.longname || q.shortname || q.symbol) as string,
        exchange: q.exchange ?? "",
        type: q.quoteType ?? "EQUITY",
        isDomestic: isDomesticSymbol(q.symbol),
      }));
  } catch {
    return [];
  }
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const finnhubResults = await searchViaFinnhub(trimmed);
  if (finnhubResults.length > 0) return finnhubResults;

  return searchViaYahoo(trimmed);
}
