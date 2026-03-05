import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getSelectedModel, SELECTED_MODEL_CHANGED_EVENT } from "../utils/persistState";
import type { MarketSummaryData } from "../data/marketSummary";
import type { RawRssArticle } from "../utils/fetchRssFeeds";

interface SearchStateContextValue {
  /** 오늘의 뉴스 검색 결과 (RSS+5키워드 필터만, AI 요약 없음) */
  searchArticles: RawRssArticle[];
  setSearchArticles: (a: RawRssArticle[]) => void;
  summaryInternational: MarketSummaryData | null;
  summaryDomestic: MarketSummaryData | null;
  setSummaryInternational: (s: MarketSummaryData | null) => void;
  setSummaryDomestic: (s: MarketSummaryData | null) => void;
  summaryModel: "gemini" | "gpt" | "claude";
  setSummaryModel: (m: "gemini" | "gpt" | "claude") => void;
  selectedModel: "gemini" | "gpt" | "claude";
  setSelectedModel: (m: "gemini" | "gpt" | "claude") => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  loadStep: number;
  setLoadStep: (v: number) => void;
  loadStepDetail: string | null;
  setLoadStepDetail: (v: string | null) => void;
  loadProgress: number;
  setLoadProgress: (v: number | ((p: number) => number)) => void;
  fetchError: string | null;
  setFetchError: (v: string | null) => void;
  fetchInfo: string | null;
  setFetchInfo: (v: string | null) => void;
}

const SearchStateContext = createContext<SearchStateContextValue | null>(null);

export function SearchStateProvider({ children }: { children: ReactNode }) {
  const [searchArticles, setSearchArticles] = useState<RawRssArticle[]>([]);
  const [summaryInternational, setSummaryInternational] = useState<MarketSummaryData | null>(null);
  const [summaryDomestic, setSummaryDomestic] = useState<MarketSummaryData | null>(null);
  const [summaryModel, setSummaryModel] = useState<"gemini" | "gpt" | "claude">("gemini");
  const [selectedModel, setSelectedModel] = useState<"gemini" | "gpt" | "claude">(() => getSelectedModel());

  useEffect(() => {
    const handler = () => setSelectedModel(getSelectedModel());
    window.addEventListener(SELECTED_MODEL_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SELECTED_MODEL_CHANGED_EVENT, handler);
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [loadStepDetail, setLoadStepDetail] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchInfo, setFetchInfo] = useState<string | null>(null);

  const value: SearchStateContextValue = {
    searchArticles,
    setSearchArticles,
    summaryInternational,
    summaryDomestic,
    setSummaryInternational,
    setSummaryDomestic,
    summaryModel,
    setSummaryModel,
    selectedModel,
    setSelectedModel,
    isLoading,
    setIsLoading,
    loadStep,
    setLoadStep,
    loadStepDetail,
    setLoadStepDetail,
    loadProgress,
    setLoadProgress,
    fetchError,
    setFetchError,
    fetchInfo,
    setFetchInfo,
  };

  return <SearchStateContext.Provider value={value}>{children}</SearchStateContext.Provider>;
}

export function useSearchState() {
  const ctx = useContext(SearchStateContext);
  if (!ctx) throw new Error("useSearchState must be used within SearchStateProvider");
  return ctx;
}
