import { useState, useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, Sparkles, Cpu, Trash2, Download, HardDrive, Cloud, RefreshCw, Search, Plus, X, ChevronDown } from "lucide-react";
import { useArchive } from "../context/ArchiveContext";
import { useWatchlist } from "../context/WatchlistContext";
import { domesticSources, internationalSources } from "../data/newsSources";
import { saveToLocalStorage, uploadToGoogleDrive } from "../utils/exportArchives";
import { searchStocks, type StockSearchResult } from "../utils/stockSearch";
import { fetchViaCorsProxy } from "../utils/corsProxy";

const BackLink = () => (
  <Link
    to="/"
    className="inline-flex items-center gap-2 text-white/70 hover:text-white/90 mb-6"
    style={{ fontSize: 14 }}
  >
    ← 돌아가기
  </Link>
);

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
const RECENT_RANGE_KEY = "newsbrief_recent_range";

const RSS_CHECK_TIMEOUT_MS = 10000;

async function checkRssFeed(url: string): Promise<boolean> {
  const { ok, text } = await fetchViaCorsProxy(url, { timeoutMs: RSS_CHECK_TIMEOUT_MS });
  if (!ok) return false;
  return text.includes("<rss") || text.includes("<feed") || text.includes("<?xml");
}

async function checkGeminiApi(): Promise<{ ok: boolean; message?: string }> {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key || typeof key !== "string") {
    return { ok: false, message: "API 키가 설정되지 않았습니다. (.env에 VITE_GEMINI_API_KEY 추가)" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) return { ok: true };
    const err = await res.json().catch(() => ({}));
    return {
      ok: false,
      message: err.error?.message || `HTTP ${res.status}`,
    };
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : "연결 실패";
    return { ok: false, message: msg };
  }
}

async function checkClaudeApi(): Promise<{ ok: boolean; message?: string }> {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!key || typeof key !== "string") {
    return { ok: false, message: "API 키가 설정되지 않았습니다. (.env에 VITE_ANTHROPIC_API_KEY 추가)" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) return { ok: true };
    const err = await res.json().catch(() => ({}));
    return {
      ok: false,
      message: err.error?.message || err.message || `HTTP ${res.status}`,
    };
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : "연결 실패";
    return { ok: false, message: msg };
  }
}

async function checkConnectionStatus(
  sources: { id: string; rssUrl: string }[]
): Promise<{ sourceStatus: Record<string, "ok" | "error">; aiStatus: { claude: "ok" | "error"; gemini: "ok" | "error"; errorMessage: string } }> {
  const [sourceResults, geminiResult, claudeResult] = await Promise.all([
    Promise.all(
      sources.map(async (s) => {
        const ok = await checkRssFeed(s.rssUrl);
        return [s.id, ok ? "ok" as const : "error" as const] as const;
      })
    ),
    checkGeminiApi(),
    checkClaudeApi(),
  ]);

  const sourceStatus = Object.fromEntries(sourceResults);
  const errors: string[] = [];
  if (!geminiResult.ok) errors.push(`Gemini: ${geminiResult.message}`);
  if (!claudeResult.ok) errors.push(`Claude: ${claudeResult.message}`);
  if (errors.length === 0) errors.push("모든 API 연결 정상");

  return {
    sourceStatus,
    aiStatus: {
      claude: claudeResult.ok ? "ok" : "error",
      gemini: geminiResult.ok ? "ok" : "error",
      errorMessage: errors.join(" / "),
    },
  };
}

export function SettingsPage() {
  const { sessions, clearAllSessions } = useArchive();
  const { items: watchlistItems, addItem: addWatchlist, removeItem: removeWatchlist, hasItem: hasWatchlist } = useWatchlist();
  const [watchlistQuery, setWatchlistQuery] = useState("");
  const [watchlistResults, setWatchlistResults] = useState<StockSearchResult[]>([]);
  const [watchlistSearching, setWatchlistSearching] = useState(false);
  const [rangeExpanded, setRangeExpanded] = useState(false);
  const [watchlistExpanded, setWatchlistExpanded] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ type: string; ok: boolean; message: string } | null>(null);
  const [sourceStatus, setSourceStatus] = useState<Record<string, "ok" | "error">>(() => {
    const ids = [
      ...domesticSources.map((s) => s.id),
      ...internationalSources.map((s) => s.id),
    ];
    return Object.fromEntries(ids.map((id) => [id, "ok" as const]));
  });
  const [aiStatus, setAiStatus] = useState({
    claude: "error" as "ok" | "error",
    gemini: "ok" as "ok" | "error",
    errorMessage: "API 키가 유효하지 않거나 할당량이 초과되었습니다.",
  });
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);
  const [recentRange, setRecentRange] = useState<string>(() => {
    try {
      return localStorage.getItem(RECENT_RANGE_KEY) || "24h";
    } catch {
      return "24h";
    }
  });

  const handleSetRecentRange = (value: string) => {
    setRecentRange(value);
    try {
      localStorage.setItem(RECENT_RANGE_KEY, value);
    } catch {}
  };

  const allSources = useMemo(
    () => [...domesticSources, ...internationalSources],
    []
  );

  const runCheck = useCallback(async () => {
    setIsChecking(true);
    try {
      const { sourceStatus: s, aiStatus: a } = await checkConnectionStatus(allSources);
      setSourceStatus(s);
      setAiStatus(a);
      setLastCheckTime(Date.now());
    } finally {
      setIsChecking(false);
    }
  }, [allSources]);

  const handleRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastCheckTime < REFRESH_COOLDOWN_MS && lastCheckTime > 0) {
      const remain = Math.ceil((REFRESH_COOLDOWN_MS - (now - lastCheckTime)) / 60000);
      alert(`새로고침은 5분에 한 번만 가능합니다. (${remain}분 후)`);
      return;
    }
    runCheck();
  }, [lastCheckTime, runCheck]);

  // 진입 시 1회 + 6시간마다 자동 체크
  useEffect(() => {
    runCheck();
    const interval = setInterval(runCheck, SIX_HOURS_MS);
    return () => clearInterval(interval);
  }, [runCheck]);

  // 관심종목 검색 (디바운스)
  useEffect(() => {
    if (watchlistQuery.trim().length < 2) {
      setWatchlistResults([]);
      return;
    }
    const tid = setTimeout(async () => {
      setWatchlistSearching(true);
      const results = await searchStocks(watchlistQuery);
      setWatchlistResults(results);
      setWatchlistSearching(false);
    }, 400);
    return () => clearTimeout(tid);
  }, [watchlistQuery]);

  const handleClearAllClick = () => {
    setDeleteConfirm(true);
  };

  const handleClearAllConfirm = () => {
    clearAllSessions();
    setDeleteConfirm(false);
  };

  const handleClearAllCancel = () => {
    setDeleteConfirm(false);
  };

  const handleExportToStorage = async () => {
    const data = JSON.stringify(sessions, null, 2);
    const filename = `newsbrief-archives-${new Date().toISOString().slice(0, 10)}.json`;
    const result = await saveToLocalStorage(data, filename);
    setShowExportMenu(false);
    setExportStatus({
      type: "storage",
      ok: result.ok,
      message: result.ok ? "내부저장소에 저장되었습니다." : (result.error || "저장 실패"),
    });
    setTimeout(() => setExportStatus(null), 4000);
  };

  const handleExportToGoogleDrive = async () => {
    const data = JSON.stringify(sessions, null, 2);
    const filename = `newsbrief-archives-${new Date().toISOString().slice(0, 10)}.json`;
    const result = await uploadToGoogleDrive(data, filename);
    setShowExportMenu(false);
    setExportStatus({
      type: "gdrive",
      ok: result.ok,
      message: result.ok
        ? "구글 드라이브에 저장되었습니다."
        : (result.error || "업로드 실패"),
    });
    setTimeout(() => setExportStatus(null), 4000);
  };

  return (
    <div className="flex flex-col min-h-full px-4 pt-6 pb-8">
      {exportStatus && (
        <div
          className={`fixed bottom-6 left-4 right-4 max-w-[430px] mx-auto px-4 py-3 rounded-[10px] z-[110] ${
            exportStatus.ok
              ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
              : "bg-red-500/20 border border-red-500/40 text-red-300"
          }`}
          style={{ fontSize: 14 }}
          role="status"
        >
          {exportStatus.message}
        </div>
      )}
      {deleteConfirm && (
        <>
          <div
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm"
            onClick={handleClearAllCancel}
            aria-hidden
          />
          <div className="fixed inset-0 z-[111] flex items-center justify-center p-4">
            <div
              className="w-full max-w-[340px] rounded-[10px] border border-white/10 bg-[#12121a] shadow-xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-white mb-1" style={{ fontSize: 16, fontWeight: 600 }}>
                전체 삭제
              </p>
              <p className="text-white/60 mb-5" style={{ fontSize: 14, lineHeight: 1.5 }}>
                저장된 아카이브를 모두 삭제하시겠습니까?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearAllCancel}
                  className="flex-1 py-2.5 rounded-[10px] border border-white/10 bg-white/5 text-white/80 hover:bg-white/8 transition-colors"
                  style={{ fontSize: 14, fontWeight: 500 }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleClearAllConfirm}
                  className="flex-1 py-2.5 rounded-[10px] border border-red-500/50 bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  style={{ fontSize: 14, fontWeight: 500 }}
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      <BackLink />

      {/* 기사 검색 기간 */}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <button
            type="button"
            onClick={() => setRangeExpanded((v) => !v)}
            className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors text-left px-4"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            기사 검색 기간
            <ChevronDown
              size={16}
              className={`text-white/60 transition-transform shrink-0 ${rangeExpanded ? "rotate-180" : ""}`}
            />
          </button>
          {rangeExpanded && (
          <div className="px-4 pb-4 pt-4 flex flex-wrap gap-2 border-t border-white/6">
          {[
            { value: "24h", label: "24시간 이내" },
            { value: "6h", label: "6시간 이내" },
            { value: "3h", label: "3시간 이내" },
            { value: "1h", label: "1시간 이내" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSetRecentRange(opt.value)}
              className={`rounded-[8px] border px-3 py-2 transition-colors ${
                recentRange === opt.value
                  ? "bg-[#618EFF]/30 border-[#618EFF]/50 text-[#618EFF]"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/8"
              }`}
              style={{ fontSize: 14 }}
            >
              {opt.label}
            </button>
          ))}
          </div>
          )}
        </div>
      </section>

      {/* 관심종목 */}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <button
            type="button"
            onClick={() => setWatchlistExpanded((v) => !v)}
            className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors text-left px-4"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            관심종목
            <ChevronDown
              size={16}
              className={`text-white/60 transition-transform shrink-0 ${watchlistExpanded ? "rotate-180" : ""}`}
            />
          </button>
          {watchlistExpanded && (
          <div className="px-4 pb-4 pt-4 border-t border-white/6">
          <div className="relative mb-3">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
          />
          <input
            type="text"
            value={watchlistQuery}
            onChange={(e) => setWatchlistQuery(e.target.value)}
            placeholder="종목명 또는 티커 검색 (2글자 이상)"
            className="w-full pl-10 pr-4 py-3 rounded-[10px] bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[#618EFF]/50"
            style={{ fontSize: 14 }}
          />
          {watchlistQuery && (
            <button
              type="button"
              onClick={() => { setWatchlistQuery(""); setWatchlistResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
            >
              <X size={16} />
            </button>
          )}
          {watchlistQuery.trim().length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 max-h-[240px] overflow-y-auto rounded-[10px] border border-white/10 bg-[#12121a] shadow-xl z-20">
              {watchlistSearching ? (
                <div className="px-4 py-6 text-center text-white/50" style={{ fontSize: 13 }}>
                  검색 중…
                </div>
              ) : watchlistResults.length === 0 ? (
                <div className="px-4 py-6 text-center text-white/50" style={{ fontSize: 13 }}>
                  검색 결과 없음
                </div>
              ) : (
                <div className="divide-y divide-white/6">
                  {watchlistResults.map((s) => (
                    <div
                      key={s.symbol}
                      className="flex items-center justify-between px-4 py-3 hover:bg-white/5"
                    >
                      <div>
                        <span style={{ fontSize: 14 }} className="text-white/90">{s.name}</span>
                        <span style={{ fontSize: 12 }} className="ml-2 text-white/40">
                          {s.symbol} {s.isDomestic ? "국내" : "해외"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!hasWatchlist(s.symbol)) addWatchlist(s);
                          setWatchlistQuery("");
                          setWatchlistResults([]);
                        }}
                        disabled={hasWatchlist(s.symbol)}
                        className={`flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 transition-colors ${
                          hasWatchlist(s.symbol)
                            ? "bg-white/5 text-white/40 cursor-default"
                            : "bg-[#618EFF]/30 border border-[#618EFF]/50 text-[#618EFF] hover:bg-[#618EFF]/50"
                        }`}
                        style={{ fontSize: 12 }}
                      >
                        <Plus size={14} />
                        {hasWatchlist(s.symbol) ? "추가됨" : "추가"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {watchlistItems.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {watchlistItems.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => removeWatchlist(item.symbol)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/90 hover:bg-white/8 hover:border-white/15 transition-colors"
                style={{ fontSize: 13 }}
              >
                <span>{item.name}</span>
                <X size={14} className="text-white/50 hover:text-red-400 shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13 }} className="text-white/40">
            검색하여 종목을 추가하세요. (국내·해외 지원)
          </p>
        )}
          </div>
          )}
        </div>
      </section>

      {/* 언론사 연결상태 */}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <div className="flex items-center justify-between px-4 h-[72px]">
            <button
              type="button"
              onClick={() => setSourcesExpanded((v) => !v)}
              className="flex items-center gap-2 text-white hover:opacity-90 transition-opacity text-left flex-1 min-w-0"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              언론사 연결상태
              <ChevronDown
                size={16}
                className={`text-white/60 transition-transform shrink-0 ${sourcesExpanded ? "rotate-180" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isChecking}
              className="flex items-center gap-1.5 rounded-[6px] border border-white/10 bg-white/5 px-2.5 py-1.5 text-white/60 hover:text-white/80 hover:bg-white/8 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              style={{ fontSize: 12 }}
            >
              <RefreshCw size={14} className={isChecking ? "animate-spin" : ""} />
              새로고침
            </button>
          </div>
          {sourcesExpanded && (
          <div className="border-t border-white/6 divide-y divide-white/6 px-4 pb-4 pt-4">
            {allSources.map((s) => {
              const status = sourceStatus[s.id] ?? "ok";
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <span style={{ fontSize: 14 }} className="text-white/90">
                    {s.name}
                  </span>
                  <span
                    className={`flex items-center gap-1.5 ${
                      status === "ok" ? "text-emerald-400" : "text-red-400"
                    }`}
                    style={{ fontSize: 13 }}
                  >
                    {status === "ok" ? (
                      <>
                        <CheckCircle2 size={14} />
                        정상
                      </>
                    ) : (
                      <>
                        <XCircle size={14} />
                        오류
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          )}
        </div>
      </section>

      {/* AI API 연결상태 */}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <div className="flex items-center justify-between px-4 h-[72px]">
            <button
              type="button"
              onClick={() => setAiExpanded((v) => !v)}
              className="flex items-center gap-2 text-white hover:opacity-90 transition-opacity text-left flex-1 min-w-0"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              AI API 연결상태
              <ChevronDown
                size={16}
                className={`text-white/60 transition-transform shrink-0 ${aiExpanded ? "rotate-180" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isChecking}
              className="flex items-center gap-1.5 rounded-[6px] border border-white/10 bg-white/5 px-2.5 py-1.5 text-white/60 hover:text-white/80 hover:bg-white/8 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              style={{ fontSize: 12 }}
            >
              <RefreshCw size={14} className={isChecking ? "animate-spin" : ""} />
              새로고침
            </button>
          </div>
          {aiExpanded && (
          <div className="border-t border-white/6 divide-y divide-white/6 px-4 pb-4 pt-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-orange-300" />
              <span style={{ fontSize: 14 }} className="text-white/90">
                Claude
              </span>
            </div>
            <span className={`flex items-center gap-1.5 ${aiStatus.claude === "ok" ? "text-emerald-400" : "text-red-400"}`} style={{ fontSize: 13 }}>
              {aiStatus.claude === "ok" ? (
                <>
                  <CheckCircle2 size={14} />
                  연결
                </>
              ) : (
                <>
                  <XCircle size={14} />
                  오류
                </>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-sky-300" />
              <span style={{ fontSize: 14 }} className="text-white/90">
                Gemini
              </span>
            </div>
            <span className={`flex items-center gap-1.5 ${aiStatus.gemini === "ok" ? "text-emerald-400" : "text-red-400"}`} style={{ fontSize: 13 }}>
              {aiStatus.gemini === "ok" ? (
                <>
                  <CheckCircle2 size={14} />
                  연결
                </>
              ) : (
                <>
                  <XCircle size={14} />
                  오류
                </>
              )}
            </span>
          </div>
          <div className="pt-2">
            <div style={{ fontSize: 12 }} className="text-white/40 mb-1">
              {aiStatus.claude === "ok" && aiStatus.gemini === "ok" ? "상태" : "오류내용"} :
            </div>
            <div
              className="rounded-[8px] bg-white/5 border border-white/8 px-3 py-2"
              style={{ fontSize: 13, lineHeight: 1.5 }}
            >
              <span className={aiStatus.claude === "ok" && aiStatus.gemini === "ok" ? "text-emerald-400/90" : "text-red-400/90"}>
                {aiStatus.errorMessage}
              </span>
            </div>
          </div>
          </div>
          )}
        </div>
      </section>

      {/* 저장된 아카이브 */}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <button
            type="button"
            onClick={() => setArchiveExpanded((v) => !v)}
            className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors text-left px-4"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            저장된 아카이브
            <ChevronDown
              size={16}
              className={`text-white/60 transition-transform shrink-0 ${archiveExpanded ? "rotate-180" : ""}`}
            />
          </button>
          {archiveExpanded && (
          <div className="px-4 pb-4 pt-4 border-t border-white/6 space-y-2">
          <button
            type="button"
            onClick={handleClearAllClick}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-white/10 bg-white/5 text-white/70 hover:bg-white/8 transition-colors"
            style={{ fontSize: 14 }}
          >
            <Trash2 size={16} />
            전체삭제
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu((v) => !v)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-white/10 bg-white/5 text-white/70 hover:bg-white/8 transition-colors"
              style={{ fontSize: 14 }}
            >
              <Download size={16} />
              내보내기
            </button>
            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-[100]"
                  onClick={() => setShowExportMenu(false)}
                  aria-hidden
                />
                <div className="fixed bottom-24 left-4 right-4 max-w-[430px] mx-auto rounded-[10px] border border-white/10 bg-[#12121a] shadow-xl z-[101] overflow-hidden">
                  <button
                    type="button"
                    onClick={handleExportToStorage}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left"
                    style={{ fontSize: 14 }}
                  >
                    <HardDrive size={18} className="text-white/60" />
                    <span className="text-white/90">내부저장소에 저장</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportToGoogleDrive}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left border-t border-white/6"
                    style={{ fontSize: 14 }}
                  >
                    <Cloud size={18} className="text-white/60" />
                    <span className="text-white/90">구글드라이브에 내보내기</span>
                  </button>
                </div>
              </>
            )}
          </div>
          <Link
            to="/archive"
            className="block mt-2 text-[#618EFF] hover:text-[#8BABFF]"
            style={{ fontSize: 13 }}
          >
            아카이브에서 보기 →
          </Link>
          {sessions.length > 0 && (
            <p style={{ fontSize: 12 }} className="text-white/35 mt-1">
              저장된 아카이브 {sessions.length}건
            </p>
          )}
          </div>
          )}
        </div>
      </section>
    </div>
  );
}
