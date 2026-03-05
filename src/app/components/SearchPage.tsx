import { useCallback, useEffect, useRef, useState } from "react";
import { saveSearchState, loadSearchState, getSelectedSources, getSelectedModel, getInterestMemoryDomestic, getInterestMemoryInternational, parseInterestKeywords } from "../utils/persistState";
import { useSearchState } from "../context/SearchStateContext";
import { RefreshCw } from "lucide-react";
import type { Article } from "../data/newsSources";
import { domesticSources, internationalSources } from "../data/newsSources";
import type { MarketSummaryData } from "../data/marketSummary";
import {
  mockMarketSummaryInternational,
  mockMarketSummaryDomestic,
} from "../data/marketSummary";
import { generateMarketSummary, verifyAndCorrectMarketSummary } from "../utils/aiSummary";
import { useArchive } from "../context/ArchiveContext";
import { MarketSummaryView } from "./MarketSummaryView";
import {
  fetchRssFeeds,
  filterArticlesByRangeTieredWithMin,
} from "../utils/fetchRssFeeds";
import { filterHighQualityNews } from "../utils/filterHighQualityNews";
import { enrichMarketData, fetchTopMovers } from "../utils/fetchMarketData";
import { appLog } from "../utils/appLogger";

const LOAD_STEPS: Record<number, string> = {
  0: "RSS 피드 수집 중…",
  1: "기사 필터링 중…",
  2: "고품질 기사 선별 중…",
  3: "시황 리포트 생성 중…",
};

function getLoadStepLabel(step: number, model: "gemini" | "gpt") {
  if (step <= 2) return LOAD_STEPS[step];
  if (step === 3) return (model === "gemini" ? "Gemini AI" : "ChatGPT") + " 분석·요약 중…";
  return "시황 리포트 생성 중…";
}

export function SearchPage() {
  const { addSession } = useArchive();
  const {
    summaryInternational,
    summaryDomestic,
    setSummaryInternational,
    setSummaryDomestic,
    summaryModel,
    setSummaryModel,
    selectedModel,
    setSelectedModel,
    isLoading,
    setIsLoading,
    loadStep,
    setLoadStep,
    loadProgress,
    setLoadProgress,
    fetchError,
    setFetchError,
    fetchInfo,
    setFetchInfo,
  } = useSearchState();

  const [regionFilter, setRegionFilter] = useState<"both" | "us" | "kr">("both");
  const selectedSources = getSelectedSources();
  const hasIntlSources = selectedSources.international.length > 0;
  const hasDomesticSources = selectedSources.domestic.length > 0;
  const hasSources =
    (regionFilter === "both" && (hasIntlSources || hasDomesticSources)) ||
    (regionFilter === "us" && hasIntlSources) ||
    (regionFilter === "kr" && hasDomesticSources);

  const intlSourceList = internationalSources.filter((s) => selectedSources.international.includes(s.id));
  const domesticSourceList = domesticSources.filter((s) => selectedSources.domestic.includes(s.id));

  const hasAnySummary = summaryInternational !== null || summaryDomestic !== null;

  // 페이지 진입 시 sessionStorage에서 폼 상태 복원 (선택 모델은 설정 저장값 우선)
  useEffect(() => {
    setSelectedModel(getSelectedModel());
    const saved = loadSearchState();
    if (!saved) return;
    const si = saved.summaryInternational;
    const sd = saved.summaryDomestic;
    const isValid = (s: unknown): s is MarketSummaryData =>
      s != null && typeof s === "object" && Array.isArray((s as MarketSummaryData).indices);
    if (si != null && isValid(si)) setSummaryInternational(si as MarketSummaryData);
    if (sd != null && isValid(sd)) setSummaryDomestic(sd as MarketSummaryData);
    if (saved.summaryModel) setSummaryModel(saved.summaryModel);
    // 이전 형식 호환
    if (saved.summary != null && isValid(saved.summary)) {
      const s = saved.summary as MarketSummaryData;
      if (saved.isInternational) setSummaryInternational(s);
      else setSummaryDomestic(s);
    }
  }, [setSelectedModel, setSummaryInternational, setSummaryDomestic, setSummaryModel]);

  // 상태 변경 시 sessionStorage 저장
  useEffect(() => {
    saveSearchState({
      selectedModel,
      sourcesExpanded: false,
      ...(summaryInternational ? { summaryInternational } : {}),
      ...(summaryDomestic ? { summaryDomestic } : {}),
      ...((summaryInternational || summaryDomestic) ? { summaryModel } : {}),
    });
  }, [selectedModel, summaryInternational, summaryDomestic, summaryModel]);

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedStartRef = useRef<number>(0);

  useEffect(() => {
    if (!isLoading || loadStep !== 3) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }
    progressIntervalRef.current = setInterval(() => {
      setLoadProgress((p) => Math.min(p + 3, 88));
    }, 1500);
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isLoading, loadStep]);

  useEffect(() => {
    if (!isLoading) {
      setElapsedSec(0);
      return;
    }
    elapsedStartRef.current = Date.now();
    const tick = () => {
      const sec = Math.floor((Date.now() - elapsedStartRef.current) / 1000);
      setElapsedSec(sec);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  const runPipeline = useCallback(
    async (isInternational: boolean): Promise<MarketSummaryData | null> => {
      const sourceList = isInternational ? intlSourceList : domesticSourceList;
      const sourceIds = isInternational ? selectedSources.international : selectedSources.domestic;
      if (sourceList.length === 0) return null;

      const { articles: rawArticles, error: rssError } = await fetchRssFeeds({
        sources: sourceList,
        onProgress: () => {},
      });
      if (rssError) throw new Error(rssError);

      const interestMemory = isInternational ? getInterestMemoryInternational() : getInterestMemoryDomestic();
      const interestKeywords = parseInterestKeywords(interestMemory);
      const { articles: filtered } = filterArticlesByRangeTieredWithMin(
        rawArticles,
        (byRange) =>
          filterHighQualityNews(byRange, {
            watchlist: [],
            interestKeywords,
            isInternational,
          })
      );
      if (filtered.length === 0) return null;

      let moversSeed: { up: { name: string; ticker: string; changeRate: string }[]; down: { name: string; ticker: string; changeRate: string }[] } | undefined;
      if (isInternational) {
        const movers = await fetchTopMovers(true);
        if (movers && "up" in movers) {
          moversSeed = {
            up: movers.up.map((m) => ({ name: m.name, ticker: m.ticker, changeRate: m.changeRate })),
            down: movers.down.map((m) => ({ name: m.name, ticker: m.ticker, changeRate: m.changeRate })),
          };
        }
      }

      const articlePayload = filtered.slice(0, 30).map((a) => ({
        title: a.title,
        link: a.link,
        pubDate: a.pubDate,
        sourceId: a.sourceId,
        sourceName: a.sourceName,
        body: a.body,
      }));

      let data: MarketSummaryData;
      let actualModel: "gemini" | "gpt" = selectedModel;
      try {
        data = await generateMarketSummary({
          articles: articlePayload,
          isInternational,
          model: selectedModel,
          interestMemory: interestMemory || undefined,
          moversSeed,
        });
      } catch {
        const otherModel = selectedModel === "gemini" ? "gpt" : "gemini";
        try {
          data = await generateMarketSummary({
            articles: articlePayload,
            isInternational,
            model: otherModel,
            interestMemory: interestMemory || undefined,
            moversSeed,
          });
          actualModel = otherModel;
        } catch {
          data = isInternational ? mockMarketSummaryInternational : mockMarketSummaryDomestic;
          data = { ...data, totalAssessmentError: true };
          actualModel = selectedModel;
        }
      }

      await enrichMarketData(data, isInternational, { preserveMovers: !!moversSeed });

      if ((data.indices?.length ?? 0) > 0 || (data.moversUp?.length ?? 0) + (data.moversDown?.length ?? 0) > 0) {
        try {
          data = await verifyAndCorrectMarketSummary(data, { model: actualModel });
        } catch {
          /* 2차 검증 실패 시 원본 유지 */
        }
      }

      const now = new Date();
      const title =
        `${now.getMonth() + 1}월 ${now.getDate()}일 ` +
        (now.getHours() < 12 ? "오전" : "오후") +
        ` ${String(now.getHours() % 12 || 12).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} · ${data.regionLabel}`;

      const articlesForSession: Article[] =
        filtered.length > 0
          ? filtered.slice(0, 20).map((a, i) => ({
              id: `rss-${Date.now()}-${i}`,
              title: a.title,
              source: a.sourceName,
              sourceId: a.sourceId,
              publishedAt: new Date(a.pubDate).toISOString(),
              url: a.link,
              summary: "",
              aiModel: actualModel,
              category: "Economy",
              isInternational,
            }))
          : [
              {
                id: "m1",
                title: "시황 요약 (검색 기간 내 기사 없음)",
                source: sourceList[0]?.name ?? "Unknown",
                sourceId: sourceList[0]?.id ?? "unknown",
                publishedAt: now.toISOString(),
                url: "https://example.com",
                summary: data.keyIssues[0]?.body ?? "",
                aiModel: actualModel,
                category: "Economy",
                isInternational,
              },
            ];

      addSession({
        id: `session-${Date.now()}-${isInternational ? "intl" : "dom"}`,
        title,
        createdAt: now.toISOString(),
        isInternational,
        sources: sourceIds,
        articles: articlesForSession,
        marketSummary: data,
        aiModel: actualModel,
      });

      return data;
    },
    [
      intlSourceList,
      domesticSourceList,
      selectedSources,
      selectedModel,
      addSession,
    ]
  );

  const handleFetch = useCallback(async () => {
    if (!hasSources) return;
    setIsLoading(true);
    setSummaryInternational(null);
    setSummaryDomestic(null);
    setFetchError(null);
    setFetchInfo(null);
    setLoadStep(0);
    setLoadProgress(0);
    setElapsedSec(0);
    const startMs = Date.now();
    appLog("pipeline_start", { intl: hasIntlSources, dom: hasDomesticSources });

    const errors: string[] = [];
    let fallbackMsg: string | null = null;

    try {
      setLoadStep(0);
      setLoadProgress(10);

      const tasks: { isInternational: boolean }[] = [];
      if (regionFilter === "both") {
        if (hasIntlSources) tasks.push({ isInternational: true });
        if (hasDomesticSources) tasks.push({ isInternational: false });
      } else if (regionFilter === "us" && hasIntlSources) {
        tasks.push({ isInternational: true });
      } else if (regionFilter === "kr" && hasDomesticSources) {
        tasks.push({ isInternational: false });
      }

      if (tasks.length === 0) {
        setFetchError("선택된 언론사가 없습니다. 설정에서 언론사를 선택해주세요.");
        setIsLoading(false);
        return;
      }

      setLoadStep(1);
      setLoadProgress(25);
      await new Promise((r) => setTimeout(r, 200));

      setLoadStep(2);
      setLoadProgress(40);
      await new Promise((r) => setTimeout(r, 200));

      setLoadStep(3);
      setLoadProgress(52);

      let intlOk = false;
      let domOk = false;
      if (tasks.length === 1) {
        const { isInternational } = tasks[0];
        try {
          const data = await runPipeline(isInternational);
          setLoadProgress(100);
          if (data) {
            if (isInternational) {
              setSummaryInternational(data);
              intlOk = true;
            } else {
              setSummaryDomestic(data);
              domOk = true;
            }
          } else {
            errors.push(isInternational ? "해외" : "국내" + " 기사가 없어 시황을 생성하지 못했습니다.");
          }
        } catch (e) {
          errors.push((e instanceof Error ? e.message : "알 수 없는 오류") + (isInternational ? " (해외)" : " (국내)"));
        }
      } else {
        const [intlData, domData] = await Promise.all([
          runPipeline(true),
          runPipeline(false),
        ]);
        setLoadProgress(100);
        if (intlData) {
          setSummaryInternational(intlData);
          intlOk = true;
        } else if (hasIntlSources) errors.push("해외 기사가 없어 해외 시황을 생성하지 못했습니다.");
        if (domData) {
          setSummaryDomestic(domData);
          domOk = true;
        } else if (hasDomesticSources) errors.push("국내 기사가 없어 국내 시황을 생성하지 못했습니다.");
      }

      setSummaryModel(selectedModel);
      if (fallbackMsg) setFetchInfo(fallbackMsg);
      if (errors.length > 0) setFetchError(errors.join("\n"));
      appLog("pipeline_done", {
        ms: Date.now() - startMs,
        intl: intlOk,
        dom: domOk,
        errors: errors.length,
      });
      setIsLoading(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
      setFetchError(`API 오류: ${msg}`);
      appLog("pipeline_error", { msg, ms: Date.now() - startMs });
      setSummaryInternational(null);
      setSummaryDomestic(null);
      setIsLoading(false);
    }
  }, [
    hasSources,
    hasIntlSources,
    hasDomesticSources,
    regionFilter,
    selectedModel,
    runPipeline,
    setIsLoading,
    setSummaryInternational,
    setSummaryDomestic,
    setSummaryModel,
    setFetchError,
    setFetchInfo,
  ]);

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 pt-5 space-y-4 pb-[200px]">
        <div className="flex gap-2">
          {[
            { key: "both" as const, label: "전체" },
            { key: "us" as const, label: "🇺🇸 미국" },
            { key: "kr" as const, label: "🇰🇷 한국" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setRegionFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                regionFilter === key
                  ? "bg-[#618EFF] text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/15"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {isLoading && (
          <div className="bg-white/5 border border-white/8 rounded-[10px] px-5 py-6 text-center">
            <div style={{ fontSize: 14 }} className="text-white/80">
              {getLoadStepLabel(loadStep, selectedModel)}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }} className="text-white/90 mt-1">
              {loadProgress}% · {elapsedSec}초
            </div>
            <div style={{ fontSize: 12 }} className="text-white/40 mt-2">
              RSS 수집 → 기사 선별 → AI 분석 순으로 진행 중입니다
            </div>
          </div>
        )}

        {fetchError && !isLoading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-[10px] px-5 py-6">
            <p className="text-red-400" style={{ fontSize: 14, lineHeight: 1.6 }}>{fetchError}</p>
          </div>
        )}
        {fetchInfo && !isLoading && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-[10px] px-5 py-4">
            <p className="text-amber-400" style={{ fontSize: 14, lineHeight: 1.6 }}>ℹ️ {fetchInfo}</p>
          </div>
        )}

        {summaryInternational !== null && !isLoading && !fetchError && (regionFilter === "both" || regionFilter === "us") && (
          <MarketSummaryView data={summaryInternational} aiModel={summaryModel} />
        )}
        {summaryDomestic !== null && !isLoading && !fetchError && (regionFilter === "both" || regionFilter === "kr") && (
          <MarketSummaryView data={summaryDomestic} aiModel={summaryModel} />
        )}

        {!hasAnySummary && !isLoading && !fetchError && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[160px] text-center">
            <p className="text-white/50" style={{ fontSize: 14, lineHeight: 1.7 }}>
              하단 <span className="text-[#618EFF]" style={{ fontWeight: 500 }}>AI요약하기</span> 버튼을 눌러주세요.
              <br />
              해외·국내 시황이 자동으로 생성됩니다.
            </p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#0a0a0f]/95 backdrop-blur-md border-t border-white/6 px-4 pt-3 pb-5 z-10">
        <button
          type="button"
          onClick={handleFetch}
          disabled={!hasSources || isLoading}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-[10px] font-semibold transition-all ${
            !hasSources || isLoading
              ? "bg-white/5 text-white/30 cursor-not-allowed"
              : "bg-[#618EFF] text-white shadow-xl shadow-[#2C3D6B]/40"
          }`}
          style={{ fontSize: 15, fontWeight: 500 }}
        >
          {isLoading ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              {getLoadStepLabel(loadStep, selectedModel)}
              <span className="tabular-nums" style={{ opacity: 0.9 }}>
                ({elapsedSec}초)
              </span>
            </>
          ) : (
            "AI요약하기"
          )}
        </button>
      </div>
    </div>
  );
}
