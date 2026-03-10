import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { searchStocks, type StockSearchResult } from "../utils/stockSearch";

function getMarketLabel(symbol: string, exchange: string): string {
  if (symbol.endsWith(".KS")) return "KOSPI";
  if (symbol.endsWith(".KQ")) return "KOSDAQ";
  return exchange || "NYSE";
}

export function CompanyAnalysisPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isInternational, setIsInternational] = useState(true);
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [selectedItems, setSelectedItems] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const hasSearched = searchQuery.trim().length >= 2;

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const tid = setTimeout(async () => {
      setSearching(true);
      const res = await searchStocks(q, { domesticOnly: !isInternational });
      setSearchResults(res);
      setSearching(false);
    }, 400);
    return () => clearTimeout(tid);
  }, [searchQuery, isInternational]);

  const filteredResults = searchResults.filter((s) =>
    isInternational ? !s.isDomestic : s.isDomestic
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-4 pt-5 pb-6">
      <div className="flex items-stretch gap-2 mb-4 shrink-0">
        <div className="relative flex-1 min-w-0 flex">
          <div className="w-full flex items-center gap-2 px-4 h-10 rounded-[10px] border border-white/10 bg-white/5">
            <Search size={16} className="text-white/40 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="기업 검색"
              className="flex-1 min-w-0 bg-transparent text-white placeholder-white/40 outline-none"
              style={{ fontSize: 12 }}
            />
          </div>
        </div>

        <div className="flex shrink-0 h-10 rounded-[10px] border border-white/10 bg-white/5 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsInternational(false)}
            className={`flex-1 min-w-[52px] h-full flex items-center justify-center transition-colors border-r border-white/10 ${
              !isInternational ? "text-white" : "opacity-40"
            }`}
            style={{ fontSize: 12 }}
          >
            한국
          </button>
          <button
            type="button"
            onClick={() => setIsInternational(true)}
            className={`flex-1 min-w-[52px] h-full flex items-center justify-center transition-colors ${
              isInternational ? "text-white" : "opacity-40"
            }`}
            style={{ fontSize: 12 }}
          >
            미국
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-4">
        {selectedItems.length > 0 && (
          <div className="rounded-[10px] border border-white/10 bg-white/5 overflow-hidden shrink-0">
            <div className="px-4 py-3 border-b border-white/8">
              <span style={{ fontSize: 13, fontWeight: 600 }} className="text-white/80">
                선택한 기업 ({selectedItems.length})
              </span>
            </div>
            <div className="divide-y divide-white/8">
              {selectedItems.map((item) => (
                <div
                  key={item.symbol}
                  className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03]"
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }} className="text-white/95 truncate">
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12 }} className="text-white/40 mt-0.5">
                      {item.symbol} · {getMarketLabel(item.symbol, item.exchange)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedItems((prev) => prev.filter((s) => s.symbol !== item.symbol))}
                    className="p-1.5 rounded-[6px] text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                    title="제거"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasSearched ? (
          <div className="flex-1 min-h-0 flex items-center justify-center py-12">
            <p style={{ fontSize: 14 }} className="text-white/40 text-center">
              2글자 이상 입력해 검색해주세요
            </p>
          </div>
        ) : searching ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-12">
            <div className="animate-spin w-10 h-10 border-2 border-[#618EFF]/50 border-t-[#618EFF] rounded-full mb-4" />
            <p style={{ fontSize: 14 }} className="text-white/40 text-center">
              검색 중…
            </p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="flex-1 min-h-0 flex items-center justify-center py-12">
            <p style={{ fontSize: 14 }} className="text-white/40 text-center">
              검색 결과가 없습니다
            </p>
          </div>
        ) : (
          <div className="rounded-[10px] border border-white/10 bg-white/5 overflow-hidden shadow-sm">
            <div className="max-h-[300px] overflow-y-auto divide-y divide-white/8">
              {filteredResults.map((item) => {
                const isSelected = selectedItems.some((s) => s.symbol === item.symbol);
                return (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => {
                      if (!isSelected) setSelectedItems((prev) => [...prev, item]);
                    }}
                    disabled={isSelected}
                    className="w-full h-[72px] text-left px-4 py-3 flex items-center justify-between gap-2 hover:bg-white/[0.07] transition-colors disabled:opacity-60 disabled:cursor-default"
                  >
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 14, fontWeight: 600 }} className="text-white/95 truncate">
                        {item.name}
                      </div>
                      <div style={{ fontSize: 12 }} className="text-white/40 mt-1">
                        {item.symbol} · {getMarketLabel(item.symbol, item.exchange)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
