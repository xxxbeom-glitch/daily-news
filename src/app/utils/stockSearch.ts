import { fetchViaCorsProxy } from "./corsProxy";

/**
 * 관심종목 검색
 * - 국내(한국): 공공데이터포털 금융위원회 주식발행정보 1차, Finnhub → Yahoo 폴백
 * - 해외(미국): Finnhub → Yahoo
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

function getDataGoKrKey(): string {
  let key = (import.meta.env.VITE_DATA_GO_KR_SERVICE_KEY as string) ?? "";
  key = key.trim().replace(/^["']|["']$/g, "");
  return key;
}

function getFinnhubKey(): string {
  let key = (import.meta.env.VITE_FINNHUB_API_KEY as string) ?? "";
  key = key.trim().replace(/^["']|["']$/g, "");
  return key;
}

/** 최근 확정 영업일 (YYYYMMDD) - 금융위 API 기준 */
function getLatestBaseDate(): string {
  const now = new Date();
  const day = now.getDay();
  let diff = 1;
  if (day === 0) diff = 2;
  else if (day === 6) diff = 1;
  else if (day === 1 && now.getHours() < 14) diff = 3;
  else if (now.getHours() < 14) diff = 1;
  now.setDate(now.getDate() - diff);
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

/** 공공데이터포털 금융위원회 주식발행정보 - 주식발행회사명으로 종목 검색 (국내) */
async function searchViaDataGoKr(query: string): Promise<StockSearchResult[]> {
  const key = getDataGoKrKey();
  if (!key) return [];

  const serviceKey = key.includes("%") ? key : encodeURIComponent(key);
  const base = "/api/data-go-kr/1160100/service/GetCorpBasicInfoService_V2";
  const url = `${base}/getCorpOutline_V2?serviceKey=${serviceKey}&pageNo=1&numOfRows=15&resultType=json&corpNm=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const json = (await res.json()) as {
      response?: {
        header?: { resultCode?: string };
        body?: { items?: unknown; totalCount?: number };
      };
    };
    if (json?.response?.header?.resultCode && json.response.header.resultCode !== "00") return [];

    const raw = json?.response?.body?.items;
    const items: Array<Record<string, unknown>> = [];
    if (Array.isArray(raw)) items.push(...raw);
    else if (raw && typeof raw === "object") {
      const r = raw as { item?: unknown };
      if (Array.isArray(r.item)) items.push(...(r.item as Record<string, unknown>[]));
      else if (r.item) items.push(r.item as Record<string, unknown>);
    }

    if (items.length === 0) return [];

    const results: StockSearchResult[] = [];
    for (const x of items.slice(0, 15)) {
      const code = String(x.srtnCd ?? x.itmCd ?? x.stckCd ?? "").trim();
      const name = String(x.corpNm ?? x.stckIssuCorpNm ?? x.itmNm ?? "").trim();
      const mkt = String(x.mktNm ?? x.seNm ?? "").toUpperCase();
      if (!name || !code || code.length < 5) continue;
      const code6 = code.replace(/\D/g, "").padStart(6, "0").slice(-6);
      if (code6.length < 5) continue;
      const suffix = mkt.includes("코스닥") || mkt.includes("KOSDAQ") ? ".KQ" : ".KS";
      results.push({
        symbol: code6 + suffix,
        name: name || code6,
        exchange: mkt.includes("코스닥") || mkt.includes("KOSDAQ") ? "KQC" : "KSC",
        type: "EQUITY",
        isDomestic: true,
      });
    }
    return results;
  } catch {
    clearTimeout(timeout);
    return [];
  }
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

export interface SearchStocksOptions {
  /** true면 국내 종목만(공공데이터 1차) */
  domesticOnly?: boolean;
}

export async function searchStocks(
  query: string,
  options?: SearchStocksOptions
): Promise<StockSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const domesticOnly = options?.domesticOnly ?? false;

  if (domesticOnly) {
    const dataGoKrResults = await searchViaDataGoKr(trimmed);
    if (dataGoKrResults.length > 0) return dataGoKrResults;

    const finnhubResults = await searchViaFinnhub(trimmed);
    const domestic = finnhubResults.filter((r) => r.isDomestic);
    if (domestic.length > 0) return domestic;

    const yahooResults = await searchViaYahoo(trimmed);
    return yahooResults.filter((r) => r.isDomestic);
  }

  const finnhubResults = await searchViaFinnhub(trimmed);
  if (finnhubResults.length > 0) return finnhubResults;

  return searchViaYahoo(trimmed);
}
