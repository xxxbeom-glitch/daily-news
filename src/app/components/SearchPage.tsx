import { useState, useCallback } from "react";
import {
  RefreshCw,
  CheckCheck,
  Sparkles,
  Cpu,
} from "lucide-react";
import type { Article } from "../data/newsSources";
import { domesticSources, internationalSources } from "../data/newsSources";
import type { MarketSummaryData } from "../data/marketSummary";
import { generateMarketSummary } from "../utils/aiSummary";
import { useArchive } from "../context/ArchiveContext";
import { MarketSummaryView } from "./MarketSummaryView";
import {
  fetchRssFeeds,
  filterArticlesByRange,
  getRecentRangeFromSettings,
} from "../utils/fetchRssFeeds";
import { filterHighQualityNews } from "../utils/filterHighQualityNews";
import { useWatchlist } from "../context/WatchlistContext";
import { Link } from "react-router-dom";

const RANGE_LABELS: Record<string, string> = {
  "24h": "24시간 이내",
  "6h": "6시간 이내",
  "3h": "3시간 이내",
  "1h": "1시간 이내",
};

const DEFAULT_DOMESTIC = ["hankyung_all", "hankyung_finance", "mk", "sbs"];
const DEFAULT_INTERNATIONAL = ["yahoofinance", "cnbc_investing", "cnbc_tech", "wsj", "bloomberg"];

const LOAD_STEPS: Record<number, string> = {
  0: "RSS 피드 수집 중…",
  1: "기사 필터링 중…",
  2: "고품질 기사 선별 중…",
  3: "시황 리포트 생성 중…",
};

function getLoadStepLabel(step: number, model: "gemini" | "claude") {
  if (step <= 2) return LOAD_STEPS[step];
  if (step === 3) return (model === "gemini" ? "Gemini AI" : "Claude AI") + " 분석·요약 중…";
  return "시황 리포트 생성 중…";
}

export function SearchPage() {
  const { addSession } = useArchive();
  const { items: watchlistItems } = useWatchlist();
  const [isInternational, setIsInternational] = useState(true);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    () => new Set(DEFAULT_INTERNATIONAL)
  );
  const [selectedModel, setSelectedModel] = useState<"gemini" | "claude">("gemini");
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<MarketSummaryData | null>(null);
  const [loadStep, setLoadStep] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const sources = isInternational ? internationalSources : domesticSources;

  const setRegion = useCallback((international: boolean) => {
    setIsInternational(international);
    setSelectedSources(new Set(international ? DEFAULT_INTERNATIONAL : DEFAULT_DOMESTIC));
    setSummary(null);
    setFetchError(null);
  }, []);

  const toggleSource = useCallback((id: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleFetch = useCallback(async () => {
    if (selectedSources.size === 0) return;
    setIsLoading(true);
    setSummary(null);
    setFetchError(null);
    setLoadStep(0);

    const recentRange = getRecentRangeFromSettings();
    const sourceList = sources.filter((s) => selectedSources.has(s.id));

    try {
      // Step 0: RSS 피드 수집
      const { articles: rawArticles, error: rssError } = await fetchRssFeeds({
        sources: sourceList,
        onProgress: () => setLoadStep(0),
      });

      if (rssError) {
        setFetchError(rssError);
        setIsLoading(false);
        return;
      }

      // Step 1: 기사 검색 기간 내 필터링
      setLoadStep(1);
      await new Promise((r) => setTimeout(r, 300));
      const byRange = filterArticlesByRange(rawArticles, recentRange);

      // Step 2: 고품질 기사 선별 (5가지 규칙)
      setLoadStep(2);
      await new Promise((r) => setTimeout(r, 200));
      const filtered = filterHighQualityNews(byRange, {
        watchlist: watchlistItems.map((w) => ({ symbol: w.symbol, name: w.name })),
      });

      if (filtered.length === 0) {
        setFetchError("검색 기간 내 수집된 기사가 없습니다. 기사 검색 기간을 늘리거나 다른 언론사를 선택해보세요.");
        setIsLoading(false);
        return;
      }

      // Step 3-4: AI 시황 요약 API 호출
      setLoadStep(3);
      const data = await generateMarketSummary({
        articles: filtered.slice(0, 30).map((a) => ({
          title: a.title,
          link: a.link,
          pubDate: a.pubDate,
          sourceId: a.sourceId,
          sourceName: a.sourceName,
          body: a.body,
        })),
        isInternational,
        model: selectedModel,
      });
      setLoadStep(4);
      await new Promise((r) => setTimeout(r, 100));
      setSummary(data);
      setIsLoading(false);

      const now = new Date();
      const title = `${now.getMonth() + 1}월 ${now.getDate()}일 ` +
        (now.getHours() < 12 ? "오전" : "오후") + ` ${String(now.getHours() % 12 || 12).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} · ${data.regionLabel}`;

      const articlesForSession: Article[] = filtered.length > 0
        ? filtered.slice(0, 20).map((a, i) => ({
            id: `rss-${Date.now()}-${i}`,
            title: a.title,
            source: a.sourceName,
            sourceId: a.sourceId,
            publishedAt: new Date(a.pubDate).toISOString(),
            url: a.link,
            summary: "",
            aiModel: selectedModel,
            category: "Economy",
            isInternational,
          }))
        : [{
            id: "m1",
            title: "시황 요약 (검색 기간 내 기사 없음)",
            source: sourceList[0]?.name ?? "Unknown",
            sourceId: sourceList[0]?.id ?? "unknown",
            publishedAt: now.toISOString(),
            url: "https://example.com",
            summary: data.keyIssues[0]?.body ?? "",
            aiModel: selectedModel,
            category: "Economy",
            isInternational,
          }];

      addSession({
        id: `session-${Date.now()}`,
        title,
        createdAt: now.toISOString(),
        isInternational,
        sources: Array.from(selectedSources),
        articles: articlesForSession,
        marketSummary: data,
        aiModel: selectedModel,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
      setFetchError(`API 오류: ${msg}`);
      setSummary(null);
      setIsLoading(false);
    }
  }, [isInternational, selectedSources, selectedModel, sources, addSession, watchlistItems]);

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 pt-5 space-y-4 pb-[130px]">
        {/* 1. 지역 선택 카드 */}
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden p-4">
          <div
            className="text-white/50 uppercase mb-3"
            style={{ fontSize: 15, fontWeight: 500, letterSpacing: "0.05em" }}
          >
            지역 선택
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRegion(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[6px] border transition-all ${
                isInternational
                  ? "bg-[#618EFF] text-white border-transparent"
                  : "bg-white/5 border-white/10 text-white/50"
              }`}
              style={{ fontSize: 14 }}
            >
              <span className="mr-1">🇺🇸</span>
              해외
            </button>
            <button
              type="button"
              onClick={() => setRegion(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[6px] border transition-all ${
                !isInternational
                  ? "bg-[#618EFF] text-white border-transparent"
                  : "bg-white/5 border-white/10 text-white/50"
              }`}
              style={{ fontSize: 14 }}
            >
              <span className="mr-1">🇰🇷</span>
              국내
            </button>
          </div>
        </div>

        {/* 2. 언론사 선택 카드 */}
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden p-4">
          <div
            className="text-white/50 uppercase mb-3"
            style={{ fontSize: 15, fontWeight: 500, letterSpacing: "0.05em" }}
          >
            언론사 선택
          </div>
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSource(s.id)}
                className={`inline-flex items-center rounded-[6px] border px-3 py-1.5 transition-all ${
                  selectedSources.has(s.id)
                    ? "bg-[#618EFF]/25 border-[#618EFF]/50 text-[#618EFF]"
                    : "bg-white/5 border-white/10 text-white/50"
                }`}
                style={{ fontSize: 14 }}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div
            className="mt-3 text-white/30 border-t border-white/6 pt-3 flex items-center justify-between"
            style={{ fontSize: 14 }}
          >
            <span>{selectedSources.size}개 선택됨</span>
            <Link
              to="/settings"
              className="text-[#618EFF]/80 hover:text-[#8BABFF]"
            >
              기간: {RANGE_LABELS[getRecentRangeFromSettings()] ?? "24시간 이내"}
            </Link>
          </div>
        </div>

        {/* 3. 로딩 프로그래스 */}
        {isLoading && (
          <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden divide-y divide-white/6">
            {[0, 1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`flex items-center gap-3 px-4 py-3 ${
                  step < loadStep
                    ? "bg-[#2C3D6B]/50 text-[#8BABFF]"
                    : step === loadStep
                      ? "bg-[#618EFF]/30 text-[#618EFF]"
                      : "bg-white/5 text-white/20"
                }`}
              >
                {step < loadStep ? (
                  <CheckCheck size={16} />
                ) : step === loadStep ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <span style={{ fontSize: 14 }}>{step + 1}</span>
                )}
                <span style={{ fontSize: 14 }}>
                  {getLoadStepLabel(step, selectedModel)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 4. 오류 표시 */}
        {fetchError && !isLoading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-[10px] px-5 py-6">
            <p
              className="text-red-400"
              style={{ fontSize: 14, lineHeight: 1.6 }}
            >
              {fetchError}
            </p>
          </div>
        )}

        {/* 5. AI 시황 요약 결과 */}
        {summary !== null && !isLoading && !fetchError && (
          <MarketSummaryView
            data={summary}
            aiModel={selectedModel}
          />
        )}

        {/* 6. 빈 상태 안내 */}
        {summary === null && !isLoading && !fetchError && (
          <div className="bg-white/5 border border-white/8 rounded-[10px] px-6 py-8 text-center">
            <p
              className="text-white/50"
              style={{ fontSize: 14, lineHeight: 1.7 }}
            >
              지역과 언론사를 고른 뒤<br />
              하단 <span className="text-[#618EFF]" style={{ fontSize: 14, fontWeight: 500 }}>AI요약하기</span> 버튼을 눌러주세요.
            </p>
          </div>
        )}
      </div>

      {/* 하단 고정 */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#0a0a0f]/95 backdrop-blur-md border-t border-white/6 px-4 pt-3 pb-5 space-y-3 z-10">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelectedModel("gemini")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] border transition-all ${
              selectedModel === "gemini"
                ? "bg-[#618EFF]/20 border-[#618EFF]/40 text-[#618EFF]"
                : "bg-white/5 border-white/10 text-white/35"
            }`}
            style={{ fontSize: 14 }}
          >
            <Sparkles size={14} />
            Gemini
          </button>
          <button
            type="button"
            onClick={() => setSelectedModel("claude")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] border transition-all ${
              selectedModel === "claude"
                ? "bg-[#2C3D6B]/50 border-[#2C3D6B]/60 text-[#8BABFF]"
                : "bg-white/5 border-white/10 text-white/35"
            }`}
            style={{ fontSize: 14 }}
          >
            <Cpu size={14} />
            Claude
          </button>
        </div>
        <button
          type="button"
          onClick={handleFetch}
          disabled={selectedSources.size === 0 || isLoading}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-[10px] font-semibold transition-all ${
            selectedSources.size === 0 || isLoading
              ? "bg-white/5 text-white/30 cursor-not-allowed"
              : "bg-[#618EFF] text-white shadow-xl shadow-[#2C3D6B]/40"
          }`}
          style={{ fontSize: 15, fontWeight: 500 }}
        >
          {isLoading ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              {getLoadStepLabel(loadStep, selectedModel)}
            </>
          ) : (
            "AI요약하기"
          )}
        </button>
      </div>
    </div>
  );
}
