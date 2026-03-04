/**
 * 미국·한국 증시 휴장일 (YYYY-MM-DD)
 * 해당일에는 자동 시황 생성 건너뜀
 */

const US_HOLIDAYS = new Set([
  "2025-01-01", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26",
  "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25",
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
  "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
]);

const KR_HOLIDAYS = new Set([
  "2025-01-01", "2025-01-28", "2025-01-29", "2025-01-30", "2025-03-01",
  "2025-04-08", "2025-05-05", "2025-05-06", "2025-06-06", "2025-08-15",
  "2025-10-03", "2025-10-09", "2025-12-25",
  "2026-01-01", "2026-01-27", "2026-01-28", "2026-01-29", "2026-03-02",
  "2026-04-27", "2026-05-05", "2026-05-25", "2026-06-06", "2026-08-15",
  "2026-10-03", "2026-10-09", "2026-12-25",
]);

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 미국 증시 휴장일 (공휴일만, 주말 제외) */
export function isUsMarketHoliday(date: Date = new Date()): boolean {
  return US_HOLIDAYS.has(toDateKey(date));
}

/**
 * 미국 시황 요약 생성을 건너뛸지 여부.
 * 미국은 금요일 종료 후 한국 토요일 아침에 결과가 나오므로, 토요일 8:30에는 요약 실행.
 * 일요일만 건너뜀 (토요일 미국 휴장으로 새 데이터 없음).
 */
export function shouldSkipUsSummary(date: Date = new Date()): boolean {
  if (date.getDay() === 0) return true;
  return isUsMarketHoliday(date);
}

export function isKrMarketHoliday(date: Date = new Date()): boolean {
  return KR_HOLIDAYS.has(toDateKey(date));
}
