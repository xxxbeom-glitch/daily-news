/**
 * 시장 지수·종목 데이터 수집
 * - 해외: Yahoo Finance 고정 (^GSPC, ^IXIC, ^DJI, GLD, SLV + M7/반도체주)
 * - 국내: Yahoo Finance ^KS11, ^KQ11, ^KS200 (야후 파이낸스)
 */

import type { IndexData, StockMover, SourceRef, MarketMoversBlock } from "../data/marketSummary";
import { fetchViaCorsProxy } from "./corsProxy";
import { getAdminMovers } from "./adminSettings";

const FINNHUB_QUOTE = "https://finnhub.io/api/v1/quote";
const FINNHUB_EARNINGS = "https://finnhub.io/api/v1/calendar/earnings";
const YAHOO_CHART =
  import.meta.env.DEV
    ? "/api/yahoo/v8/finance/chart"
    : "https://query1.finance.yahoo.com/v8/finance/chart";
const TIMEOUT_MS = 12000;

/** 국내 지수 (Yahoo Finance) */
const DOMESTIC_YAHOO_INDICES = [
  { symbol: "^KS11", name: "코스피" },
  { symbol: "^KQ11", name: "코스닥" },
  { symbol: "^KS200", name: "코스피 200" },
];

/** 해외 대표지수 (Yahoo Finance 고정 - 금/은은 COMEX 선물=현물 기준가) */
const INTERNATIONAL_YAHOO_INDICES = [
  { symbol: "^GSPC", name: "S&P500" },
  { symbol: "^IXIC", name: "나스닥" },
  { symbol: "^DJI", name: "다우존스" },
  { symbol: "GC=F", name: "금" },   // COMEX 골드 선물(현물 기준)
  { symbol: "SI=F", name: "은" },   // COMEX 실버 선물(현물 기준)
];

interface FinnhubEarningsItem {
  date?: string;
  symbol?: string;
  epsActual?: number | null;
  epsEstimate?: number | null;
  revenueActual?: number | null;
  revenueEstimate?: number | null;
  year?: number;
  quarter?: number;
}

/** 공공데이터 지수 API (프록시 경유) */
const DATA_GO_KR_BASE = "/api/data-go-kr/1160100/service/GetMarketIndexInfoService";

interface FinnhubQuote {
  c: number;   // current price
  d: number | null;
  dp: number | null;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

/** Finnhub ETF (해외 지수 폴백) */
const INTERNATIONAL_FINNHUB_INDICES = [
  { symbol: "SPY", name: "S&P500" },
  { symbol: "QQQ", name: "나스닥" },
  { symbol: "DIA", name: "다우존스" },
  { symbol: "GLD", name: "금" },
  { symbol: "SLV", name: "은" },
];

/** 공공데이터 파싱용 지수명 */
const DOMESTIC_INDEX_NAMES = ["코스피", "코스닥"] as const;

/** Finnhub ETF로 국내 지수 폴백 (Yahoo 실패 시) */
const DOMESTIC_INDICES_FINNHUB = [
  { symbol: "069500.KS", name: "코스피" },
  { symbol: "229720.KQ", name: "코스닥" },
];

/** M7 + 반도체주 등락율 (관리자 설정 우선) */
function getM7SemiMoversMap(): Record<string, string> {
  return getAdminMovers();
}

function getM7SemiMovers(): string[] {
  return Object.keys(getM7SemiMoversMap());
}

/** 국내 코스피 대표 종목 (심볼 → 기업명, 코스피 상승/하락 TOP3용) */
const DOMESTIC_MOVERS_MAP: Record<string, string> = {
  "005930.KS": "삼성전자", "000660.KS": "SK하이닉스", "035420.KS": "네이버", "051910.KS": "LG화학",
  "005380.KS": "현대차", "000270.KS": "기아",
};

const DOMESTIC_MOVERS = Object.keys(DOMESTIC_MOVERS_MAP);

function formatNum(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function formatChange(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function formatChangeAbs(change: number): string {
  const sign = change >= 0 ? "▲" : "▼";
  return `${sign}${Math.abs(change).toFixed(2)}`;
}

function getFinnhubKey(): string {
  let key = (import.meta.env.VITE_FINNHUB_API_KEY as string) ?? "";
  key = key.trim().replace(/^["']|["']$/g, "");
  return key;
}

function getDataGoKrKey(): string {
  let key = (import.meta.env.VITE_DATA_GO_KR_SERVICE_KEY as string) ?? "";
  key = key.trim().replace(/^["']|["']$/g, "");
  return key;
}

/** Yahoo Finance 차트 API로 국내 지수 조회 (종가 기준) */
async function fetchYahooIndices(): Promise<IndexData[] | null> {
  const results: IndexData[] = [];
  for (const { symbol, name } of DOMESTIC_YAHOO_INDICES) {
    const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const { ok, text } = await fetchViaCorsProxy(url, { timeoutMs: TIMEOUT_MS });
    if (!ok || !text) continue;
    try {
      const json = JSON.parse(text) as {
        chart?: {
          result?: Array<{
            meta?: { regularMarketPrice?: number; chartPreviousClose?: number; regularMarketClose?: number };
            indicators?: { quote?: Array<{ close?: (number | null)[] }> };
          }>;
        };
      };
      const result = json?.chart?.result?.[0];
      if (!result) continue;
      const closes = result.indicators?.quote?.[0]?.close?.filter((c) => c != null) ?? [];
      const price = (result.meta as { regularMarketClose?: number })?.regularMarketClose ?? closes[closes.length - 1] ?? result.meta?.regularMarketPrice;
      const prev = result.meta?.chartPreviousClose ?? closes[closes.length - 2];
      if (price == null || prev == null) continue;
      const change = price - prev;
      const changePct = prev !== 0 ? (change / prev) * 100 : 0;
      results.push({
        name,
        value: formatNum(price),
        change: formatChange(changePct),
        changeAbs: change >= 0 ? `▲${Math.abs(change).toFixed(2)}` : `▼${Math.abs(change).toFixed(2)}`,
        isUp: change >= 0,
      });
    } catch {
      continue;
    }
  }
  return results.length >= 2 ? results : null;
}

/** Yahoo Finance 차트 API로 해외 대표지수 조회 (종가 기준) */
async function fetchYahooInternationalIndices(): Promise<IndexData[] | null> {
  const results: IndexData[] = [];
  for (const { symbol, name } of INTERNATIONAL_YAHOO_INDICES) {
    const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const { ok, text } = await fetchViaCorsProxy(url, { timeoutMs: TIMEOUT_MS });
    if (!ok || !text) continue;
    try {
      const json = JSON.parse(text) as {
        chart?: {
          result?: Array<{
            meta?: { regularMarketPrice?: number; chartPreviousClose?: number };
            indicators?: { quote?: Array<{ close?: (number | null)[] }> };
          }>;
        };
      };
      const result = json?.chart?.result?.[0];
      if (!result) continue;
      const closes = result.indicators?.quote?.[0]?.close?.filter((c) => c != null) ?? [];
      const price = (result.meta as { regularMarketClose?: number })?.regularMarketClose ?? closes[closes.length - 1] ?? result.meta?.regularMarketPrice;
      const prev = result.meta?.chartPreviousClose ?? closes[closes.length - 2];
      if (price == null || prev == null) continue;
      const change = price - prev;
      const changePct = prev !== 0 ? (change / prev) * 100 : 0;
      results.push({
        name,
        value: formatNum(price),
        change: formatChange(changePct),
        changeAbs: change >= 0 ? `▲${Math.abs(change).toFixed(2)}` : `▼${Math.abs(change).toFixed(2)}`,
        isUp: change >= 0,
      });
    } catch {
      continue;
    }
  }
  return results.length >= 2 ? results : null;
}

/** Yahoo Finance로 M7·반도체주 등락율 조회 (종가 기준) */
async function fetchYahooStockMovers(): Promise<{ up: StockMover[]; down: StockMover[] } | null> {
  const nameMap = getM7SemiMoversMap();
  const symbols = Object.keys(nameMap);
  if (symbols.length === 0) return null;

  const items: { symbol: string; name: string; changePct: number }[] = [];
  for (const symbol of symbols) {
    const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const { ok, text } = await fetchViaCorsProxy(url, { timeoutMs: TIMEOUT_MS });
    if (!ok || !text) continue;
    try {
      const json = JSON.parse(text) as {
        chart?: {
          result?: Array<{
            meta?: { regularMarketPrice?: number; chartPreviousClose?: number };
            indicators?: { quote?: Array<{ close?: (number | null)[] }> };
          }>;
        };
      };
      const result = json?.chart?.result?.[0];
      if (!result) continue;
      const closes = result.indicators?.quote?.[0]?.close?.filter((c) => c != null) ?? [];
      const price = (result.meta as { regularMarketClose?: number })?.regularMarketClose ?? closes[closes.length - 1] ?? result.meta?.regularMarketPrice;
      const prev = result.meta?.chartPreviousClose ?? closes[closes.length - 2];
      if (price == null || prev == null) continue;
      const changePct = prev !== 0 ? ((price - prev) / prev) * 100 : 0;
      items.push({
        symbol,
        name: nameMap[symbol] ?? symbol,
        changePct,
      });
    } catch {
      continue;
    }
  }

  if (items.length === 0) return null;
  return toStockMovers(items);
}

/** 공공데이터 지수시세 응답 항목 (필드명 변형 지원) */
interface DataGoKrIndexItem {
  basDt?: string;
  idxNm?: string;
  itmsNm?: string;
  clpr?: string;
  vs?: string;
  fltRt?: string;
  prdyVrss?: string;  // 전일대비
  prdyCtrt?: string; // 전일대비율
}

/** 최근 확정 영업일 (YYYYMMDD). 금융위: 기준일+1일 오후 1시 이후 갱신 */
function getLatestBaseDate(): string {
  const now = new Date();
  const day = now.getDay();
  let diff = 1;
  if (day === 0) diff = 2; // 일요일 → 금요일
  else if (day === 6) diff = 1; // 토요일 → 금요일
  else if (day === 1 && now.getHours() < 14) diff = 3; // 월요일 오전 → 전주 금요일
  else if (now.getHours() < 14) diff = 1; // 당일 오후 1시 전 → 전일
  now.setDate(now.getDate() - diff);
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

function normalizeDataGoKrItems(items: unknown): DataGoKrIndexItem[] {
  if (!items) return [];
  if (Array.isArray(items)) return items as DataGoKrIndexItem[];
  const obj = items as Record<string, unknown>;
  if (Array.isArray(obj.item)) return obj.item as DataGoKrIndexItem[];
  if (obj.item && typeof obj.item === "object") return [obj.item as DataGoKrIndexItem];
  return [items as DataGoKrIndexItem];
}

/** 공공데이터 지수 API 조회 (코스피, 코스닥). 프로덕션 빌드에서는 프록시 없어 실패하므로 Finnhub로 폴백 */
async function fetchDataGoKrIndices(): Promise<IndexData[] | null> {
  const key = getDataGoKrKey();
  if (!key) return null;
  if (import.meta.env.PROD) return null; // 프로덕션: /api/data-go-kr 프록시 없음 → Finnhub만 사용

  const dates = [getLatestBaseDate()];
  const now = new Date();
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`);
  }

  for (const basDt of dates) {
    const url = `${DATA_GO_KR_BASE}/getStockMarketIndex?serviceKey=${encodeURIComponent(key)}&numOfRows=100&pageNo=1&resultType=json&basDt=${basDt}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const json = (await res.json()) as { response?: { header?: { resultCode?: string }; body?: { items?: unknown } } };
      if (json?.response?.header?.resultCode && json.response.header.resultCode !== "00") continue;
      const arr = normalizeDataGoKrItems(json?.response?.body?.items);
      if (arr.length === 0) continue;

      const result: IndexData[] = [];
      for (const name of DOMESTIC_INDEX_NAMES) {
        const match = arr.find(
          (x) =>
            (String(x.idxNm ?? "").includes(name) || String(x.itmsNm ?? "").includes(name)) &&
            !String(x.idxNm ?? "").includes("200")
        );
        if (!match) continue;
        const clpr = match.clpr ? parseFloat(String(match.clpr)) : NaN;
        const vs = parseFloat(String(match.vs ?? match.prdyVrss ?? 0)) || 0;
        const fltRt = match.fltRt ? parseFloat(String(match.fltRt)) : (match.prdyCtrt ? parseFloat(String(match.prdyCtrt)) : (clpr && !Number.isNaN(clpr) ? (vs / (clpr - vs)) * 100 : 0));
        if (Number.isNaN(clpr)) continue;
        result.push({
          name,
          value: formatNum(clpr),
          change: formatChange(fltRt),
          changeAbs: vs >= 0 ? `▲${Math.abs(vs).toFixed(2)}` : `▼${Math.abs(vs).toFixed(2)}`,
          isUp: vs >= 0,
        });
      }
      if (result.length >= 2) return result;
    } catch {
      clearTimeout(timeout);
    }
  }
  return null;
}

async function fetchFinnhubQuote(symbol: string): Promise<FinnhubQuote | null> {
  const key = getFinnhubKey();
  if (!key) return null;

  const url = `${FINNHUB_QUOTE}?symbol=${encodeURIComponent(symbol)}&token=${key}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as FinnhubQuote;
    if (data.c == null || data.c === 0) return null;
    return data;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function fetchFinnhubQuoteWithName(
  symbol: string,
  displayName: string
): Promise<{ symbol: string; price: number; change: number; changePct: number; name: string } | null> {
  const q = await fetchFinnhubQuote(symbol);
  if (!q) return null;
  const change = q.d ?? q.c - q.pc;
  const changePct = q.dp ?? (q.pc !== 0 ? ((q.c - q.pc) / q.pc) * 100 : 0);
  return {
    symbol,
    price: q.c,
    change,
    changePct,
    name: displayName,
  };
}

export interface FetchIndicesResult {
  indices: IndexData[];
  source: SourceRef;
}

export async function fetchIndices(isInternational: boolean): Promise<FetchIndicesResult> {
  const finnhubSource: SourceRef = { outlet: "Finnhub", headline: "실시간 시세" };
  const yahooSource: SourceRef = { outlet: "Yahoo Finance", headline: "실시간 지수" };

  if (isInternational) {
    const yahooIndices = await fetchYahooInternationalIndices();
    if (yahooIndices && yahooIndices.length >= 2) {
      return { indices: yahooIndices, source: yahooSource };
    }
    const symbols = INTERNATIONAL_FINNHUB_INDICES;
    const results = await Promise.all(
      symbols.map(({ symbol, name }) => fetchFinnhubQuoteWithName(symbol, name))
    );
    const indices = results
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({
        name: r.name,
        value: formatNum(r.price),
        change: formatChange(r.changePct),
        changeAbs: formatChangeAbs(r.change),
        isUp: r.change >= 0,
      }));
    return { indices, source: finnhubSource };
  }

  const yahooIndices = await fetchYahooIndices();
  if (yahooIndices && yahooIndices.length >= 2) {
    return { indices: yahooIndices, source: yahooSource };
  }

  const dataGoKr = await fetchDataGoKrIndices();
  if (dataGoKr && dataGoKr.length >= 2) {
    return { indices: dataGoKr, source: { outlet: "공공데이터포털", headline: "금융위원회 지수시세" } };
  }

  const symbols = DOMESTIC_INDICES_FINNHUB;
  const results = await Promise.all(
    symbols.map(({ symbol, name }) => fetchFinnhubQuoteWithName(symbol, name))
  );
  const indices = results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => ({
      name: r.name,
      value: formatNum(r.price),
      change: formatChange(r.changePct),
      changeAbs: formatChangeAbs(r.change),
      isUp: r.change >= 0,
    }));
  return { indices, source: finnhubSource };
}

/** 헤더 티커용 전용 심볼 (Finnhub 폴백용) */
const HEADER_TICKER_SYMBOLS = [
  { symbol: "SPY", name: "S&P500" },
  { symbol: "QQQ", name: "나스닥" },
  { symbol: "DIA", name: "다우존스" },
  { symbol: "GLD", name: "금" },
  { symbol: "SLV", name: "은" },
  { symbol: "069500.KS", name: "코스피" },
  { symbol: "229720.KQ", name: "코스닥" },
];

const HEADER_TICKER_ORDER = ["S&P500", "나스닥", "다우존스", "금", "은", "코스피", "코스닥"];

/** 헤더 티커용: Yahoo Finance 1차, 실패 시 Finnhub 폴백 */
export async function fetchHeaderTickerIndices(): Promise<IndexData[]> {
  const [yahooIntl, yahooDom] = await Promise.all([
    fetchYahooInternationalIndices(),
    fetchYahooIndices(),
  ]);
  const byName = new Map<string, IndexData>();
  for (const i of yahooIntl ?? []) byName.set(i.name, i);
  for (const i of yahooDom ?? []) byName.set(i.name, i);
  const fromYahoo = HEADER_TICKER_ORDER.filter((n) => byName.has(n)).map((n) => byName.get(n)!);
  if (fromYahoo.length >= 5) return fromYahoo;

  const key = getFinnhubKey();
  if (key) {
    const results = await Promise.all(
      HEADER_TICKER_SYMBOLS.map(({ symbol, name }) =>
        fetchFinnhubQuoteWithName(symbol, name)
      )
    );
    const fast = results
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({
        name: r.name,
        value: formatNum(r.price),
        change: formatChange(r.changePct),
        changeAbs: formatChangeAbs(r.change),
        isUp: r.change >= 0,
      }));
    if (fast.length >= 5) {
      const byNameFinnhub = new Map(fast.map((i) => [i.name, i]));
      return HEADER_TICKER_ORDER.filter((n) => byNameFinnhub.has(n)).map((n) => byNameFinnhub.get(n)!);
    }
  }
  const [intl, dom] = await Promise.all([fetchIndices(true), fetchIndices(false)]);
  byName.clear();
  for (const i of intl.indices) byName.set(i.name, i);
  for (const i of dom.indices) byName.set(i.name, i);
  return HEADER_TICKER_ORDER
    .filter((name) => byName.has(name))
    .map((name) => byName.get(name)!);
}

function toStockMovers(items: { symbol: string; name: string; changePct: number }[]): { up: StockMover[]; down: StockMover[] } {
  const sorted = [...items].sort((a, b) => b.changePct - a.changePct);
  const up = sorted
    .filter((x) => x.changePct > 0)
    .map((x) => ({
      name: x.name,
      ticker: x.symbol,
      changeRate: formatChange(x.changePct),
      isUp: true,
      reason: "AI가 뉴스에서 추출 예정",
    }));
  const down = sorted
    .filter((x) => x.changePct < 0)
    .map((x) => ({
      name: x.name,
      ticker: x.symbol,
      changeRate: formatChange(x.changePct),
      isUp: false,
      reason: "AI가 뉴스에서 추출 예정",
    }));
  return { up, down };
}

export async function fetchTopMovers(
  isInternational: boolean,
  _limit?: number
): Promise<
  | { up: StockMover[]; down: StockMover[]; sources: SourceRef[] }
  | { kospiMovers: MarketMoversBlock }
> {
  const yahooSource: SourceRef = { outlet: "Yahoo Finance", headline: "실시간 시세" };
  const finnhubSource: SourceRef = { outlet: "Finnhub", headline: "실시간 시세" };

  if (isInternational) {
    const yahooMovers = await fetchYahooStockMovers();
    if (yahooMovers && (yahooMovers.up.length > 0 || yahooMovers.down.length > 0)) {
      return { ...yahooMovers, sources: [yahooSource] };
    }
  }

  const symbols = isInternational ? getM7SemiMovers() : [...DOMESTIC_MOVERS];
  const nameMap = isInternational ? getM7SemiMoversMap() : DOMESTIC_MOVERS_MAP;
  const results = await Promise.all(
    symbols.map((sym) => fetchFinnhubQuoteWithName(sym, nameMap[sym] ?? sym))
  );

  const withChange = results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => ({ symbol: r.symbol, name: r.name, changePct: r.changePct }));

  if (isInternational) {
    const { up, down } = toStockMovers(withChange);
    return { up, down, sources: [finnhubSource] };
  }

  const kospi = withChange.filter((x) => x.symbol.endsWith(".KS"));
  const ks = toStockMovers(kospi);
  return {
    kospiMovers: { up: ks.up, down: ks.down, sources: [finnhubSource] },
  };
}

/** Finnhub 실적 캘린더 API - S&P500 기업명으로 예정 일정 (3개 초과 시 외) */
async function fetchEarningsCalendar(from: string, to: string): Promise<string[]> {
  const key = getFinnhubKey();
  if (!key) return [];

  const url = `${FINNHUB_EARNINGS}?from=${from}&to=${to}&token=${key}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const json = (await res.json()) as { earningsCalendar?: FinnhubEarningsItem[] };
    const items = json?.earningsCalendar ?? [];
    if (items.length === 0) return [];

    const byDate = new Map<string, string[]>();
    for (const e of items) {
      const sym = e.symbol ?? "";
      if (!sym || sym.includes(".")) continue;
      if (!SP500_NAME_MAP[sym]) continue; // S&P500 기업만
      const dt = e.date ?? "";
      if (!dt) continue;
      if (!byDate.has(dt)) byDate.set(dt, []);
      byDate.get(dt)!.push(SP500_NAME_MAP[sym]);
    }

    const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.slice(0, 7).map(([date, names]) => {
      const [, m, d] = date.split("-");
      const count = names.length;
      const display = count > 3 ? `${names.slice(0, 3).join(", ")} 외` : names.join(", ");
      return `${m}/${d} (${count}): ${display}`;
    });
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

/** S&P500 대표 기업 심볼→이름 (실적 일정 표시용) */
const SP500_NAME_MAP: Record<string, string> = {
  AAPL: "애플", MSFT: "마이크로소프트", GOOGL: "알파벳", AMZN: "아마존", NVDA: "엔비디아",
  META: "메타", BRK: "버크셔", UNH: "유나이티드헬스", JNJ: "존슨앤존슨", JPM: "JP모건",
  V: "비자", PG: "P&G", MA: "마스터카드", HD: "홈디포", CVX: "척스론",
  MRK: "머크", ABBV: "애브비", PEP: "펩시", KO: "코카콜라", COST: "코스트코",
  WMT: "월마트", MCD: "맥도날드", AVGO: "브로드컴", CRM: "세일즈포스", CSCO: "시스코",
  TXN: "텍사스인스트루먼트", ACN: "액센츄어", AMD: "AMD", ADBE: "어도비", ORCL: "오라클",
  NFLX: "넷플릭스", PM: "필립모리스", TMO: "써모피셔", DIS: "디즈니", INTC: "인텔",
  MU: "마이크론", WDC: "웨스턴디지털", PLTR: "팔란티어",
  NEE: "넥스트에라", WFC: "웰스파고", DHR: "다나허", VZ: "버라이즌", BMY: "브리스톨마이어스",
  XOM: "엑손모빌", RTX: "RTX", SPGI: "S&P글로벌", UNP: "유니온퍼시픽", HON: "허니웰",
  LMT: "록히드마틴", LRCX: "램리서치", AMGN: "앰젠", CAT: "캐터필러", BA: "보잉",
  SBUX: "스타벅스", MDLZ: "몬덜레즈", GILD: "길리어드", DE: "디어", ADP: "ADP",
};

export async function enrichMarketData(
  base: {
    indices?: IndexData[];
    indicesSources?: SourceRef[];
    stockMoversLabel?: string;
    moversUp?: StockMover[];
    moversDown?: StockMover[];
    moversSources?: SourceRef[];
    kospiMovers?: MarketMoversBlock;
    earningsUpcoming?: string[];
    earningsSources?: SourceRef[];
  },
  isInternational: boolean,
  options?: { preserveMovers?: boolean }
): Promise<void> {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const toDate = new Date(now);
  toDate.setDate(toDate.getDate() + 14);
  const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;

  const indicesPromise = fetchIndices(isInternational);
  const moversPromise = isInternational ? fetchTopMovers(true, 3) : Promise.resolve(null);
  const earningsPromise = isInternational ? fetchEarningsCalendar(from, to) : Promise.resolve([]);

  const [indicesResult, movers, apiEarnings] = await Promise.all([indicesPromise, moversPromise, earningsPromise]);

  if (indicesResult.indices.length > 0) {
    base.indices = indicesResult.indices;
    base.indicesSources = [indicesResult.source];
  } else if (!isInternational) {
    base.indicesSources = [{ outlet: "수집 뉴스 기반 AI 추정", headline: "실제 시세 API 미연결" }];
  }

  if (isInternational && !options?.preserveMovers && movers && "up" in movers) {
    const m = movers as { up: StockMover[]; down: StockMover[]; sources: SourceRef[] };
    if (m.up.length > 0 || m.down.length > 0) {
      base.stockMoversLabel = "M7 및 반도체주 등락율";
      base.moversUp = m.up;
      base.moversDown = m.down;
      base.moversSources = m.sources;
    }
  }

  if (isInternational && apiEarnings.length > 0) {
    base.earningsUpcoming = base.earningsUpcoming?.length ? [...base.earningsUpcoming, ...apiEarnings] : apiEarnings;
    if (!base.earningsSources?.length) base.earningsSources = [];
    base.earningsSources.push({ outlet: "Finnhub", headline: "실적 캘린더 API" });
  }

}

/** 오늘의 시장 대시보드용 심볼 */
export const DASHBOARD_SYMBOLS = {
  usIndices: [
    { symbol: "^GSPC", name: "S&P500" },
    { symbol: "^IXIC", name: "나스닥" },
    { symbol: "^DJI", name: "다우존스" },
  ],
  commodities: [
    { symbol: "GC=F", name: "금 현물" },
    { symbol: "SI=F", name: "은 현물" },
    { symbol: "CL=F", name: "WTI" },
  ],
  krIndices: [
    { symbol: "^KS11", name: "코스피" },
    { symbol: "^KQ11", name: "코스닥" },
    { symbol: "^KS200", name: "코스피200" },
  ],
  fx: [
    { symbol: "USDKRW=X", name: "원달러 환율" },
    { symbol: "DX-Y.NYB", name: "달러 인덱스" },
  ],
  etfs: [
    { symbol: "VOO", name: "VOO" },
    { symbol: "QQQ", name: "QQQ" },
  ],
  usStocks: [
    { symbol: "VRT", name: "VRT" },
    { symbol: "ASTS", name: "ASTS" },
    { symbol: "RKLB", name: "RKLB" },
  ],
  krStocks: [
    { symbol: "005930.KS", name: "삼성전자" },
    { symbol: "HPSP", name: "HPSP" },
  ],
} as const;

/** 캐러셀 표시용 그룹 (순서: S&P500·나스닥·다우 / 금·은·WTI / 코스피·코스닥·코스피200 / 원달러·달러인덱스 / VOO·QQQ·VRT·ASTS·RKLB / 삼성전자) */
export const CAROUSEL_GROUPS: string[][] = [
  ["^GSPC", "^IXIC", "^DJI"],
  ["GC=F", "SI=F", "CL=F"],
  ["^KS11", "^KQ11", "^KS200"],
  ["USDKRW=X", "DX-Y.NYB"],
  ["VOO", "QQQ", "VRT", "ASTS", "RKLB"],
  ["005930.KS"],
];

/** 캐러셀 섹션 타이틀 (타이틀 앞 iOS 이모지 포함) */
export const CAROUSEL_TITLES: string[] = [
  "📈 미국 3대지수",
  "🪙 원자재",
  "📊 한국 대표지수",
  "💱 환율",
  "🇺🇸 미국종목",
  "🇰🇷 한국종목",
];

export interface DashboardItem {
  symbol: string;
  name: string;
  value: string;
  change: string;
  isUp: boolean;
}

async function fetchYahooQuote(symbol: string, name: string): Promise<DashboardItem | null> {
  const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  let text: string;
  if (import.meta.env.DEV) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      text = await res.text();
    } catch {
      return null;
    }
  } else {
    const r = await fetchViaCorsProxy(url, { timeoutMs: 8000 });
    if (!r.ok || !r.text) return null;
    text = r.text;
  }
  try {
    const json = JSON.parse(text) as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number; chartPreviousClose?: number; regularMarketClose?: number };
          indicators?: { quote?: Array<{ close?: (number | null)[] }> };
        }>;
      };
    };
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const closes = result.indicators?.quote?.[0]?.close?.filter((c) => c != null) ?? [];
    const meta = result.meta as { regularMarketClose?: number; chartPreviousClose?: number; regularMarketPrice?: number };
    const price = meta?.regularMarketClose ?? closes[closes.length - 1] ?? meta?.regularMarketPrice;
    const prev = meta?.chartPreviousClose ?? closes[closes.length - 2];
    if (price == null || prev == null) return null;
    const changePct = prev !== 0 ? ((price - prev) / prev) * 100 : 0;
    return {
      symbol,
      name,
      value: formatNum(price),
      change: formatChange(changePct),
      isUp: changePct >= 0,
    };
  } catch {
    return null;
  }
}

/** 모든 심볼을 평탄화하여 2xn 카드용 목록 생성 */
export function getDashboardItemList(): { section: keyof typeof DASHBOARD_SYMBOLS; symbol: string; name: string }[] {
  const list: { section: keyof typeof DASHBOARD_SYMBOLS; symbol: string; name: string }[] = [];
  const sections = Object.keys(DASHBOARD_SYMBOLS) as (keyof typeof DASHBOARD_SYMBOLS)[];
  for (const section of sections) {
    for (const { symbol, name } of DASHBOARD_SYMBOLS[section]) {
      list.push({ section, symbol, name });
    }
  }
  return list;
}

export async function fetchDashboardData(): Promise<DashboardItem[]> {
  const list = getDashboardItemList();
  const results = await Promise.allSettled(
    list.map(({ symbol, name }) => fetchYahooQuote(symbol, name))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<DashboardItem | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is DashboardItem => v != null);
}

export type ChartRange = "1d" | "5d" | "1mo" | "5m" | "15m" | "1h";

const CHART_RANGE_CONFIG: Record<ChartRange, { interval: string; range: string }> = {
  "1d": { interval: "1d", range: "5d" },
  "5d": { interval: "1d", range: "1mo" },
  "1mo": { interval: "1mo", range: "1y" },
  "5m": { interval: "5m", range: "1d" },
  "15m": { interval: "15m", range: "5d" },
  "1h": { interval: "1h", range: "5d" },
};

export interface ChartDataPoint {
  time: string;
  /** Unix timestamp in seconds (for lightweight-charts) */
  timestamp?: number;
  value: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

function parseChartJson(text: string, interval: string): ChartDataPoint[] {
  try {
    const json = JSON.parse(text) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{ open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }>;
          };
        }>;
      };
    };
    const result = json?.chart?.result?.[0];
    if (!result) return [];
    const timestamps = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0];
    const opens = quote?.open ?? [];
    const highs = quote?.high ?? [];
    const lows = quote?.low ?? [];
    const closes = quote?.close ?? [];
    const out: ChartDataPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const open = opens[i] ?? closes[i];
      const high = highs[i] ?? closes[i];
      const low = lows[i] ?? closes[i];
      const close = closes[i];
      if (close == null) continue;
      const date = new Date(ts * 1000);
      const timeStr = interval === "1mo" || interval === "1d" || interval === "1wk"
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      out.push({
        time: timeStr,
        timestamp: ts,
        value: close,
        open: open ?? close,
        high: high ?? close,
        low: low ?? close,
        close,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** 종목별 주간 캔들 차트 데이터 (interval=1wk, range=1y) */
export async function fetchChartData(symbol: string): Promise<ChartDataPoint[]> {
  const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=1wk&range=1y`;
  let text: string;
  if (import.meta.env.DEV) {
    const res = await fetch(url);
    if (!res.ok) return [];
    text = await res.text();
  } else {
    const r = await fetchViaCorsProxy(url, { timeoutMs: 10000 });
    if (!r.ok || !r.text) return [];
    text = r.text;
  }
  return parseChartJson(text, "1wk");
}

export async function fetchVooChartData(range: ChartRange): Promise<ChartDataPoint[]> {
  const { interval, range: rangeParam } = CHART_RANGE_CONFIG[range];
  const url = `${YAHOO_CHART}/VOO?interval=${interval}&range=${rangeParam}`;
  let text: string;
  if (import.meta.env.DEV) {
    const res = await fetch(url);
    if (!res.ok) return [];
    text = await res.text();
  } else {
    const r = await fetchViaCorsProxy(url, { timeoutMs: 10000 });
    if (!r.ok || !r.text) return [];
    text = r.text;
  }
  return parseChartJson(text, interval);
}
