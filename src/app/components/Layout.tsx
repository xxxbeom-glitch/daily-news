import { Outlet, Link, useLocation } from "react-router-dom";
import { SearchStateProvider } from "../context/SearchStateContext";
import { KeywordNewsProvider } from "../context/KeywordNewsContext";
import { MarketScheduleProvider } from "../context/MarketScheduleContext";

function formatHeaderDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}. ${m}. ${day}`;
}

function HeaderContent() {
  const location = useLocation();

  return (
    <header className="flex-shrink-0 z-50 bg-[#0a0a0f]/96 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 px-4 h-[64px]">
        <Link
          to="/"
          className="text-white/90 hover:text-white shrink-0"
          style={{ fontSize: 15, fontWeight: 500 }}
        >
          Finance News
        </Link>
        <span className="text-white/60 shrink-0" style={{ fontSize: 13, fontWeight: 400 }}>
          {formatHeaderDate()}
        </span>
      </div>
      <nav className="flex items-end gap-6 mx-4 mb-3 pb-1 border-b border-white/10">
            <Link
              to="/market"
              className={`pb-2 text-sm transition-colors ${
                location.pathname === "/market"
                  ? "text-white font-semibold border-b-2 border-white -mb-[2px] pb-1"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              오늘의 시장
            </Link>
            <Link
              to="/"
              className={`pb-2 text-sm transition-colors ${
                location.pathname === "/" || location.pathname === ""
                  ? "text-white font-semibold border-b-2 border-white -mb-[2px] pb-1"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              리포트
            </Link>
            <Link
              to="/test2"
              className={`pb-2 text-sm transition-colors ${
                location.pathname === "/test2"
                  ? "text-white font-semibold border-b-2 border-white -mb-[2px] pb-1"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              업로드
            </Link>
            <Link
              to="/settings"
              className={`pb-2 text-sm transition-colors ${
                location.pathname === "/settings" || location.pathname.startsWith("/settings/")
                  ? "text-white font-semibold border-b-2 border-white -mb-[2px] pb-1"
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
          <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <Outlet />
          </main>
          </KeywordNewsProvider>
        </MarketScheduleProvider>
      </SearchStateProvider>
    </div>
  );
}
