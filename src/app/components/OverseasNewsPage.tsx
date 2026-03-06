import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, ExternalLink, X, Bookmark, BookmarkCheck } from "lucide-react";
import { getEffectiveSources } from "../data/newsSources";
import { getSelectedSources } from "../utils/persistState";
import { fetchRssFeeds } from "../utils/fetchRssFeeds";
import { fetchArticleContent } from "../utils/articleReader";
import { stripHtmlToText } from "../utils/stripHtml";
import { recordArticleView, getArticleViewCounts } from "../utils/articleViewCount";
import { addScrap, removeScrap, isScrapped } from "../utils/scrapStorage";
import type { RawRssArticle } from "../utils/fetchRssFeeds";

const PAGE_SIZE = 20;

type SortTab = "latest" | "mostViewed";

/** 탭 전환 시 리페치 방지 - 페이지 새로고침 시에만 초기화됨 */
let overseasNewsCache: RawRssArticle[] | null = null;

function formatPubDate(pubDate: string): string {
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ArticleFullViewModal({
  article,
  onClose,
  onScrapChange,
}: {
  article: RawRssArticle;
  onClose: () => void;
  onScrapChange?: () => void;
}) {
  const rssBody = article.body?.trim() && article.body.trim().length > 50 ? stripHtmlToText(article.body) : null;
  const [scrapped, setScrapped] = useState(() => isScrapped(article.link));
  const [loading, setLoading] = useState(!rssBody);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(rssBody);
  const [title, setTitle] = useState<string | null>(article.title);

  useEffect(() => {
    let cancelled = false;
    if (!rssBody) {
      setError(null);
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
        } else if (rssBody) {
          setContent(rssBody);
          setTitle(article.title);
        } else {
          setContent("본문을 추출하지 못했습니다. 아래 '원문 보기'에서 직접 확인해주세요.");
          setTitle(article.title);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (rssBody) {
          setContent(rssBody);
          setTitle(article.title);
        } else {
          setError("본문 로드에 실패했습니다. '원문 보기'에서 직접 확인해주세요.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [article.link, article.title, rssBody]);

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
              onScrapChange?.();
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

export function OverseasNewsPage() {
  const [allArticles, setAllArticles] = useState<RawRssArticle[]>([]);
  const [sortTab, setSortTab] = useState<SortTab>("latest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullViewArticle, setFullViewArticle] = useState<RawRssArticle | null>(null);
  const [viewCountVersion, setViewCountVersion] = useState(0);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const selectedSources = getSelectedSources();
  const selectedSet = new Set(selectedSources.sources);
  const sourceList = getEffectiveSources().filter((s) => selectedSet.has(s.id));

  const viewCounts = useMemo(() => getArticleViewCounts(), [viewCountVersion]);

  const sortedArticles = useMemo(() => {
    const arr = [...allArticles];
    if (sortTab === "latest") {
      arr.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    } else {
      arr.sort((a, b) => {
        const va = viewCounts[a.link] ?? 0;
        const vb = viewCounts[b.link] ?? 0;
        if (vb !== va) return vb - va;
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
      });
    }
    return arr;
  }, [allArticles, sortTab, viewCounts]);

  useEffect(() => {
    if (sourceList.length === 0) {
      setLoading(false);
      return;
    }
    if (overseasNewsCache?.length) {
      setAllArticles(overseasNewsCache);
      setVisibleCount(PAGE_SIZE);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setAllArticles([]);
    setVisibleCount(PAGE_SIZE);

    fetchRssFeeds({
      sources: sourceList,
      onProgress: () => {},
    })
      .then(({ articles, error: fetchErr }) => {
        if (fetchErr) {
          setError(fetchErr);
          setAllArticles([]);
          return;
        }
        articles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
        const seen = new Set<string>();
        const deduped = articles.filter((a) => {
          if (seen.has(a.link)) return false;
          seen.add(a.link);
          return true;
        });
        overseasNewsCache = deduped;
        setAllArticles(deduped);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "뉴스 로드 실패");
        setAllArticles([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const visibleArticles = sortedArticles.slice(0, visibleCount);
  const hasMore = visibleCount < sortedArticles.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, sortedArticles.length));
  }, [sortedArticles.length]);

  const handleArticleClick = useCallback((a: RawRssArticle) => {
    recordArticleView(a.link);
    setViewCountVersion((v) => v + 1);
    setFullViewArticle(a);
  }, []);

  const handleSortTabChange = useCallback((tab: SortTab) => {
    setSortTab(tab);
    setVisibleCount(PAGE_SIZE);
  }, []);

  useEffect(() => {
    if (!hasMore || loading) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "100px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-shrink-0 flex border-b border-white/10 px-4">
        <button
          type="button"
          onClick={() => handleSortTabChange("latest")}
          className={`flex-1 py-3 text-center transition-colors ${sortTab === "latest" ? "text-white font-semibold border-b-2 border-white -mb-[1px]" : "text-white/50 hover:text-white/70"}`}
          style={{ fontSize: 14 }}
        >
          최신기사
        </button>
        <button
          type="button"
          onClick={() => handleSortTabChange("mostViewed")}
          className={`flex-1 py-3 text-center transition-colors ${sortTab === "mostViewed" ? "text-white font-semibold border-b-2 border-white -mb-[1px]" : "text-white/50 hover:text-white/70"}`}
          style={{ fontSize: 14 }}
        >
          가장 많이본 기사
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-5 pb-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw size={28} className="animate-spin text-white/50 mb-4" />
            <p className="text-white/60" style={{ fontSize: 14 }}>뉴스 불러오는 중…</p>
          </div>
        )}

        {error && !loading && (
          <div className="py-12 text-center">
            <p className="text-red-400" style={{ fontSize: 14 }}>{error}</p>
          </div>
        )}

        {!loading && !error && visibleArticles.length > 0 && (
          <div className="space-y-3">
            {visibleArticles.map((a, i) => (
              <button
                key={`${a.link}-${i}`}
                type="button"
                onClick={() => handleArticleClick(a)}
                className="w-full flex items-start gap-3 p-3 rounded-[10px] bg-white/5 border border-white/8 hover:bg-white/8 text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div
                    className="text-white/95 font-semibold line-clamp-2"
                    style={{ fontSize: 14, lineHeight: 1.45 }}
                  >
                    {a.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-white/40" style={{ fontSize: 12 }}>
                    <span>{a.sourceName}</span>
                    <span>·</span>
                    <span>{formatPubDate(a.pubDate)}</span>
                  </div>
                </div>
                {a.thumbnail && (
                  <img
                    src={a.thumbnail}
                    alt=""
                    className="w-9 h-9 shrink-0 rounded-[6px] object-cover"
                  />
                )}
              </button>
            ))}
        <div ref={loadMoreRef} className="h-4" />
          </div>
        )}

        {!loading && !error && allArticles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-white/50" style={{ fontSize: 14 }}>수집된 기사가 없습니다.</p>
          </div>
        )}
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
