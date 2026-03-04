import { Outlet, Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { SearchStateProvider, useSearchState } from "../context/SearchStateContext";

function HeaderContent() {
  const location = useLocation();
  const isSettings = location.pathname === "/settings" || location.pathname.startsWith("/settings/");
  const { selectedModel, setSelectedModel } = useSearchState();

  return (
    <header className="flex-shrink-0 z-50 bg-[#0a0a0f]/96 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center justify-between gap-2 px-4 h-[64px]">
        <div className="flex items-center gap-[2px] shrink-0">
          <Link
            to="/"
            className="text-white/90 hover:text-white"
            style={{ fontSize: 15, fontWeight: 500 }}
          >
            Finance News
          </Link>
        </div>
        {!isSettings && (
          <div className="relative max-w-[100px] shrink-0">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as "gemini" | "gpt")}
              className="w-full appearance-none bg-white/5 border border-white/10 rounded-[10px] pl-3 pr-8 py-1.5 text-white text-center text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#618EFF]/50"
              style={{ fontWeight: 500 }}
            >
              <option value="gemini" className="bg-[#12121a] text-white">Gemini</option>
              <option value="gpt" className="bg-[#12121a] text-white">ChatGPT</option>
            </select>
            <ChevronDown
              size={16}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none"
            />
          </div>
        )}
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
              뉴스검색
            </Link>
            <Link
              to="/archive"
              className={`pb-2 text-sm transition-colors ${
                location.pathname === "/archive"
                  ? "text-white font-semibold border-b-2 border-white -mb-[1px]"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              아카이브
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
        <HeaderContent />
        <main className="flex-1 min-h-0 overflow-y-auto">
          <Outlet />
        </main>
      </SearchStateProvider>
    </div>
  );
}
