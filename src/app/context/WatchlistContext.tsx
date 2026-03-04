import { createContext, useContext, useCallback, useState, useEffect } from "react";
import type { StockSearchResult } from "../utils/stockSearch";

const STORAGE_KEY = "newsbrief_watchlist";

export interface WatchlistItem extends StockSearchResult {
  addedAt: string; // ISO8601
}

interface WatchlistContextValue {
  items: WatchlistItem[];
  addItem: (stock: StockSearchResult) => void;
  removeItem: (symbol: string) => void;
  hasItem: (symbol: string) => boolean;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { symbol: "005930.KS", name: "삼성전자", exchange: "KSC", type: "EQUITY", isDomestic: true, addedAt: new Date().toISOString() },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", exchange: "PCX", type: "ETF", isDomestic: false, addedAt: new Date().toISOString() },
  { symbol: "TSLA", name: "Tesla, Inc.", exchange: "NMS", type: "EQUITY", isDomestic: false, addedAt: new Date().toISOString() },
];

function loadFromStorage(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WATCHLIST;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_WATCHLIST;
  } catch {
    return DEFAULT_WATCHLIST;
  }
}

function saveToStorage(items: WatchlistItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WatchlistItem[]>(loadFromStorage);

  useEffect(() => {
    saveToStorage(items);
  }, [items]);

  const addItem = useCallback((stock: StockSearchResult) => {
    setItems((prev) => {
      if (prev.some((i) => i.symbol === stock.symbol)) return prev;
      return [
        ...prev,
        { ...stock, addedAt: new Date().toISOString() },
      ];
    });
  }, []);

  const removeItem = useCallback((symbol: string) => {
    setItems((prev) => prev.filter((i) => i.symbol !== symbol));
  }, []);

  const hasItem = useCallback(
    (symbol: string) => items.some((i) => i.symbol === symbol),
    [items]
  );

  return (
    <WatchlistContext.Provider value={{ items, addItem, removeItem, hasItem }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist must be used within WatchlistProvider");
  return ctx;
}
