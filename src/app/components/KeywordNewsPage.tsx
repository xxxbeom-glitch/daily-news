import { useEffect, useState } from "react";
import { RefreshCw, ExternalLink, X, Bookmark, BookmarkCheck, BookmarkX } from "lucide-react";
import {
  getInterestMemoryDomestic,
  getInterestMemoryInternational,
  parseInterestKeywords,
  getSelectedSources,
} from "../utils/persistState";
import { domesticSources, internationalSources } from "../data/newsSources";
import { fetchRssFeeds, filterArticlesByRange, getRecentRangeFromSettings } from "../utils/fetchRssFeeds";
import { translateKeywordsToEnglish, isInternationalSource, translateTextToKorean } from "../utils/keywordTranslation";
import { fetchArticleContent } from "../utils/articleReader";
import { addScrap, removeScrap, isScrapped } from "../utils/scrapStorage";
import type { RawRssArticle } from "../utils/fetchRssFeeds";

export function formatPubDate(pubDate: string): string {
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

function matchesKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => k.length > 0 && lower.includes(k.toLowerCase()));
}

export function ArticleCard({
  article,
  onOpenReader,
  onScrapChange,
  isScrapped: scrapped,
  onUnscrap,
}: {
  article: RawRssArticle;
  onOpenReader: (article: RawRssArticle, translate: boolean) => void;
  onScrapChange?: () => void;
  isScrapped?: boolean;
  onUnscrap?: () => void;
}) {
  const isIntl = isInternationalSource(article.sourceId);

  return (
    <div className="bg-white/5 border border-white/8 rounded-[10px] p-4">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onOpenReader(article, false)}
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
        {onUnscrap && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeScrap(article.link);
              onUnscrap();
            }}
            className="shrink-0 p-2 rounded-[8px] text-white/50 hover:text-red-400 hover:bg-white/5"
            title="스크랩 해제"
          >
            <BookmarkX size={18} />
          </button>
        )}
        {!onUnscrap && onScrapChange && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (scrapped) removeScrap(article.link);
              else addScrap(article);
              onScrapChange();
            }}
            className="shrink-0 p-2 rounded-[8px] text-white/50 hover:text-[#618EFF] hover:bg-white/5"
            title={scrapped ? "스크랩 해제" : "스크랩"}
          >
            {scrapped ? <BookmarkCheck size={18} className="text-[#618EFF]" /> : <Bookmark size={18} />}
          </button>
        )}
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
        {isIntl && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenReader(article, true);
            }}
            className="flex items-center gap-1 rounded-[6px] border border-[#618EFF]/40 px-2.5 py-1 text-[#618EFF] hover:bg-[#618EFF]/10"
            style={{ fontSize: 12 }}
          >
            번역
          </button>
        )}
      </div>
    </div>
  );
}

export function ReaderViewModal({
  article,
  translate,
  onClose,
}: {
  article: RawRssArticle;
  translate: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);
    setTitle(null);
    setTranslated(null);

    fetchArticleContent(article.link)
      .then((res) => {
        if (cancelled) return;
        setContent(res.textContent || "본문을 추출하지 못했습니다.");
        setTitle(res.title || article.title);
        if (translate && res.textContent) {
          setTranslating(true);
          translateTextToKorean(res.textContent)
            .then((text) => {
              if (!cancelled && text) setTranslated(text);
            })
            .finally(() => {
              if (!cancelled) setTranslating(false);
            });
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "기사를 불러올 수 없습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [article.link, translate]);

  const displayContent = translated ?? content;
  const isIntl = isInternationalSource(article.sourceId);

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

        {!loading && !error && displayContent && (
          <div className="reader-view">
            <h1 className="text-white font-bold mb-4" style={{ fontSize: 20, lineHeight: 1.4 }}>
              {title || article.title}
            </h1>
            <div className="flex items-center gap-2 text-white/40 mb-6" style={{ fontSize: 13 }}>
              <span>{article.sourceName}</span>
              <span>·</span>
              <span>{formatPubDate(article.pubDate)}</span>
            </div>

            {isIntl && content && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={async () => {
                    if (translated || translating) return;
                    setTranslating(true);
                    try {
                      const t = await translateTextToKorean(content);
                      if (t) setTranslated(t);
                    } finally {
                      setTranslating(false);
                    }
                  }}
                  disabled={translating}
                  className="rounded-[8px] border border-[#618EFF]/40 px-3 py-2 text-[#618EFF] hover:bg-[#618EFF]/10 disabled:opacity-50"
                  style={{ fontSize: 13 }}
                >
                  {translating ? "번역 중…" : translated ? "번역됨" : "번역하기"}
                </button>
              </div>
            )}

            <div
              className="text-white/85 whitespace-pre-wrap"
              style={{ fontSize: 16, lineHeight: 1.75, fontFamily: "Georgia, serif" }}
            >
              {displayContent}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function KeywordNewsPage() {
  const [articles, setArticles] = useState<RawRssArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStep, setLoadStep] = useState("준비 중…");
  const [readerArticle, setReaderArticle] = useState<RawRssArticle | null>(null);
  const [readerTranslate, setReaderTranslate] = useState(false);
  const [scrapVersion, setScrapVersion] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    setLoadProgress(0);
    setLoadStep("준비 중…");

    try {
      setLoadStep("키워드 로딩…");
      setLoadProgress(5);

      const memDom = getInterestMemoryDomestic();
      const memIntl = getInterestMemoryInternational();
      const combined = `${memDom}\n${memIntl}`;
      const keywords = parseInterestKeywords(combined);

      let translated: string[] = [];
      const hasHangul = keywords.some((k) => /[\uAC00-\uD7A3]/.test(k));
      if (hasHangul) {
        setLoadStep("키워드 번역 중…");
        setLoadProgress(10);
        try {
          translated = await translateKeywordsToEnglish(keywords);
        } catch {
          translated = [];
        }
      }
      setLoadProgress(15);
      const allKeywords = [...new Set([...keywords, ...translated])];

      if (allKeywords.length === 0) {
        setArticles([]);
        setError("설정 > 기억할 관심사(국내/해외)에 키워드를 입력해주세요.");
        setLoading(false);
        return;
      }

      setLoadStep("RSS 뉴스 수집 중…");
      const selected = getSelectedSources();
      const domesticList = domesticSources.filter((s) => selected.domestic.includes(s.id));
      const intlList = internationalSources.filter((s) => selected.international.includes(s.id));
      const allSources = [
        ...domesticList.map((s) => ({ id: s.id, name: s.name, rssUrl: s.rssUrl })),
        ...intlList.map((s) => ({ id: s.id, name: s.name, rssUrl: s.rssUrl })),
      ];

      const { articles: raw, error: fetchErr } = await fetchRssFeeds({
        sources: allSources,
        onProgress: (fetched, tot) => {
          const pct = 15 + Math.round((fetched / tot) * 80);
          setLoadProgress(pct);
          setLoadStep(`RSS 수집 중… (${fetched}/${tot})`);
        },
      });
      if (fetchErr) {
        setError(fetchErr);
        setArticles([]);
        setLoading(false);
        return;
      }

      setLoadStep("키워드 필터링 중…");
      setLoadProgress(97);

      const rangeKey = getRecentRangeFromSettings();
      const filtered = filterArticlesByRange(raw, rangeKey);
      const matched = filtered.filter((a) => matchesKeyword(a.title, allKeywords) || (a.body && matchesKeyword(a.body, allKeywords)));
      matched.sort((a, b) => {
        const da = new Date(a.pubDate).getTime();
        const db = new Date(b.pubDate).getTime();
        return db - da;
      });
      setLoadProgress(100);
      setArticles(matched);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
      setArticles([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="bg-white/5 border border-white/8 rounded-[10px] px-5 py-8">
          <RefreshCw size={24} className="animate-spin text-white/60 mx-auto mb-3 block" />
          <p className="text-white/80 text-center" style={{ fontSize: 14 }}>{loadStep}</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#618EFF] transition-all duration-300"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
            <span className="text-white/70 shrink-0" style={{ fontSize: 14, fontWeight: 600 }}>{loadProgress}%</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <div className="bg-white/5 border border-white/8 rounded-[10px] px-5 py-6">
          <p className="text-white/70" style={{ fontSize: 14, lineHeight: 1.6 }}>{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-4 flex items-center gap-2 text-[#618EFF] hover:text-[#7BA3FF]"
            style={{ fontSize: 14 }}
          >
            <RefreshCw size={16} />
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="px-4 py-6">
        <div className="bg-white/5 border border-white/8 rounded-[10px] px-5 py-6">
          <p className="text-white/60" style={{ fontSize: 14 }}>키워드에 맞는 기사가 없습니다.</p>
          <p className="text-white/40 mt-2" style={{ fontSize: 12 }}>설정에서 기억할 관심사 키워드를 추가하거나, 검색 기간을 넓혀보세요.</p>
          <button
            type="button"
            onClick={load}
            className="mt-4 flex items-center gap-2 text-[#618EFF] hover:text-[#7BA3FF]"
            style={{ fontSize: 14 }}
          >
            <RefreshCw size={16} />
            새로고침
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-6 pb-[120px]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white/50" style={{ fontSize: 13 }}>관심사 키워드 기반 뉴스 {articles.length}건</p>
          <button
            type="button"
            onClick={load}
            className="p-2 rounded-[8px] text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
            title="새로고침"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {articles.map((a, i) => (
            <ArticleCard
              key={`${a.link}-${i}`}
              article={a}
              onOpenReader={(art, translate) => {
                setReaderArticle(art);
                setReaderTranslate(translate);
              }}
              onScrapChange={() => setScrapVersion((v) => v + 1)}
              isScrapped={isScrapped(a.link)}
            />
          ))}
        </div>
      </div>

      {readerArticle && (
        <ReaderViewModal
          article={readerArticle}
          translate={readerTranslate}
          onClose={() => setReaderArticle(null)}
        />
      )}
    </>
  );
}
