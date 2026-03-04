import type { MarketSummaryData } from "./marketSummary";

export interface NewsSource {
  id: string;
  name: string;
  rssUrl: string;
}

export interface Article {
  id: string;
  title: string;
  source: string;
  sourceId: string;
  publishedAt: string; // ISO8601
  url: string;
  summary: string;
  aiModel: "gemini" | "claude";
  category: string;
  isInternational: boolean;
}

export interface ArchiveSession {
  id: string;
  title: string; // "3월 4일 오전 09:30 · 해외 시황"
  createdAt: string;
  isInternational: boolean;
  sources: string[]; // sourceId 배열
  articles: Article[];
  /** 생성된 시황 요약 데이터 (표시용) */
  marketSummary?: MarketSummaryData;
  aiModel?: "gemini" | "claude";
}

// 국내 언론사
export const domesticSources: NewsSource[] = [
  { id: "hankyung_all", name: "한국경제 종합", rssUrl: "https://www.hankyung.com/feed/all-news" },
  { id: "hankyung_finance", name: "한국경제 증권", rssUrl: "https://www.hankyung.com/feed/finance" },
  { id: "mk", name: "매일경제", rssUrl: "https://www.mk.co.kr/rss/30100041" },
  { id: "sbs", name: "SBS", rssUrl: "https://news.sbs.co.kr/news/newsflashRssFeed.do?plink=RSSREADER" },
];

// 해외 언론사 (3대지수는 Yahoo Finance에서만 자료 가져오기)
export const internationalSources: NewsSource[] = [
  { id: "yahoofinance", name: "Yahoo Finance", rssUrl: "https://finance.yahoo.com/news/rssindex" },
  { id: "cnbc_investing", name: "CNBC Investing", rssUrl: "https://www.cnbc.com/id/10001147/device/rss/rss.html" },
  { id: "cnbc_tech", name: "CNBC Technology", rssUrl: "https://www.cnbc.com/id/19854910/device/rss/rss.html" },
  { id: "wsj", name: "WSJ Market", rssUrl: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml" },
  { id: "bloomberg", name: "Bloomberg Markets", rssUrl: "https://feeds.bloomberg.com/markets/news.rss" },
];

// Mock articles (개발용)
export const mockArticles: Article[] = [
  {
    id: "a1",
    title: "S&P500, 장 마감 0.3% 상승… 반도체주 강세",
    source: "Yahoo Finance",
    sourceId: "yahoofinance",
    publishedAt: "2026-03-04T03:30:00Z",
    url: "https://example.com/1",
    summary: "S&P500이 반도체주 상승에 힘입어 소폭 상승하며 마감했음.",
    aiModel: "gemini",
    category: "Economy",
    isInternational: true,
  },
  {
    id: "a2",
    title: "엔비디아, AI 수요 급증으로 실적 서프라이즈",
    source: "CNBC",
    sourceId: "cnbc_investing",
    publishedAt: "2026-03-04T02:15:00Z",
    url: "https://example.com/2",
    summary: "엔비디아가 예상 대비 높은 실적을 발표하며 주가가 급등했음.",
    aiModel: "claude",
    category: "Tech",
    isInternational: true,
  },
];
