import { Outlet, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { SearchStateProvider } from "../context/SearchStateContext";
import { useAdminSettings } from "../context/AdminSettingsContext";
import { KeywordNewsProvider } from "../context/KeywordNewsContext";
import { MarketScheduleProvider } from "../context/MarketScheduleContext";
import { fetchHeaderTickerIndices } from "../utils/fetchMarketData";
import type { IndexData } from "../data/marketSummary";

const TICKER_CACHE_KEY = "header_ticker_indices";

const US_INDICES = new Set(["S&P500", "나스닥", "다우존스", "금", "은"]);
const KR_INDICES = new Set(["코스피", "코스닥"]);

function HeaderTicker({ indices }: { indices: IndexData[] }) {
  if (indices.length === 0) return null;
  const getFlag = (name: string) => (US_INDICES.has(name) ? "🇺🇸" : KR_INDICES.has(name) ? "🇰🇷" : "");
  const renderItem = (i: IndexData) => {
    const flag = getFlag(i.name);
    return (
      <span className="inline-flex items-center" style={{ gap: 3 }}>
        {flag && <span style={{ fontSize: 12 }}>{flag}</span>}
        <span className="text-white font-semibold" style={{ fontSize: 12 }}>{i.name}</span>
        <span
          style={{
            fontSize: 12,
            color: i.isUp ? "#618EFF" : "#FF6B6B",
          }}
        >
          {i.value} ({i.change})
        </span>
      </span>
    );
  };
  const block = (
    <span className="inline-flex items-center">
      {indices.map((i, idx) => (
        <span key={i.name} className="inline-flex items-center" style={{ marginLeft: idx === 0 ? 0 : 8 }}>
          {renderItem(i)}
        </span>
      ))}
    </span>
  );
  return (
    <div className="flex-1 min-w-0 overflow-hidden" style={{ fontSize: 12 }}>
      <div className="whitespace-nowrap inline-flex" style={{ animation: "ticker 22s linear infinite" }}>
        <span key="1" className="inline-block pr-4">{block}</span>
        <span key="2" className="inline-block pr-4">{block}</span>
      </div>
    </div>
  );
}

function HeaderContent() {
  const location = useLocation();
  const { showNewsTab } = useAdminSettings();
  const isSettings = location.pathname === "/settings" || location.pathname.startsWith("/settings/");
  const [tickerIndices, setTickerIndices] = useState<IndexData[]>(() => {
    try {
      const cached = sessionStorage.getItem(TICKER_CACHE_KEY);
      if (cached) return JSON.parse(cached) as IndexData[];
    } catch {
      /* ignore */
    }
    return [];
  });

  useEffect(() => {
    if (isSettings) return;
    fetchHeaderTickerIndices().then((data) => {
      setTickerIndices(data);
      try {
        sessionStorage.setItem(TICKER_CACHE_KEY, JSON.stringify(data));
      } catch {
        /* ignore */
      }
    });
  }, [isSettings]);

  return (
    <header className="flex-shrink-0 z-50 bg-[#0a0a0f]/96 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center justify-between gap-3 px-4 h-[64px]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            to="/"
            className="text-white/90 hover:text-white shrink-0"
            style={{ fontSize: 15, fontWeight: 500 }}
          >
            Finance News
          </Link>
          <HeaderTicker indices={tickerIndices} />
        </div>
      </div>
      <nav className="flex items-end gap-6 mx-4 mb-3 pb-1 border-b border-white/10">
            <Link
              to="/"
              className={`pb-2 text-sm transition-colors ${
                location.pathname === "/" || location.pathname === ""
                  ? "text-white font-semibold border-b-2 border-white -mb-[1px]"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              모닝뉴스
            </Link>
            <Link
              to="/market"
              className={`pb-2 text-sm transition-colors ${
                location.pathname === "/market"
                  ? "text-white font-semibold border-b-2 border-white -mb-[1px]"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              오늘의 시장
            </Link>
            {showNewsTab && (
              <Link
                to="/search"
                className={`pb-2 text-sm transition-colors ${
                  location.pathname === "/search"
                    ? "text-white font-semibold border-b-2 border-white -mb-[1px]"
                    : "text-white/50 hover:text-white/70"
                }`}
              >
                오늘의 뉴스
              </Link>
            )}
            <Link
              to="/test"
              className={`pb-2 text-sm transition-colors ${
                location.pathname === "/test"
                  ? "text-white font-semibold border-b-2 border-white -mb-[1px]"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              테스트
            </Link>
            <Link
              to="/test2"
              className={`pb-2 text-sm transition-colors ${
                location.pathname === "/test2"
                  ? "text-white font-semibold border-b-2 border-white -mb-[1px]"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              업로드
            </Link>
            <Link
              to="/settings"
              className={`pb-2 text-sm transition-colors ${
                location.pathname === "/settings" || location.pathname.startsWith("/settings/")
                  ? "text-white font-semibold border-b-2 border-white -mb-[1px]"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              설정
            </Link>
          </nav>
    </header>
  );
}

export function Layout() {
  return (
    <div className="h-screen flex flex-col max-w-[430px] mx-auto bg-[#0a0a0f] text-white overflow-hidden">
      <SearchStateProvider>
        <MarketScheduleProvider>
          <KeywordNewsProvider>
            <HeaderContent />
          <main className="flex-1 min-h-0 overflow-y-auto">
            <Outlet />
          </main>
          </KeywordNewsProvider>
        </MarketScheduleProvider>
      </SearchStateProvider>
    </div>
  );
}
