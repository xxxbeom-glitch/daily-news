/**
 * 오늘의 시장 대시보드 캐시
 * - 매일 6시~22시 KST, 2시간 단위로 갱신 (6, 8, 10, 12, 14, 16, 18, 20, 22시)
 * - localStorage 저장
 */

import type { DashboardItem } from "../utils/fetchMarketData";
import type { ChartDataPoint } from "../utils/fetchMarketData";

const CACHE_KEY = "market_dashboard_cache";
const CACHE_CHART_PREFIX = "market_chart_1wk_";

function getKstDate(): { y: number; m: number; d: number; hour: number } {
  const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });
  const [y, m, d] = formatter.format(new Date()).split("-").map(Number);
  const hour = parseInt(
    new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", hour: "numeric", hour12: false }).format(new Date()),
    10
  );
  return { y, m, d, hour };
}

/** 현재 슬롯의 유효 캐시 기준 시각(ms) - 이 시각 이후 fetch된 캐시만 유효 */
function getSlotStartMs(): number {
  const { y, m, d, hour } = getKstDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${y}-${pad(m)}-${pad(d)}`;

  const SLOT_HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22];
  if (hour < 6) {
    const todayDate = new Date(Date.UTC(y, m - 1, d));
    const yesterday = new Date(todayDate.getTime() - 86400000);
    const py = yesterday.getUTCFullYear();
    const pm = yesterday.getUTCMonth() + 1;
    const pd = yesterday.getUTCDate();
    return new Date(`${py}-${pad(pm)}-${pad(pd)}T22:00:00+09:00`).getTime();
  }
  const slotHour = [...SLOT_HOURS].reverse().find((h) => h <= hour) ?? 6;
  return new Date(`${today}T${String(slotHour).padStart(2, "0")}:00:00+09:00`).getTime();
}

export interface CachedDashboard {
  data: DashboardItem[];
  fetchedAt: number;
}

export function loadDashboardCache(): CachedDashboard | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedDashboard;
    if (!Array.isArray(parsed?.data) || typeof parsed?.fetchedAt !== "number") return null;
    const slotStart = getSlotStartMs();
    if (parsed.fetchedAt < slotStart) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDashboardCache(data: DashboardItem[]): void {
  try {
    const payload: CachedDashboard = { data, fetchedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

/** 현재 2시간 슬롯 기준으로 갱신이 필요한지 */
export function shouldRefreshDashboard(): boolean {
  return loadDashboardCache() === null;
}

/** 대시보드 캐시 갱신 시각(ms). 없으면 null */
export function getDashboardFetchedAt(): number | null {
  const cached = loadDashboardCache();
  return cached?.fetchedAt ?? null;
}

/** 차트 데이터 캐시 유효 여부 */
function isChartCacheValid(fetchedAt: number): boolean {
  return fetchedAt >= getSlotStartMs();
}

export function loadChartCache(symbol: string): ChartDataPoint[] | null {
  try {
    const raw = localStorage.getItem(CACHE_CHART_PREFIX + symbol);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: ChartDataPoint[]; fetchedAt: number };
    if (!Array.isArray(parsed?.data) || typeof parsed?.fetchedAt !== "number") return null;
    if (!isChartCacheValid(parsed.fetchedAt)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function saveChartCache(symbol: string, data: ChartDataPoint[]): void {
  try {
    const payload = { data, fetchedAt: Date.now() };
    localStorage.setItem(CACHE_CHART_PREFIX + symbol, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}
