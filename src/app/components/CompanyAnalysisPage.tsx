import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";

const MOCK_KR_COMPANIES = [
  { id: "kr-1", name: "삼성전자", ticker: "005930.KS", market: "KOSPI" },
  { id: "kr-2", name: "SK하이닉스", ticker: "000660.KS", market: "KOSPI" },
  { id: "kr-3", name: "한화", ticker: "000880.KS", market: "KOSPI" },
  { id: "kr-4", name: "한화오션", ticker: "042660.KS", market: "KOSPI" },
  { id: "kr-5", name: "한화시스템", ticker: "272210.KS", market: "KOSPI" },
  { id: "kr-6", name: "한화솔루션", ticker: "009830.KS", market: "KOSPI" },
  { id: "kr-7", name: "한화에어로스페이스", ticker: "012450.KS", market: "KOSPI" },
  { id: "kr-8", name: "한화생명", ticker: "088350.KS", market: "KOSPI" },
  { id: "kr-9", name: "LG에너지솔루션", ticker: "373220.KS", market: "KOSPI" },
  { id: "kr-10", name: "LG전자", ticker: "066570.KS", market: "KOSPI" },
  { id: "kr-11", name: "현대차", ticker: "005380.KS", market: "KOSPI" },
  { id: "kr-12", name: "기아", ticker: "000270.KS", market: "KOSPI" },
  { id: "kr-13", name: "NAVER", ticker: "035420.KS", market: "KOSPI" },
  { id: "kr-14", name: "카카오", ticker: "035720.KS", market: "KOSPI" },
  { id: "kr-15", name: "POSCO홀딩스", ticker: "005490.KS", market: "KOSPI" },
];

const MOCK_US_COMPANIES = [
  { id: "us-1", name: "Apple", ticker: "AAPL", market: "NASDAQ" },
  { id: "us-2", name: "Microsoft", ticker: "MSFT", market: "NASDAQ" },
  { id: "us-3", name: "Google", ticker: "GOOGL", market: "NASDAQ" },
  { id: "us-4", name: "Amazon", ticker: "AMZN", market: "NASDAQ" },
  { id: "us-5", name: "Tesla", ticker: "TSLA", market: "NASDAQ" },
  { id: "us-6", name: "NVIDIA", ticker: "NVDA", market: "NASDAQ" },
  { id: "us-7", name: "Meta", ticker: "META", market: "NASDAQ" },
  { id: "us-8", name: "Netflix", ticker: "NFLX", market: "NASDAQ" },
];

export function CompanyAnalysisPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isInternational, setIsInternational] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const hasSearched = searchQuery.trim().length > 0;

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const pool = isInternational ? MOCK_US_COMPANIES : MOCK_KR_COMPANIES;
    return pool.filter((c) => c.name.toLowerCase().includes(q));
  }, [searchQuery, isInternational]);

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

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {!hasSearched ? (
          <div className="flex-1 min-h-0 flex items-center justify-center py-12">
            <p style={{ fontSize: 14 }} className="text-white/40 text-center">
              기업명을 검색해주세요
            </p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex-1 min-h-0 flex items-center justify-center py-12">
            <p style={{ fontSize: 14 }} className="text-white/40 text-center">
              검색 결과가 없습니다
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {searchResults.map((item) => (
              <div
                key={item.id}
                className="rounded-[10px] border border-white/10 bg-white/5 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="w-full h-[72px] text-left px-4 py-3 flex items-center justify-between gap-2 hover:bg-white/[0.07] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 14, fontWeight: 600 }} className="text-white/95 truncate">
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12 }} className="text-white/40 mt-1">
                      {item.ticker} · {item.market}
                    </div>
                  </div>
                  {expandedId === item.id ? (
                    <ChevronUp size={18} className="text-white/50 shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="text-white/50 shrink-0" />
                  )}
                </button>
                {expandedId === item.id && (
                  <div className="px-4 py-4 border-t border-white/10 bg-white/[0.02]">
                    <div className="rounded-[10px] border border-white/8 bg-white/5 px-4 py-6">
                      <p style={{ fontSize: 13 }} className="text-white/50 text-center">
                        분석 결과 영역 (출력 내용 정의 예정)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
