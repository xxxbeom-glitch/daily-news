/**
 * 관리자 전용 설정 (localStorage)
 */

const ADMIN_HIDE_MARKET_KEY = "newsbrief_admin_hide_market";
const ADMIN_SHOW_NEWS_TAB_KEY = "newsbrief_admin_show_news_tab";
const ADMIN_MODEL_ID_KEY = "newsbrief_admin_model_id";
const ADMIN_MOVERS_KEY = "newsbrief_admin_movers";
const ADMIN_SCHEDULE_KEY = "newsbrief_admin_schedule";
const ADMIN_TEST_RUN_KEY = "newsbrief_admin_test_run";
const ADMIN_TEST_EXPECTED_READY_KEY = "newsbrief_admin_test_expected_ready";

/** 오늘의 시황 데이터 전부 숨김 */
export function getAdminHideMarket(): boolean {
  try {
    return localStorage.getItem(ADMIN_HIDE_MARKET_KEY) === "true";
  } catch {
    return false;
  }
}

export function setAdminHideMarket(value: boolean): void {
  try {
    localStorage.setItem(ADMIN_HIDE_MARKET_KEY, value ? "true" : "false");
    window.dispatchEvent(new CustomEvent("newsbrief_admin_changed"));
  } catch {}
}

/** 오늘의 뉴스 탭 표시 */
export function getAdminShowNewsTab(): boolean {
  try {
    const v = localStorage.getItem(ADMIN_SHOW_NEWS_TAB_KEY);
    return v !== "false"; // 기본값 true
  } catch {
    return true;
  }
}

export function setAdminShowNewsTab(value: boolean): void {
  try {
    localStorage.setItem(ADMIN_SHOW_NEWS_TAB_KEY, value ? "true" : "false");
    window.dispatchEvent(new CustomEvent("newsbrief_admin_changed"));
  } catch {}
}

/** 사용 가능한 엔진 모델 */
export const GEMINI_MODELS = ["gemini-3.1-pro-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"];
export const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"];
export const ALL_MODEL_IDS = [...GEMINI_MODELS, ...OPENAI_MODELS];

/** 관리자 지정 모델 ID - 비활성화 (항상 기본 설정 사용) */
export function getAdminModelId(): string | null {
  return null;
}

export function setAdminModelId(modelId: string | null): void {
  try {
    if (modelId) localStorage.setItem(ADMIN_MODEL_ID_KEY, modelId);
    else localStorage.removeItem(ADMIN_MODEL_ID_KEY);
  } catch {}
}

/** M7·반도체주 종목 (ticker → name) */
export const DEFAULT_MOVERS: Record<string, string> = {
  NVDA: "엔비디아", AAPL: "애플", MSFT: "마이크로소프트", GOOGL: "알파벳",
  AMZN: "아마존", META: "메타", TSLA: "테슬라",
  PLTR: "팔란티어", INTC: "인텔", AMD: "AMD", MU: "마이크론", WDC: "웨스턴디지털",
};

export function getAdminMovers(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ADMIN_MOVERS_KEY);
    if (!raw) return DEFAULT_MOVERS;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed === "object" && parsed !== null ? parsed : DEFAULT_MOVERS;
  } catch {
    return DEFAULT_MOVERS;
  }
}

export function setAdminMovers(map: Record<string, string>): void {
  try {
    localStorage.setItem(ADMIN_MOVERS_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("newsbrief_admin_changed"));
  } catch {}
}

/** 자동생성 스케줄 (분) */
export interface AdminSchedule {
  usHour: number;
  usMinute: number;
  krHour: number;
  krMinute: number;
}

const DEFAULT_SCHEDULE: AdminSchedule = { usHour: 8, usMinute: 30, krHour: 16, krMinute: 30 };

export function getAdminSchedule(): AdminSchedule {
  try {
    const raw = localStorage.getItem(ADMIN_SCHEDULE_KEY);
    if (!raw) return DEFAULT_SCHEDULE;
    const parsed = JSON.parse(raw) as AdminSchedule;
    if (parsed && typeof parsed.usHour === "number" && typeof parsed.usMinute === "number" &&
        typeof parsed.krHour === "number" && typeof parsed.krMinute === "number") {
      return parsed;
    }
    return DEFAULT_SCHEDULE;
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export function setAdminSchedule(s: AdminSchedule): void {
  try {
    localStorage.setItem(ADMIN_SCHEDULE_KEY, JSON.stringify(s));
  } catch {}
}

/** 테스트 실행 트리거 (timestamp. 이 시간 이후 체크 시 즉시 실행. Date.now()로 설정하면 바로 실행) */
export function getAdminTestRunAt(): number | null {
  try {
    const v = localStorage.getItem(ADMIN_TEST_RUN_KEY);
    const ts = v ? parseInt(v, 10) : NaN;
    return !isNaN(ts) ? ts : null;
  } catch {
    return null;
  }
}

export function setAdminTestRunAt(timestamp: number | null): void {
  try {
    if (timestamp) localStorage.setItem(ADMIN_TEST_RUN_KEY, String(timestamp));
    else localStorage.removeItem(ADMIN_TEST_RUN_KEY);
    window.dispatchEvent(new CustomEvent("newsbrief_admin_changed"));
  } catch {}
}

/** 테스트 결과 예상 시각 (타이머 표시용. 이 시각까지 카운트다운) */
export function getAdminTestExpectedReadyAt(): number | null {
  try {
    const v = localStorage.getItem(ADMIN_TEST_EXPECTED_READY_KEY);
    const ts = v ? parseInt(v, 10) : NaN;
    return !isNaN(ts) ? ts : null;
  } catch {
    return null;
  }
}

export function setAdminTestExpectedReadyAt(timestamp: number | null): void {
  try {
    if (timestamp) localStorage.setItem(ADMIN_TEST_EXPECTED_READY_KEY, String(timestamp));
    else localStorage.removeItem(ADMIN_TEST_EXPECTED_READY_KEY);
    window.dispatchEvent(new CustomEvent("newsbrief_admin_changed"));
  } catch {}
}
