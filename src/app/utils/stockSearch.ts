import { fetchViaCorsProxy } from "./corsProxy";

/** Yahoo Finance 검색 결과 (국내 .KS/.KQ, 해외 등) */
export interface StockSearchResult {
  symbol: string;      // "005930.KS", "AAPL"
  name: string;        // "삼성전자", "Apple Inc."
  exchange: string;   // "KSC", "NMS"
  type: string;       // "EQUITY"
  isDomestic: boolean; // .KS .KQ면 국내
}

const SEARCH_TIMEOUT_MS = 10000;

function isDomesticSymbol(symbol: string): boolean {
  return symbol.endsWith(".KS") || symbol.endsWith(".KQ");
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(trimmed)}&quotesCount=15&newsCount=0`;
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
