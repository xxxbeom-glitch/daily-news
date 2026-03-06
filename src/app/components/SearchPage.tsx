import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ExternalLink, X, Bookmark, BookmarkCheck } from "lucide-react";
import { useSearchState } from "../context/SearchStateContext";
import { getSelectedSources } from "../utils/persistState";
import { getEffectiveSources, matchesNewsSearchKeywords } from "../data/newsSources";
import { fetchRssFeeds } from "../utils/fetchRssFeeds";
import { filterArticlesByRange } from "../utils/fetchRssFeeds";
import { getRecentRangeFromSettings } from "../utils/fetchRssFeeds";
import { fetchArticleContent } from "../utils/articleReader";
import { stripHtmlToText } from "../utils/stripHtml";
import { addScrap, removeScrap, isScrapped } from "../utils/scrapStorage";
import type { RawRssArticle } from "../utils/fetchRssFeeds";

/** 기사 발행일 포맷 */
function formatPubDate(pubDate: string): string {
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** 기사 카드 - 우측 상단 영역 비움 (시각적 여백) */
function ArticleCardSimple({
  article,
  onOpenFullView,
}: {
  article: RawRssArticle;
  onOpenFullView: (article: RawRssArticle) => void;
}) {
  return (
    <div className="bg-white/5 border border-white/8 rounded-[10px] p-4">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onOpenFullView(article)}
          className="flex-1 min-w-0 text-left hover:opacity-90 transition-opacity"
        >
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45 }} className="text-white/95">
            {article.title}
          </div>
          <div className="flex items-center gap-2 mt-2 text-white/40" style={{ fontSize: 12 }}>
            <span>{article.sourceName}</span>
            <span>·</span>
            <span>{formatPubDate(article.pubDate)}</span>
          </div>
        </button>
        {/* 우측 상단 영역 비움 - 시각적 여백 */}
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-[6px] border border-white/15 px-2.5 py-1 text-white/60 hover:bg-white/5 hover:text-white/80"
          style={{ fontSize: 12 }}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={12} />
          원문 보기
        </a>
      </div>
    </div>
  );
}

/** 전체보기 진입 시 해당 기사 본문만 표시 (제목, 업로드 일시, 본문) */
function ArticleFullViewModal({
  article,
  onClose,
}: {
  article: RawRssArticle;
  onClose: () => void;
}) {
  const [scrapped, setScrapped] = useState(() => isScrapped(article.link));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    const rssBody = article.body?.trim();
    const hasRssFallback = rssBody && rssBody.length > 50;

    if (hasRssFallback) {
      setContent(stripHtmlToText(rssBody));
      setTitle(article.title);
      setLoading(false);
    } else {
      setLoading(true);
      setContent(null);
      setTitle(null);
    }

    fetchArticleContent(article.link)
      .then((res) => {
        if (cancelled) return;
        const txt = res.textContent?.trim();
        if (txt && txt.length > 50) {
          setContent(txt);
          setTitle(res.title || article.title);
        } else if (!hasRssFallback && rssBody && rssBody.length > 50) {
          setContent(stripHtmlToText(rssBody));
          setTitle(article.title);
        } else if (!hasRssFallback) {
          setContent("본문을 추출하지 못했습니다. 아래 '원문 보기'에서 직접 확인해주세요.");
          setTitle(article.title);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (!hasRssFallback && rssBody && rssBody.length > 50) {
          setContent(stripHtmlToText(rssBody));
          setTitle(article.title);
        } else if (!hasRssFallback) {
          setError("본문 로드에 실패했습니다. CORS 또는 사이트 차단으로 인한 것으로, '원문 보기'에서 직접 확인해주세요.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [article.link, article.body, article.title]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0f]">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button
          type="button"
          onClick={onClose}
          className="p-2 -ml-2 rounded-[8px] text-white/70 hover:text-white hover:bg-white/5"
        >
          <X size={20} />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (scrapped) removeScrap(article.link);
              else addScrap(article);
              setScrapped(!scrapped);
            }}
            className="flex items-center gap-1.5 rounded-[8px] border border-white/15 px-3 py-1.5 text-white/70 hover:bg-white/5 hover:text-white"
            style={{ fontSize: 13 }}
            title={scrapped ? "스크랩 해제" : "스크랩"}
          >
            {scrapped ? <BookmarkCheck size={14} className="text-[#618EFF]" /> : <Bookmark size={14} />}
            스크랩
          </button>
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-[8px] border border-white/15 px-3 py-1.5 text-white/70 hover:bg-white/5 hover:text-white"
            style={{ fontSize: 13 }}
          >
            <ExternalLink size={14} />
            원문 보기
          </a>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 max-w-[430px] mx-auto w-full">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw size={28} className="animate-spin text-white/50 mb-4" />
            <p className="text-white/60" style={{ fontSize: 14 }}>기사 불러오는 중…</p>
          </div>
        )}

        {error && (
          <div className="py-12 text-center">
            <p className="text-red-400" style={{ fontSize: 14 }}>{error}</p>
            <p className="text-white/40 mt-2" style={{ fontSize: 12 }}>원문 보기로 직접 확인해주세요.</p>
          </div>
        )}

        {!loading && !error && content && (
          <div>
            <h1 className="text-white font-semibold mb-4" style={{ fontSize: 18, lineHeight: 1.45 }}>
              {title || article.title}
            </h1>
            <div className="flex items-center gap-2 text-white/40 mb-6" style={{ fontSize: 13 }}>
              <span>{article.sourceName}</span>
              <span>·</span>
              <span>{formatPubDate(article.pubDate)}</span>
            </div>

            <div
              className="text-white/90 whitespace-pre-wrap font-normal"
              style={{ fontSize: 17, lineHeight: 1.8 }}
            >
              {content}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SearchPage() {
  const {
    searchArticles,
    setSearchArticles,
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
  } = useSearchState();

  const selectedSources = getSelectedSources();
  const selectedSet = new Set(selectedSources.sources);
  const sourceList = getEffectiveSources().filter((s) => selectedSet.has(s.id));
  const hasAnySource = sourceList.length > 0;

  const [fullViewArticle, setFullViewArticle] = useState<RawRssArticle | null>(null);

  const handleSearch = useCallback(async () => {
    if (!hasAnySource) return;
    setIsLoading(true);
    setSearchArticles([]);
    setFetchError(null);
    setLoadStep(0);
    setLoadStepDetail(null);
    setLoadProgress(5);

    try {
      const { articles: rawArticles, error: rssError } = await fetchRssFeeds({
        sources: sourceList,
        onProgress: (fetched, total) => {
          setLoadStep(0);
          setLoadStepDetail(`${fetched}/${total}`);
          setLoadProgress(5 + Math.round((fetched / total) * 40));
        },
      });

      if (rssError) throw new Error(rssError);

      setLoadStep(1);
      setLoadProgress(60);

      const rangeKey = getRecentRangeFromSettings();
      const byRange = filterArticlesByRange(rawArticles, rangeKey);
      const filtered = byRange.filter((a) => matchesNewsSearchKeywords(a.title, a.body));

      setLoadProgress(100);
      setSearchArticles(filtered);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "뉴스 검색 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
      setLoadStepDetail(null);
    }
  }, [hasAnySource, sourceList, setIsLoading, setSearchArticles, setFetchError, setLoadStep, setLoadStepDetail, setLoadProgress]);

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 pt-5 space-y-4 pb-[200px]">
        {isLoading && (
          <div className="bg-white/5 border border-white/8 rounded-[10px] px-5 py-6 text-center">
            <div style={{ fontSize: 14 }} className="text-white/80">
              {loadStep === 0 ? `RSS 기사 수집 중${loadStepDetail ? ` (${loadStepDetail})` : ""}` : "5대 키워드 필터링 중"}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }} className="text-white/90 mt-1">
              {loadProgress}%
            </div>
          </div>
        )}

        {fetchError && !isLoading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-[10px] px-5 py-6">
            <p className="text-red-400" style={{ fontSize: 14, lineHeight: 1.6 }}>{fetchError}</p>
          </div>
        )}

        {!isLoading && !fetchError && searchArticles.length > 0 && (
          <div className="space-y-3">
            <p className="text-white/50" style={{ fontSize: 13 }}>
              S&P500·나스닥·뉴욕증시·장을 마감·NYSE 키워드 기사 {searchArticles.length}건
            </p>
            {searchArticles.map((a, i) => (
              <ArticleCardSimple
                key={`${a.link}-${i}`}
                article={a}
                onOpenFullView={setFullViewArticle}
              />
            ))}
          </div>
        )}

        {!isLoading && !fetchError && searchArticles.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[160px] text-center">
            <p className="text-white/50" style={{ fontSize: 14, lineHeight: 1.7 }}>
              {hasAnySource ? (
                <>
                  하단 <span className="text-[#618EFF]" style={{ fontWeight: 500 }}>오늘의 뉴스 검색</span> 버튼을 눌러주세요.
                  <br />
                  매일경제 등 RSS에서 5대 핵심 키워드 기사를 수집합니다.
                </>
              ) : (
                <>
                  설정에서 언론사를 선택한 뒤
                  <br />
                  <span className="text-[#618EFF]" style={{ fontWeight: 500 }}>오늘의 뉴스 검색</span>을 사용해주세요.
                </>
              )}
            </p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#0a0a0f]/95 backdrop-blur-md border-t border-white/6 px-4 pt-3 pb-5 z-10">
        <button
          type="button"
          onClick={handleSearch}
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
              {loadStep === 0 ? "RSS 수집 중" : "필터링 중"}
              {loadStepDetail && <span className="tabular-nums">({loadStepDetail})</span>}
            </>
          ) : (
            "오늘의 뉴스 검색"
          )}
        </button>
      </div>

      {fullViewArticle && (
        <ArticleFullViewModal
          article={fullViewArticle}
          onClose={() => setFullViewArticle(null)}
        />
      )}
    </div>
  );
}
