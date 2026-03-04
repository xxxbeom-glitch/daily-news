/**
 * 모바일 브라우저에서 앱을 나갔다 오면 화면이 초기화되는 문제 방지
 * sessionStorage에 UI 상태 저장·복원
 */

const SEARCH_STATE_KEY = "dailynews_search_state";
const ARCHIVE_STATE_KEY = "dailynews_archive_state";
const SELECTED_SOURCES_KEY = "newsbrief_selected_sources";
const INTEREST_MEMORY_DOMESTIC_KEY = "newsbrief_interest_memory_domestic";
const INTEREST_MEMORY_INTERNATIONAL_KEY = "newsbrief_interest_memory_international";

export const DEFAULT_DOMESTIC_SOURCES = ["hankyung_all", "hankyung_finance", "mk", "sbs"];
export const DEFAULT_INTERNATIONAL_SOURCES = ["finnhub", "yahoofinance", "cnbc_investing", "cnbc_tech", "wsj", "bloomberg"];

export interface SelectedSourcesState {
  domestic: string[];
  international: string[];
}

export function getSelectedSources(): SelectedSourcesState {
  try {
    const raw = localStorage.getItem(SELECTED_SOURCES_KEY);
    if (!raw) return { domestic: DEFAULT_DOMESTIC_SOURCES, international: DEFAULT_INTERNATIONAL_SOURCES };
    const parsed = JSON.parse(raw) as SelectedSourcesState;
    if (!parsed || !Array.isArray(parsed.domestic) || !Array.isArray(parsed.international)) {
      return { domestic: DEFAULT_DOMESTIC_SOURCES, international: DEFAULT_INTERNATIONAL_SOURCES };
    }
    return parsed;
  } catch {
    return { domestic: DEFAULT_DOMESTIC_SOURCES, international: DEFAULT_INTERNATIONAL_SOURCES };
  }
}

export function setSelectedSources(state: SelectedSourcesState): void {
  try {
    localStorage.setItem(SELECTED_SOURCES_KEY, JSON.stringify(state));
  } catch {}
}

const INTEREST_MEMORY_MAX_LEN = 1000;

export function getInterestMemoryDomestic(): string {
  try {
    const raw = localStorage.getItem(INTEREST_MEMORY_DOMESTIC_KEY);
    return typeof raw === "string" ? raw.slice(0, INTEREST_MEMORY_MAX_LEN) : "";
  } catch {
    return "";
  }
}

export function setInterestMemoryDomestic(text: string): void {
  try {
    localStorage.setItem(INTEREST_MEMORY_DOMESTIC_KEY, text.slice(0, INTEREST_MEMORY_MAX_LEN));
  } catch {}
}

export function getInterestMemoryInternational(): string {
  try {
    const raw = localStorage.getItem(INTEREST_MEMORY_INTERNATIONAL_KEY);
    return typeof raw === "string" ? raw.slice(0, INTEREST_MEMORY_MAX_LEN) : "";
  } catch {
    return "";
  }
}

export function setInterestMemoryInternational(text: string): void {
  try {
    localStorage.setItem(INTEREST_MEMORY_INTERNATIONAL_KEY, text.slice(0, INTEREST_MEMORY_MAX_LEN));
  } catch {}
}

/** 메모리 텍스트를 키워드 배열로 파싱 (쉼표·줄바꿈·공백 구분) */
export function parseInterestKeywords(memory: string): string[] {
  if (!memory.trim()) return [];
  const keywords = memory
    .split(/[\s,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(keywords)];
}

export interface PersistedSearchState {
  selectedSources?: { domestic: string[]; international: string[] };
  selectedModel: "gemini" | "gpt";
  sourcesExpanded?: boolean;
  summaryInternational?: unknown;
  summaryDomestic?: unknown;
  summaryModel?: "gemini" | "gpt";
  /** @deprecated 이전 형식 호환 */
  isInternational?: boolean;
  summary?: unknown;
}

export interface PersistedArchiveState {
  isInternational: boolean;
  selectedSessionId: string | null;
}

function safeSet(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded 등
  }
}

export function saveSearchState(state: PersistedSearchState): void {
  safeSet(SEARCH_STATE_KEY, state);
}

export function loadSearchState(): PersistedSearchState | null {
  try {
    const raw = sessionStorage.getItem(SEARCH_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSearchState;
    if (!parsed) return null;
    if (parsed.selectedModel && parsed.selectedModel !== "gemini" && parsed.selectedModel !== "gpt") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveArchiveState(state: PersistedArchiveState): void {
  safeSet(ARCHIVE_STATE_KEY, state);
}

export function loadArchiveState(): PersistedArchiveState | null {
  try {
    const raw = sessionStorage.getItem(ARCHIVE_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedArchiveState;
    if (!parsed || typeof parsed.isInternational !== "boolean") return null;
    return parsed;
  } catch {
    return null;
  }
}
