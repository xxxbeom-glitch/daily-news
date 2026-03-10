/**
 * 모바일 브라우저에서 앱을 나갔다 오면 화면이 초기화되는 문제 방지
 * sessionStorage에 UI 상태 저장·복원
 */

const SEARCH_STATE_KEY = "dailynews_search_state";
const ARCHIVE_STATE_KEY = "dailynews_archive_state";
const INSIGHT_CHIP_STATE_KEY = "newsbrief_insight_chip_state";
const SELECTED_SOURCES_KEY = "newsbrief_selected_sources";
const INTEREST_MEMORY_DOMESTIC_KEY = "newsbrief_interest_memory_domestic";
const INTEREST_MEMORY_INTERNATIONAL_KEY = "newsbrief_interest_memory_international";
const SELECTED_MODEL_KEY = "newsbrief_selected_model";
const SELECTED_MODEL_ID_KEY = "newsbrief_selected_model_id";
const COMPANY_ANALYSIS_SYSTEM_INSTRUCTION_KEY = "newsbrief_company_analysis_system_instruction";

/** 설정에서 모델 저장 시 디스패치되는 이벤트 (SearchStateContext 동기화용) */
export const SELECTED_MODEL_CHANGED_EVENT = "newsbrief_selected_model_changed";

/** 지원 모델 ID (provider 구분용) */
const GPT_PREFIX = "gpt-";
const CLAUDE_PREFIX = "claude-";

export const DEFAULT_DOMESTIC_SOURCES = ["gn_hankyung", "rss_mk_headline", "rss_mk_economy", "rss_mk_stock", "gn_sbs", "yna_economy"];
export const DEFAULT_INTERNATIONAL_SOURCES = [
  "rss_cnbc_finance",
  "rss_marketwatch_top",
  "rss_seeking_alpha",
];

/** 통합 기본 소스 (국내+해외) */
export const DEFAULT_SOURCES = [...DEFAULT_DOMESTIC_SOURCES, ...DEFAULT_INTERNATIONAL_SOURCES];

export interface SelectedSourcesState {
  sources: string[];
}

/** @deprecated 이전 domestic/international 형식 호환용 */
export interface LegacySelectedSourcesState {
  domestic?: string[];
  international?: string[];
}

const LEGACY_DOMESTIC_IDS = new Set(["hankyung_all", "hankyung_finance", "mk", "sbs", "sbs_economy", "gn_mk"]);
const LEGACY_INTERNATIONAL_IDS = new Set([
  "yahoofinance", "cnbc_investing", "cnbc_tech", "wsj", "bloomberg",
  "finnhub", "gn_cnbc", "gn_wsj", "gn_bloomberg", "gn_reuters", "gn_yahoo",
  "gn_investing", "gn_marketwatch",
]);

export function getSelectedSources(): SelectedSourcesState {
  try {
    const raw = localStorage.getItem(SELECTED_SOURCES_KEY);
    if (!raw) return { sources: DEFAULT_SOURCES };
    const parsed = JSON.parse(raw) as SelectedSourcesState & LegacySelectedSourcesState;
    if (!parsed) return { sources: DEFAULT_SOURCES };
    if (Array.isArray(parsed.sources)) {
      return { sources: parsed.sources };
    }
    if (Array.isArray(parsed.domestic) && Array.isArray(parsed.international)) {
      const merged = [...parsed.domestic, ...parsed.international];
      const hasLegacy = merged.some((id) => LEGACY_DOMESTIC_IDS.has(id) || LEGACY_INTERNATIONAL_IDS.has(id));
      if (hasLegacy) return { sources: DEFAULT_SOURCES };
      return { sources: merged };
    }
    return { sources: DEFAULT_SOURCES };
  } catch {
    return { sources: DEFAULT_SOURCES };
  }
}

export function setSelectedSources(state: SelectedSourcesState): void {
  try {
    localStorage.setItem(SELECTED_SOURCES_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("newsbrief_settings_changed"));
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
    window.dispatchEvent(new CustomEvent("newsbrief_settings_changed"));
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
    window.dispatchEvent(new CustomEvent("newsbrief_settings_changed"));
  } catch {}
}

/** 기억할 관심사 키워드 삭제 (국내·해외 모두) */
export function clearInterestMemory(): void {
  try {
    localStorage.removeItem(INTEREST_MEMORY_DOMESTIC_KEY);
    localStorage.removeItem(INTEREST_MEMORY_INTERNATIONAL_KEY);
    window.dispatchEvent(new CustomEvent("newsbrief_settings_changed"));
  } catch {}
}

export function getSelectedModel(): "gemini" | "gpt" | "claude" {
  const id = getSelectedModelId();
  if (id.startsWith(CLAUDE_PREFIX)) return "claude";
  if (id.startsWith(GPT_PREFIX)) return "gpt";
  return "gemini";
}

export function setSelectedModel(model: "gemini" | "gpt" | "claude"): void {
  try {
    localStorage.setItem(SELECTED_MODEL_KEY, model);
    window.dispatchEvent(new CustomEvent(SELECTED_MODEL_CHANGED_EVENT, { detail: model }));
  } catch {}
}

/** 구체적 모델 ID (예: gemini-2.5-flash, gpt-4o-mini, claude-opus-4-6) */
export function getSelectedModelId(): string {
  try {
    const v = localStorage.getItem(SELECTED_MODEL_ID_KEY);
    if (v && typeof v === "string" && v.trim()) return v.trim();
    const legacy = localStorage.getItem(SELECTED_MODEL_KEY);
    return legacy === "gpt" ? "gpt-4o-mini" : "gemini-2.5-flash";
  } catch {
    return "gemini-2.5-flash";
  }
}

export function setSelectedModelId(modelId: string): void {
  try {
    localStorage.setItem(SELECTED_MODEL_ID_KEY, modelId.trim());
    const model = modelId.startsWith(CLAUDE_PREFIX) ? "claude" : modelId.startsWith(GPT_PREFIX) ? "gpt" : "gemini";
    setSelectedModel(model);
    window.dispatchEvent(new CustomEvent("newsbrief_settings_changed"));
  } catch {}
}

/** 기업분석 시스템 명령어 기본값 (Gemini 2.5 Flash JSON 양식 준수용) */
export const DEFAULT_COMPANY_ANALYSIS_SYSTEM_INSTRUCTION = `1. "귀하는 자본시장 전문 분석가로서 역할을 수행함. 모든 응답은 제공된 JSON 양식을 엄격히 준수해야 하며, 데이터 외의 부연 설명은 일절 배제함.
2. 문체: 모든 서술형 문장은 농담이나 감정적 표현 없이 전문적인 **문어체(~함, ~임)**로 작성함.
3. 내용: 각 분석 섹션(analysis_sections)의 content는 최소 2문장 이상의 서술형으로 작성하되, 수치적 근거를 포함해야 함.
4. 통화: 한국 기업은 KRW(원), 미국 기업은 USD(달러) 단위를 사용함.
5. 정확성: 반드시 최신 공시 정보와 시장 데이터를 기반으로 분석을 수행함."`;

export function getCompanyAnalysisSystemInstruction(): string {
  try {
    const raw = localStorage.getItem(COMPANY_ANALYSIS_SYSTEM_INSTRUCTION_KEY);
    return typeof raw === "string" && raw.trim() ? raw : DEFAULT_COMPANY_ANALYSIS_SYSTEM_INSTRUCTION;
  } catch {
    return DEFAULT_COMPANY_ANALYSIS_SYSTEM_INSTRUCTION;
  }
}

export function setCompanyAnalysisSystemInstruction(text: string): void {
  try {
    localStorage.setItem(COMPANY_ANALYSIS_SYSTEM_INSTRUCTION_KEY, text);
    window.dispatchEvent(new CustomEvent("newsbrief_settings_changed"));
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
  selectedModel: "gemini" | "gpt" | "claude";
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
    if (key === ARCHIVE_STATE_KEY) window.dispatchEvent(new CustomEvent("newsbrief_meta_changed"));
  } catch {
    // quota exceeded 등
  }
}

export function saveSearchState(state: PersistedSearchState): void {
  try {
    sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("newsbrief_meta_changed"));
  } catch {}
}

export function loadSearchState(): PersistedSearchState | null {
  try {
    const raw = sessionStorage.getItem(SEARCH_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSearchState;
    if (!parsed) return null;
    if (parsed.selectedModel && parsed.selectedModel !== "gemini" && parsed.selectedModel !== "gpt" && parsed.selectedModel !== "claude") return null;
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

export interface PersistedInsightChipState {
  activeTab: "분석" | "아카이빙";
  chips: string[];
  result: unknown;
  selectedArchiveId: string | null;
}

export function saveInsightChipState(state: PersistedInsightChipState): void {
  try {
    sessionStorage.setItem(INSIGHT_CHIP_STATE_KEY, JSON.stringify(state));
  } catch {}
}

export function loadInsightChipState(): PersistedInsightChipState | null {
  try {
    const raw = sessionStorage.getItem(INSIGHT_CHIP_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedInsightChipState;
  } catch {
    return null;
  }
}
