import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { RawRssArticle } from "../utils/fetchRssFeeds";
import { getInterestMemoryDomestic, parseInterestKeywords } from "../utils/persistState";
import { isScrapped } from "../utils/scrapStorage";
import { domesticSources } from "../data/newsSources";
import { fetchRssFeeds, filterArticlesByRangeTiered } from "../utils/fetchRssFeeds";
import { deduplicateBySimilarity } from "../utils/filterHighQualityNews";

function matchesKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => k.length > 0 && lower.includes(k.toLowerCase()));
}

interface KeywordNewsContextValue {
  articles: RawRssArticle[];
  loading: boolean;
  error: string | null;
  loadProgress: number;
  loadStep: string;
  hasLoadedOnce: boolean;
  load: () => Promise<void>;
}

const KeywordNewsContext = createContext<KeywordNewsContextValue | null>(null);

export function KeywordNewsProvider({ children }: { children: ReactNode }) {
  const [articles, setArticles] = useState<RawRssArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStep, setLoadStep] = useState("준비 중…");
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadProgress(0);
    setLoadStep("준비 중…");

    try {
      setLoadStep("키워드 로딩…");
      setLoadProgress(5);

      const memDom = getInterestMemoryDomestic();
      const keywords = parseInterestKeywords(memDom);

      const keywordNewsSourceIds = ["gn_hankyung", "gn_mk"];
      const domesticList = domesticSources.filter((s) => keywordNewsSourceIds.includes(s.id));
      const allSources = domesticList.map((s) => ({ id: s.id, name: s.name, rssUrl: s.rssUrl }));

      if (allSources.length === 0) {
        setArticles([]);
        setError("키워드 뉴스는 한국경제·매일경제에서만 수집합니다.");
        setLoading(false);
        setHasLoadedOnce(true);
        return;
      }

      setLoadStep("RSS 뉴스 수집 중…");
      const fetchResult = await fetchRssFeeds({
        sources: allSources,
        onProgress: (fetched, tot) => {
          setLoadProgress(10 + Math.round((fetched / tot) * 85));
          setLoadStep(`RSS 수집 중… (${fetched}/${tot})`);
        },
      });

      setLoadProgress(90);
      const allKeywords = keywords;

      if (allKeywords.length === 0) {
        setArticles([]);
        setError("설정 > 기억할 관심사(국내)에 키워드를 입력해주세요.");
        setLoading(false);
        setHasLoadedOnce(true);
        return;
      }

      const { articles: raw, error: fetchErr } = fetchResult;
      if (fetchErr) {
        setError(fetchErr);
        setArticles([]);
        setLoading(false);
        setHasLoadedOnce(true);
        return;
      }

      setLoadStep("키워드 필터링 중…");
      setLoadProgress(97);

      const { articles: matched } = filterArticlesByRangeTiered(raw, (filtered) => {
        const m = filtered
          .filter((a) => matchesKeyword(a.title, allKeywords) || (a.body && matchesKeyword(a.body, allKeywords)))
          .filter((a) => !isScrapped(a.link));
        m.sort((a, b) => {
          const da = new Date(a.pubDate).getTime();
          const db = new Date(b.pubDate).getTime();
          return db - da;
        });
        return deduplicateBySimilarity(m).slice(0, 8);
      });
      setLoadProgress(100);
      setArticles(matched);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
      setArticles([]);
    }
    setLoading(false);
    setHasLoadedOnce(true);
  }, []);

  return (
    <KeywordNewsContext.Provider
      value={{ articles, loading, error, loadProgress, loadStep, hasLoadedOnce, load }}
    >
      {children}
    </KeywordNewsContext.Provider>
  );
}

export function useKeywordNews() {
  const ctx = useContext(KeywordNewsContext);
  if (!ctx) throw new Error("useKeywordNews must be used within KeywordNewsProvider");
  return ctx;
}
