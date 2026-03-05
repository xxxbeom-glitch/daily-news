/**
 * 오늘의 시장 대시보드 캐시
 * - 9시, 16시 KST 기준으로 갱신
 * - localStorage 저장
 */

import type { DashboardItem } from "../utils/fetchMarketData";

const CACHE_KEY = "market_dashboard_cache";

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

  if (hour < 9) {
    const todayDate = new Date(Date.UTC(y, m - 1, d));
    const yesterday = new Date(todayDate.getTime() - 86400000);
    const py = yesterday.getUTCFullYear();
    const pm = yesterday.getUTCMonth() + 1;
    const pd = yesterday.getUTCDate();
    return new Date(`${py}-${pad(pm)}-${pad(pd)}T16:00:00+09:00`).getTime();
  }
  if (hour < 16) {
    return new Date(`${today}T09:00:00+09:00`).getTime();
  }
  return new Date(`${today}T16:00:00+09:00`).getTime();
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

/** 9시/16시 기준으로 갱신이 필요한지 */
export function shouldRefreshDashboard(): boolean {
  return loadDashboardCache() === null;
}
