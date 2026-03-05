/**
 * 시황 요약 파이프라인 실행
 * 자동 스케줄러 및 (필요 시) 수동 호출용
 */

import type { ArchiveSession } from "../data/newsSources";
import type { MarketSummaryData } from "../data/marketSummary";
import { domesticSources, internationalSources, isDomesticSourceId, matchesDomesticForOverseasSummary } from "../data/newsSources";
import { mockMarketSummaryInternational, mockMarketSummaryDomestic } from "../data/marketSummary";
import { getSelectedSources, getInterestMemoryDomestic, getInterestMemoryInternational, getSelectedModel, parseInterestKeywords } from "../utils/persistState";
import { fetchRssFeeds, filterArticlesByRangeTieredWithMin } from "../utils/fetchRssFeeds";
import { filterHighQualityNews } from "../utils/filterHighQualityNews";
import { generateMarketSummary, verifyAndCorrectMarketSummary } from "../utils/aiSummary";
import { enrichMarketData, fetchTopMovers } from "../utils/fetchMarketData";
import type { RawRssArticle } from "../utils/fetchRssFeeds";
import type { Article } from "../data/newsSources";
import { appLog } from "../utils/appLogger";

export async function runMarketSummaryPipeline(
  isInternational: boolean,
  options: { addSession: (s: ArchiveSession) => void }
): Promise<MarketSummaryData | null> {
  const { addSession } = options;
  const selectedSources = getSelectedSources();
  const intlList = internationalSources.filter((s) => selectedSources.international.includes(s.id));
  const domList = domesticSources.filter((s) => selectedSources.domestic.includes(s.id));
  const sourceList = isInternational ? [...intlList, ...domList] : domList;
  const sourceIds = isInternational ? [...selectedSources.international, ...selectedSources.domestic] : selectedSources.domestic;
  if (sourceList.length === 0) return null;

  const startMs = Date.now();
  appLog("scheduler_pipeline_start", { intl: isInternational });

  const { articles: rawArticles, error: rssError } = await fetchRssFeeds({
    sources: sourceList.map((s) => ({ id: s.id, name: s.name, rssUrl: s.rssUrl })),
    onProgress: () => {},
  });
  if (rssError) throw new Error(rssError);

  console.log(`[Pipeline] Current View Mode: ${isInternational ? "International" : "Domestic"}`);
  console.log(`[Pipeline] Total RSS articles fetched: ${rawArticles.length}`);

  let articlesForFilter = rawArticles;
  if (isInternational && domList.length > 0 && intlList.length > 0) {
    articlesForFilter = rawArticles.filter((a) => {
      if (!isDomesticSourceId(a.sourceId)) return true;
      return matchesDomesticForOverseasSummary(a.title, a.body);
    });
    console.log(`[Pipeline] After domestic keyword filter: ${articlesForFilter.length}`);
  }

  const interestMemory = isInternational ? getInterestMemoryInternational() : getInterestMemoryDomestic();
  const interestKeywords = parseInterestKeywords(interestMemory);
  const { articles: filtered, rangeKey } = filterArticlesByRangeTieredWithMin(
    articlesForFilter,
    (byRange) =>
      filterHighQualityNews(byRange, {
        watchlist: [],
        interestKeywords,
        isInternational,
      })
  );
  console.log(`[Pipeline] After quality filter (range: ${rangeKey}): ${filtered.length} articles`);
  if (filtered.length === 0) {
    console.warn(`[Pipeline] 0 articles after filter — pipeline aborted`);
    return null;
  }

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

  const articlePayload = filtered.slice(0, 30).map((a: RawRssArticle) => ({
    title: a.title,
    link: a.link,
    pubDate: a.pubDate,
    sourceId: a.sourceId,
    sourceName: a.sourceName,
    body: a.body,
  }));

  const selectedModel = getSelectedModel();
  let data: MarketSummaryData;
  let actualModel: "gemini" | "gpt" | "claude" = selectedModel;
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
      actualModel = "gemini";
    }
  }

  await enrichMarketData(data, isInternational, { preserveMovers: !!moversSeed });

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
    ` ${String(now.getHours() % 12 || 12).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} · 리포트`;

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

  appLog("scheduler_pipeline_done", { intl: isInternational, ms: Date.now() - startMs });

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
}
