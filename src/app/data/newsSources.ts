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
  aiModel: "gemini" | "gpt";
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
  aiModel?: "gemini" | "gpt";
}

/** 구글뉴스 RSS URL 생성 - 국내 (site:로 언론사 지정) */
export function toGoogleNewsRssUrl(site: string): string {
  const q = encodeURIComponent(`site:${site}`);
  return `https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`;
}

/** 구글뉴스 RSS URL 생성 - 국내 경제/금융 검색 (일반 언론사용) */
export function toGoogleNewsRssUrlEconomy(site: string): string {
  const q = encodeURIComponent(`site:${site} 경제 OR 금융`);
  return `https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`;
}

/** 구글뉴스 RSS URL 생성 - 해외 (영문·미국 기준) */
export function toGoogleNewsRssUrlIntl(site: string): string {
  const q = encodeURIComponent(`site:${site}`);
  return `https://news.google.com/rss/search?q=${q}&hl=en&gl=US&ceid=US:en`;
}

// 국내 언론사 (경제 섹션 전용 RSS 우선 - 연예/사회 기사 원천 차단)
export const domesticSources: NewsSource[] = [
  { id: "gn_hankyung", name: "한국경제", rssUrl: toGoogleNewsRssUrl("hankyung.com") },
  { id: "gn_mk", name: "매일경제", rssUrl: toGoogleNewsRssUrl("mk.co.kr") },
  { id: "gn_sbs", name: "SBS 경제", rssUrl: toGoogleNewsRssUrlEconomy("sbs.co.kr") },
  { id: "yna_economy", name: "연합뉴스 경제", rssUrl: "https://www.yna.co.kr/rss/economy.xml" },
];

// 해외 언론사
export const internationalSources: NewsSource[] = [
  { id: "finnhub", name: "Finnhub 뉴스", rssUrl: "https://finnhub.io/api/v1/news" },
  { id: "gn_cnbc", name: "CNBC", rssUrl: toGoogleNewsRssUrlIntl("cnbc.com") },
  { id: "gn_wsj", name: "WSJ", rssUrl: toGoogleNewsRssUrlIntl("wsj.com") },
  { id: "gn_bloomberg", name: "Bloomberg", rssUrl: toGoogleNewsRssUrlIntl("bloomberg.com") },
  { id: "gn_reuters", name: "Reuters", rssUrl: toGoogleNewsRssUrlIntl("reuters.com") },
  { id: "gn_yahoo", name: "Yahoo Finance", rssUrl: toGoogleNewsRssUrlIntl("finance.yahoo.com") },
  { id: "gn_investing", name: "Investing.com", rssUrl: toGoogleNewsRssUrlIntl("investing.com") },
  { id: "gn_marketwatch", name: "MarketWatch", rssUrl: toGoogleNewsRssUrlIntl("marketwatch.com") },
];

// Mock articles (개발용)
export const mockArticles: Article[] = [
  {
    id: "a1",
    title: "S&P500, 장 마감 0.3% 상승… 반도체주 강세",
    source: "Yahoo Finance",
    sourceId: "gn_yahoo",
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
    sourceId: "gn_cnbc",
    publishedAt: "2026-03-04T02:15:00Z",
    url: "https://example.com/2",
    summary: "엔비디아가 예상 대비 높은 실적을 발표하며 주가가 급등했음.",
    aiModel: "gpt",
    category: "Tech",
    isInternational: true,
  },
];
