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
  aiModel: "gemini" | "gpt" | "claude";
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
  aiModel?: "gemini" | "gpt" | "claude";
  /** AI 요약 (요약하기 버튼 클릭 후 고정 저장) */
  aiSummary?: string;
  /** 업로드된 이미지 (data=base64 로컬, url=Cloudinary URL 클라우드) */
  uploadedImages?: { data?: string; mimeType?: string; name?: string; url?: string }[];
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

// 국내 언론사 (매일경제 직접 RSS 우선 - 구글뉴스 리다이렉트 대체)
export const domesticSources: NewsSource[] = [
  { id: "gn_hankyung", name: "한국경제", rssUrl: toGoogleNewsRssUrl("hankyung.com") },
  { id: "rss_mk_headline", name: "매일경제 헤드라인", rssUrl: "https://www.mk.co.kr/rss/30000001/" },
  { id: "rss_mk_economy", name: "매일경제 경제", rssUrl: "https://www.mk.co.kr/rss/30100041/" },
  { id: "rss_mk_stock", name: "매일경제 증권", rssUrl: "https://www.mk.co.kr/rss/50200011/" },
  { id: "gn_sbs", name: "SBS 경제", rssUrl: toGoogleNewsRssUrlEconomy("sbs.co.kr") },
  { id: "yna_economy", name: "연합뉴스 경제", rssUrl: "https://www.yna.co.kr/rss/economy.xml" },
];

/** 국내 언론사 기사가 해외 시황에 반영되려면 이 키워드 중 1개 이상 포함 */
export const DOMESTIC_OVERSEAS_MARKET_KEYWORDS = [
  "뉴욕증시",
  "나스닥",
  "S&P500",
  "장을 마쳤다",
  "뉴욕증권거래소",
  "NYSE",
  "시황",
];

/** 오늘의 뉴스 검색 - 5대 핵심 키워드 필터 */
export const NEWS_SEARCH_KEYWORDS = ["S&P500", "나스닥", "뉴욕증시", "장을 마감", "장을 마쳤다", "NYSE"] as const;

/** 제목+본문에 5대 키워드 1개 이상 포함 시 검색 결과에 포함 */
export function matchesNewsSearchKeywords(title: string, body?: string): boolean {
  const text = `${title} ${body ?? ""}`;
  return NEWS_SEARCH_KEYWORDS.some((kw) => text.includes(kw));
}

export function isDomesticSourceId(id: string): boolean {
  return domesticSources.some((s) => s.id === id);
}

/** 국내 기사가 해외 시황용으로 사용 가능한지 (키워드 매칭) */
export function matchesDomesticForOverseasSummary(title: string, body?: string): boolean {
  const text = `${title} ${body ?? ""}`;
  return DOMESTIC_OVERSEAS_MARKET_KEYWORDS.some((kw) => text.includes(kw));
}

// 해외 시황 (장 마감 후 리포트 위주 - CNBC·MarketWatch·Seeking Alpha 직접 RSS)
export const internationalSources: NewsSource[] = [
  { id: "rss_cnbc_finance", name: "CNBC Finance", rssUrl: "https://www.cnbc.com/id/10000664/device/rss/rss.html" },
  { id: "rss_marketwatch_top", name: "MarketWatch Top Stories", rssUrl: "https://feeds.marketwatch.com/marketwatch/topstories/" },
  { id: "rss_seeking_alpha", name: "Seeking Alpha Market News", rssUrl: "https://seekingalpha.com/market_currents.xml" },
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
