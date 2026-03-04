import { Outlet, Link, useLocation } from "react-router-dom";
import { Settings } from "lucide-react";

export function Layout() {
  const location = useLocation();
  const isSettings = location.pathname === "/settings";

  return (
    <div className="h-screen flex flex-col max-w-[430px] mx-auto bg-[#0a0a0f] text-white overflow-hidden">
      <header className="flex-shrink-0 z-50 bg-[#0a0a0f]/96 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/"
            className="text-white/90 hover:text-white shrink-0"
            style={{ fontSize: 15, fontWeight: 500 }}
          >
            Daily News Brief
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-2 rounded-[10px] bg-white/5 border border-white/10 px-2.5 py-1.5 hover:bg-white/10 transition-colors shrink-0"
            style={{ fontSize: 14 }}
          >
            <Settings size={16} className="text-white/70" />
            <span className="text-white/80">설정</span>
          </Link>
        </div>
        {!isSettings && (
          <nav className="flex mx-4 mb-3 h-12 rounded-[10px] bg-white/5 border border-white/10 overflow-hidden">
            <Link
              to="/"
              className={`flex-1 flex items-center justify-center h-full text-center text-sm transition-colors ${
                location.pathname === "/" || location.pathname === ""
                  ? "bg-[#618EFF] text-white"
                  : "text-white/70 hover:text-white"
              }`}
            >
              뉴스검색
            </Link>
            <Link
              to="/archive"
              className={`flex-1 flex items-center justify-center h-full text-center text-sm transition-colors ${
                location.pathname === "/archive"
                  ? "bg-[#618EFF] text-white"
                  : "text-white/70 hover:text-white"
              }`}
            >
              아카이브
            </Link>
          </nav>
        )}
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
