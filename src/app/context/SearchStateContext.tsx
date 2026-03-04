import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getSelectedModel, SELECTED_MODEL_CHANGED_EVENT } from "../utils/persistState";
import type { MarketSummaryData } from "../data/marketSummary";

interface SearchStateContextValue {
  summaryInternational: MarketSummaryData | null;
  summaryDomestic: MarketSummaryData | null;
  setSummaryInternational: (s: MarketSummaryData | null) => void;
  setSummaryDomestic: (s: MarketSummaryData | null) => void;
  summaryModel: "gemini" | "gpt";
  setSummaryModel: (m: "gemini" | "gpt") => void;
  selectedModel: "gemini" | "gpt";
  setSelectedModel: (m: "gemini" | "gpt") => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  loadStep: number;
  setLoadStep: (v: number) => void;
  loadProgress: number;
  setLoadProgress: (v: number | ((p: number) => number)) => void;
  fetchError: string | null;
  setFetchError: (v: string | null) => void;
  fetchInfo: string | null;
  setFetchInfo: (v: string | null) => void;
}

const SearchStateContext = createContext<SearchStateContextValue | null>(null);

export function SearchStateProvider({ children }: { children: ReactNode }) {
  const [summaryInternational, setSummaryInternational] = useState<MarketSummaryData | null>(null);
  const [summaryDomestic, setSummaryDomestic] = useState<MarketSummaryData | null>(null);
  const [summaryModel, setSummaryModel] = useState<"gemini" | "gpt">("gemini");
  const [selectedModel, setSelectedModel] = useState<"gemini" | "gpt">(() => getSelectedModel());

  useEffect(() => {
    const handler = () => setSelectedModel(getSelectedModel());
    window.addEventListener(SELECTED_MODEL_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SELECTED_MODEL_CHANGED_EVENT, handler);
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchInfo, setFetchInfo] = useState<string | null>(null);

  const value: SearchStateContextValue = {
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
