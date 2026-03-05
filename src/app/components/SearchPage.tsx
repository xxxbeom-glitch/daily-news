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
import { isDomesticSourceId, matchesDomesticForOverseasSummary } from "../data/newsSources";
import { filterHighQualityNews } from "../utils/filterHighQualityNews";
import { enrichMarketData, fetchTopMovers } from "../utils/fetchMarketData";
import { appLog } from "../utils/appLogger";

const LOAD_STEPS: Record<number, string> = {
  0: "RSS 기사 수집 중입니다",
  1: "기사 선별 중입니다",
  2: "AI 1차 요약 중입니다",
  3: "AI 2차 검증 중입니다",
};

/** 단계별 예상 소요 시간 (초) */
const STEP_ESTIMATES = [12, 3, 35, 10];

function getLoadStepLabel(step: number, stepDetail: string | null): string {
  const base = LOAD_STEPS[step] ?? "진행 중입니다";
  if (stepDetail) return `${base} (${stepDetail})`;
  return base;
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
    loadStepDetail,
    setLoadStepDetail,
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
  const hasAnySource = hasIntlSources || hasDomesticSources;

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

  const [elapsedSec, setElapsedSec] = useState(0);
  const [remainingEstSec, setRemainingEstSec] = useState(0);
  const pipelineStartRef = useRef<number>(0);
  const stepStartRef = useRef<number>(0);

  useEffect(() => {
    if (!isLoading) return;
    const t = Date.now();
    pipelineStartRef.current = t;
    stepStartRef.current = t;
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading) return;
    stepStartRef.current = Date.now();
  }, [loadStep]);

  useEffect(() => {
    if (!isLoading) return;
    const tick = () => setElapsedSec(Math.floor((Date.now() - pipelineStartRef.current) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading) return;
    const tick = () => {
      const sum = STEP_ESTIMATES.slice(loadStep).reduce((a, b) => a + b, 0);
      const elapsed = (Date.now() - stepStartRef.current) / 1000;
      setRemainingEstSec(Math.max(0, Math.ceil(sum - elapsed)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isLoading, loadStep]);

  const runPipeline = useCallback(
    async (isInternational: boolean): Promise<MarketSummaryData | null> => {
      const sourceList = isInternational
        ? [...intlSourceList, ...domesticSourceList]
        : domesticSourceList;
      const sourceIds = isInternational
        ? [...selectedSources.international, ...selectedSources.domestic]
        : selectedSources.domestic;
      if (sourceList.length === 0) return null;

      setLoadStep(0);
      setLoadStepDetail(null);
      setLoadProgress(5);
      const { articles: rawArticles, error: rssError } = await fetchRssFeeds({
        sources: sourceList,
        onProgress: (fetched, total) => {
          setLoadStep(0);
          setLoadStepDetail(`${fetched}/${total}`);
          setLoadProgress(5 + Math.round((fetched / total) * 20));
        },
      });
      if (rssError) throw new Error(rssError);

      let articlesForFilter = rawArticles;
      if (isInternational && domesticSourceList.length > 0 && intlSourceList.length > 0) {
        articlesForFilter = rawArticles.filter((a) => {
          if (!isDomesticSourceId(a.sourceId)) return true;
          return matchesDomesticForOverseasSummary(a.title, a.body);
        });
      }

      setLoadStep(1);
      setLoadStepDetail(null);
      setLoadProgress(30);
      const interestMemory = isInternational ? getInterestMemoryInternational() : getInterestMemoryDomestic();
      const interestKeywords = parseInterestKeywords(interestMemory);
      const { articles: filtered } = filterArticlesByRangeTieredWithMin(
        articlesForFilter,
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

      setLoadStep(2);
      setLoadStepDetail(null);
      setLoadProgress(45);
      let data: MarketSummaryData;
      let actualModel: "gemini" | "gpt" = selectedModel;
      try {
        data = await generateMarketSummary({
          articles: articlePayload,
          isInternational,
          model: "gemini",
          modelId: "gemini-3.1-pro-preview",
          interestMemory: interestMemory || undefined,
          moversSeed,
        });
      } catch {
        try {
          data = await generateMarketSummary({
            articles: articlePayload,
            isInternational,
            model: "gemini",
            modelId: "gemini-2.5-flash",
            interestMemory: interestMemory || undefined,
            moversSeed,
          });
          actualModel = "gemini";
        } catch {
          data = isInternational ? mockMarketSummaryInternational : mockMarketSummaryDomestic;
          data = { ...data, totalAssessmentError: true };
          actualModel = selectedModel;
        }
      }

      await enrichMarketData(data, isInternational, { preserveMovers: !!moversSeed });

      setLoadStep(3);
      setLoadStepDetail(null);
      setLoadProgress(85);
      if ((data.indices?.length ?? 0) > 0 || (data.moversUp?.length ?? 0) + (data.moversDown?.length ?? 0) > 0) {
        try {
          data = await verifyAndCorrectMarketSummary(data, {
            model: "gemini",
            modelId: "gemini-2.5-pro",
          });
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
                summary: data.headlineArticles?.[0]?.summary ?? data.totalAssessment ?? "",
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
      setLoadStep,
      setLoadStepDetail,
      setLoadProgress,
    ]
  );

  const handleFetch = useCallback(async () => {
    if (!hasAnySource) return;
    setIsLoading(true);
    setSummaryInternational(null);
    setSummaryDomestic(null);
    setFetchError(null);
    setFetchInfo(null);
    setLoadStep(0);
    setLoadStepDetail(null);
    setLoadProgress(0);
    setElapsedSec(0);
    const startMs = Date.now();
    appLog("pipeline_start", { intl: hasIntlSources, dom: hasDomesticSources });

    const errors: string[] = [];
    let fallbackMsg: string | null = null;

    try {
      const tasks: { isInternational: boolean }[] = [];
      const canRunOverseas = hasIntlSources || hasDomesticSources;
      if (regionFilter === "both") {
        if (hasIntlSources || hasDomesticSources) tasks.push({ isInternational: true });
        if (hasDomesticSources) tasks.push({ isInternational: false });
      } else if (regionFilter === "us" && canRunOverseas) {
        tasks.push({ isInternational: true });
      } else if (regionFilter === "kr" && hasDomesticSources) {
        tasks.push({ isInternational: false });
      }

      if (tasks.length === 0) {
        const msg =
          regionFilter === "kr"
            ? "한국 시장 뉴스를 가져오려면 설정 > 국내 언론사를 선택해주세요."
            : regionFilter === "us"
              ? "미국 시황을 가져오려면 설정 > 해외 시황 RSS 또는 국내 언론사를 선택해주세요."
              : "선택된 언론사가 없습니다. 설정에서 언론사를 선택해주세요.";
        setFetchError(msg);
        setIsLoading(false);
        return;
      }

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
        } else if (canRunOverseas) errors.push("해외 기사가 없어 해외 시황을 생성하지 못했습니다.");
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
    hasAnySource,
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
              {getLoadStepLabel(loadStep, loadStepDetail)}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }} className="text-white/90 mt-1">
              {loadProgress}%
            </div>
            <div
              style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 4 }}
            >
              예상 남은 시간 약 {remainingEstSec}초
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
          disabled={!hasAnySource || isLoading}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-[10px] font-semibold transition-all ${
            !hasAnySource || isLoading
              ? "bg-white/5 text-white/30 cursor-not-allowed"
              : "bg-[#618EFF] text-white shadow-xl shadow-[#2C3D6B]/40"
          }`}
          style={{ fontSize: 15, fontWeight: 500 }}
        >
          {isLoading ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              {getLoadStepLabel(loadStep, loadStepDetail)}
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
