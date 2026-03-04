import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, X } from "lucide-react";
import { useWatchlist } from "../context/WatchlistContext";
import { searchStocks, type StockSearchResult } from "../utils/stockSearch";

export function WatchlistSearchPage() {
  const { addItem: addWatchlist, hasItem: hasWatchlist } = useWatchlist();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const tid = setTimeout(async () => {
      setSearching(true);
      const res = await searchStocks(query);
      setResults(res);
      setSearching(false);
    }, 400);
    return () => clearTimeout(tid);
  }, [query]);

  const handleAdd = useCallback(
    (item: StockSearchResult) => {
      if (!hasWatchlist(item.symbol)) addWatchlist(item);
    },
    [addWatchlist, hasWatchlist]
  );

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-shrink-0 px-4 py-4 border-b border-white/8">
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 text-white/70 hover:text-white/90 mb-4"
          style={{ fontSize: 14 }}
        >
          ← 설정으로 돌아가기
        </Link>
        <h1 className="text-white font-semibold mb-4" style={{ fontSize: 18 }}>
          관심종목 검색
        </h1>
        <div className="relative">
          <Search
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="종목명 또는 티커 검색 (2글자 이상)"
            className="w-full pl-12 pr-12 py-4 rounded-[12px] bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[#618EFF]/50"
            style={{ fontSize: 16 }}
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <p className="text-white/40 mt-2" style={{ fontSize: 13 }}>
          국내·해외 종목 모두 검색됩니다. (Finnhub API)
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {query.trim().length < 2 ? (
          <div className="py-16 text-center">
            <Search size={48} className="mx-auto text-white/20 mb-4" />
            <p className="text-white/50" style={{ fontSize: 15 }}>
              2글자 이상 입력하면 검색됩니다
            </p>
          </div>
        ) : searching ? (
          <div className="py-16 text-center">
            <div className="animate-spin w-10 h-10 border-2 border-[#618EFF]/50 border-t-[#618EFF] rounded-full mx-auto mb-4" />
            <p className="text-white/50" style={{ fontSize: 15 }}>
              검색 중…
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-white/50" style={{ fontSize: 15 }}>
              검색 결과 없음
            </p>
            <p className="text-white/35 mt-1" style={{ fontSize: 13 }}>
              다른 검색어로 시도해보세요
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((s) => (
              <div
                key={s.symbol}
                className="flex items-center justify-between gap-3 py-4 px-4 rounded-[12px] bg-white/5 border border-white/8 hover:bg-white/8 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div style={{ fontSize: 15, fontWeight: 500 }} className="text-white truncate">
                    {s.name}
                  </div>
                  <div style={{ fontSize: 13 }} className="text-white/40 mt-0.5">
                    {s.symbol} · {s.isDomestic ? "국내" : "해외"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdd(s)}
                  disabled={hasWatchlist(s.symbol)}
                  className={`flex items-center gap-2 rounded-[10px] px-4 py-2.5 transition-colors shrink-0 ${
                    hasWatchlist(s.symbol)
                      ? "bg-white/5 text-white/40 cursor-default"
                      : "bg-[#618EFF]/30 border border-[#618EFF]/50 text-[#618EFF] hover:bg-[#618EFF]/50"
                  }`}
                  style={{ fontSize: 14, fontWeight: 500 }}
                >
                  <Plus size={18} />
                  {hasWatchlist(s.symbol) ? "추가됨" : "추가"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
