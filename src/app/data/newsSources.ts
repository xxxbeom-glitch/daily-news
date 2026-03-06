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

// 국내 언론사 (경제)
const _domesticSources: NewsSource[] = [
  { id: "gn_hankyung", name: "한국경제", rssUrl: toGoogleNewsRssUrl("hankyung.com") },
  { id: "rss_mk_headline", name: "매일경제 헤드라인", rssUrl: "https://www.mk.co.kr/rss/30000001/" },
  { id: "rss_mk_economy", name: "매일경제 경제", rssUrl: "https://www.mk.co.kr/rss/30100041/" },
  { id: "rss_mk_stock", name: "매일경제 증권", rssUrl: "https://www.mk.co.kr/rss/50200011/" },
  { id: "gn_sbs", name: "SBS 경제", rssUrl: toGoogleNewsRssUrlEconomy("sbs.co.kr") },
  { id: "yna_economy", name: "연합뉴스 경제", rssUrl: "https://www.yna.co.kr/rss/economy.xml" },
  { id: "rss_khan_economy", name: "경향신문 경제", rssUrl: "https://www.khan.co.kr/rss/rssdata/economy_news.xml" },
  { id: "rss_kmib_economy", name: "국민일보 경제", rssUrl: "https://rss.kmib.co.kr/data/kmibEcoRss.xml" },
  { id: "rss_newsis_bank", name: "뉴시스 금융", rssUrl: "https://newsis.com/RSS/bank.xml" },
  { id: "rss_newsis_economy", name: "뉴시스 경제", rssUrl: "https://newsis.com/RSS/economy.xml" },
  { id: "rss_newsis_industry", name: "뉴시스 산업", rssUrl: "https://newsis.com/RSS/industry.xml" },
  { id: "rss_donga_economy", name: "동아일보 경제", rssUrl: "https://rss.donga.com/economy.xml" },
  { id: "rss_mediatoday_economy", name: "미디어오늘 경제", rssUrl: "https://www.mediatoday.co.kr/rss/S1N3.xml" },
  { id: "rss_seoul_economy", name: "서울신문 경제", rssUrl: "https://www.seoul.co.kr/xml/rss/rss_economy.xml" },
  { id: "rss_sisain_economy", name: "시사인 경제", rssUrl: "https://www.sisain.co.kr/rss/S1N7.xml" },
  { id: "rss_sisajournal_economy", name: "시사저널 경제", rssUrl: "https://www.sisajournal.com/rss/S1N54.xml" },
  { id: "rss_ablenews_economy", name: "에이블뉴스 노동/경제", rssUrl: "https://www.ablenews.co.kr/rss/S1N4.xml" },
  { id: "rss_womennews_economy", name: "여성신문 경제", rssUrl: "https://www.womennews.co.kr/rss/S1N4.xml" },
  { id: "rss_chosun_economy", name: "조선일보 경제", rssUrl: "https://www.chosun.com/arc/outboundfeeds/rss/category/economy/?outputType=xml" },
  { id: "rss_cj_economy", name: "천지일보 경제", rssUrl: "https://cdn.newscj.com/rss/gns_S1N2.xml" },
  { id: "rss_pressian_economy", name: "프레시안 경제", rssUrl: "https://www.pressian.com/api/v3/site/rss/section/67" },
  { id: "rss_hani_economy", name: "한겨레신문 경제", rssUrl: "https://www.hani.co.kr/rss/economy/" },
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

const DOMESTIC_SOURCE_IDS = new Set(_domesticSources.map((s) => s.id));

export function isDomesticSourceId(id: string): boolean {
  return DOMESTIC_SOURCE_IDS.has(id);
}

/** 국내 기사가 해외 시황용으로 사용 가능한지 (키워드 매칭) */
export function matchesDomesticForOverseasSummary(title: string, body?: string): boolean {
  const text = `${title} ${body ?? ""}`;
  return DOMESTIC_OVERSEAS_MARKET_KEYWORDS.some((kw) => text.includes(kw));
}

// 해외 시황 (CNBC·MarketWatch·Seeking Alpha + 국내 언론사 국제 섹션)
const _internationalSources: NewsSource[] = [
  { id: "rss_cnbc_finance", name: "CNBC Finance", rssUrl: "https://www.cnbc.com/id/10000664/device/rss/rss.html" },
  { id: "rss_marketwatch_top", name: "MarketWatch Top Stories", rssUrl: "https://feeds.marketwatch.com/marketwatch/topstories/" },
  { id: "rss_seeking_alpha", name: "Seeking Alpha Market News", rssUrl: "https://seekingalpha.com/market_currents.xml" },
  { id: "rss_khan_international", name: "경향신문 국제", rssUrl: "https://www.khan.co.kr/rss/rssdata/kh_world.xml" },
  { id: "rss_kmib_international", name: "국민일보 국제", rssUrl: "https://rss.kmib.co.kr/data/kmibIntRss.xml" },
  { id: "rss_newsis_international", name: "뉴시스 국제", rssUrl: "https://newsis.com/RSS/international.xml" },
  { id: "rss_donga_international", name: "동아일보 국제", rssUrl: "https://rss.donga.com/international.xml" },
  { id: "rss_mediatoday_international", name: "미디어오늘 국제", rssUrl: "https://www.mediatoday.co.kr/rss/S1N6.xml" },
  { id: "rss_seoul_international", name: "서울신문 국제", rssUrl: "https://www.seoul.co.kr/xml/rss/rss_international.xml" },
  { id: "rss_sisain_international", name: "시사인 국제/한반도", rssUrl: "https://www.sisain.co.kr/rss/S1N11.xml" },
  { id: "rss_sisajournal_international", name: "시사저널 국제", rssUrl: "https://www.sisajournal.com/rss/S1N59.xml" },
  { id: "rss_womennews_international", name: "여성신문 세계", rssUrl: "https://www.womennews.co.kr/rss/S1N3.xml" },
  { id: "rss_chosun_international", name: "조선일보 국제", rssUrl: "https://www.chosun.com/arc/outboundfeeds/rss/category/international/?outputType=xml" },
];

export const domesticSources = _domesticSources;
export const internationalSources = _internationalSources;

/** 통합 RSS 소스 (국내·해외 구분 없음) */
export const allSources: NewsSource[] = [..._domesticSources, ..._internationalSources];

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
