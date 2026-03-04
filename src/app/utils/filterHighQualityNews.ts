/**
 * [뉴스 데이터 전처리 및 고품질 기사 선별 규칙]
 * AI 분석 모델로 넘기기 전 적용하는 5가지 규칙
 */

import type { RawRssArticle } from "./fetchRssFeeds";

export interface NewsArticle extends RawRssArticle {
  /** 본문(description) - RSS에 있을 경우 */
  body?: string;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  /** 국내(.KS/.KQ)인지. 없으면 symbol로 유추 */
  isDomestic?: boolean;
}

function isDomesticSymbol(symbol: string): boolean {
  return symbol.endsWith(".KS") || symbol.endsWith(".KQ");
}

// 규칙 2: 클릭베이트 차단 블랙리스트
const CLICKBAIT_BLACKLIST = [
  "초대박", "폭등", "폭락", "무조건", "찌라시", "루머", "개미들 눈물",
  "테마주 급등", "급등주", "대박", "반전", "쇼크", "충격", "헬게이트",
  "눈물", "피눈물", "발칵", "떡상", "떡락", "우주", "달빛", "꿀잼",
  "뇌동매매", "손절", "물타기", "갈매기", "찌라시", "사기",
];

// 규칙 3: 공식 가이던스/월가 키워드 (가중치용)
const OFFICIAL_GUIDANCE_KEYWORDS = [
  "실적", "가이던스", "어닝", "earnings", "guidance", "잠정실적",
  "모건스탠리", "골드만삭스", "Morgan Stanley", "Goldman Sachs",
  "업그레이드", "다운그레이드", "upgrade", "downgrade", "목표가",
  "연준", "Fed", "중앙은행", "금리", "CPI", "기준금리",
  "분기실적", "연말실적", "실적발표", "컨센서스",
];

// 규칙 4: 핵심 테마 키워드 (2순위)
const CORE_THEME_KEYWORDS = [
  "AI", "인공지능", "반도체", "半导体", "semiconductor", "GPU", "NVIDIA",
  "전력", "인프라", "인프라스트럭처", "방산", "우주", "항공",
  "지정학", "글로벌 공급망", "G7", "수소", "배터리", "전기차", "EV",
  "클라우드", "데이터센터", "5G", "통신",
];

// 빅테크 M7 + AI테크 기업 (기사 우선 포함 대상)
const BIG_TECH_M7_KEYWORDS = [
  "Nvidia", "NVDA", "엔비디아", "Apple", "AAPL", "애플", "Microsoft", "MSFT", "마이크로소프트",
  "Google", "GOOGL", "Alphabet", "알파벳", "구글", "Amazon", "AMZN", "아마존",
  "Meta", "META", "메타", "Facebook", "페이스북", "Tesla", "TSLA", "테슬라",
  "AMD", "Palantir", "PLTR", "팔란티어", "Broadcom", "AVGO", "Qualcomm", "QCOM",
  "Oracle", "ORCL", "Salesforce", "CRM", "Adobe", "ADBE", "Netflix", "NFLX", "넷플릭스",
  "Intel", "INTC", "인텔", "Micron", "MU", "Super Micro", "SMCI",
];

/** 규칙 2: 클릭베이트 체크 → 포함 시 true (폐기 대상) */
function hasClickbait(title: string, body: string = ""): boolean {
  const text = `${title} ${body}`.toLowerCase();
  return CLICKBAIT_BLACKLIST.some((kw) => text.includes(kw.toLowerCase()));
}

/** 규칙 2: 추측성 표현 체크 (업계 관계자 등) - 가중치 감소용 */
function hasSpeculativePhrase(title: string, body: string = ""): boolean {
  const text = `${title} ${body}`;
  return /업계\s*관계자|관계자에\s*따르면|추정되|전망되|설\s*정치/i.test(text);
}

/** 규칙 1: 수치/팩트 존재 여부 */
function hasFactAndFigure(title: string, body: string = ""): boolean {
  const text = `${title} ${body}`;
  // 재무/경제 수치 패턴: %, 원, 달러, 배수, 퍼센트, EPS, 매출, CPI 등
  const patterns = [
    /\d+%|\d+\s*퍼센트|%\s*(상승|하락|증가|감소)/i,
    /[\d,]+원|[\d,.]+\s*달러|\$[\d,.]+/,
    /EPS|PER|PBR|ROE|매출|영업이익|순이익|마진율/i,
    /CPI|GDP|금리|실업률|기준금리/i,
    /[\d,.]+\s*%|목표가\s*[\d,]+/,
  ];
  return patterns.some((p) => p.test(text));
}

/** 규칙 3: 공식 가이던스/월가 키워드 점수 */
function getOfficialGuidanceScore(title: string, body: string = ""): number {
  const text = `${title} ${body}`;
  return OFFICIAL_GUIDANCE_KEYWORDS.filter(
    (kw) => text.toLowerCase().includes(kw.toLowerCase())
  ).length;
}

/** 규칙 4: 관심 종목 일치 점수 (1순위) - 국내/해외 모드에 맞는 종목만 반영 */
function getWatchlistScore(
  title: string,
  body: string,
  watchlist: WatchlistItem[],
  isInternational: boolean
): number {
  if (watchlist.length === 0) return 0;
  const text = `${title} ${body}`;
  let score = 0;
  for (const w of watchlist) {
    const domestic = w.isDomestic ?? isDomesticSymbol(w.symbol);
    if (isInternational !== domestic) continue;
    if (text.includes(w.name) || text.includes(w.symbol)) score += 80;
    else if (text.includes(w.name.split(/\s/)[0])) score += 40;
  }
  return score;
}

/** 관심 키워드(메모리) 일치 점수 - 사용자가 입력한 섹터·기업 키워드 */
function getInterestKeywordScore(title: string, body: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const text = `${title} ${body}`.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (kw.length < 2) continue;
    if (text.includes(kw.toLowerCase())) score += 60;
  }
  return score;
}

/** 규칙 4: 핵심 테마 점수 (2순위) */
function getThemeScore(title: string, body: string = ""): number {
  const text = `${title} ${body}`;
  return CORE_THEME_KEYWORDS.filter(
    (kw) => text.toLowerCase().includes(kw.toLowerCase())
  ).length;
}

/** 빅테크 M7·AI테크 기업 언급 점수 (우선 포함) */
function getBigTechM7Score(title: string, body: string = ""): number {
  const text = `${title} ${body}`;
  return BIG_TECH_M7_KEYWORDS.filter(
    (kw) => text.toLowerCase().includes(kw.toLowerCase())
  ).length * 8; // 빅테크 기사 강하게 우선
}

/** 간단한 텍스트 토큰화 (공백/한글 단위) */
function tokenize(text: string): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[^\w가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((s) => s.length > 1);
  return new Set(normalized);
}

/** 규칙 5: 두 기사 간 유사도 (Jaccard, 0~1) */
function similarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) {
    if (tb.has(t)) inter++;
  }
  return inter / (ta.size + tb.size - inter);
}

/** 0.55 = 유사도 55% 이상일 때만 중복으로 간주. 과도한 통폐합 방지 (기사 다수 유지) */
const SIMILARITY_THRESHOLD = 0.55;

/**
 * 규칙 5: 클러스터링 후 대표 기사 1개 선별
 * (정보량 + 팩트 점수 기반으로 대표 선택)
 */
function deduplicate(
  articles: (NewsArticle & { _score: number })[],
  threshold = SIMILARITY_THRESHOLD
): (NewsArticle & { _score: number })[] {
  const result: (NewsArticle & { _score: number })[] = [];
  const used = new Set<number>();

  for (let i = 0; i < articles.length; i++) {
    if (used.has(i)) continue;
    const a = articles[i];
    const cluster = [i];
    const aText = `${a.title} ${a.body ?? ""}`;

    for (let j = i + 1; j < articles.length; j++) {
      if (used.has(j)) continue;
      const b = articles[j];
      const bText = `${b.title} ${b.body ?? ""}`;
      if (similarity(aText, bText) >= threshold) {
        cluster.push(j);
        used.add(j);
      }
    }

    // 클러스터 내 대표: _score가 가장 높은 것 (정보량·팩트 보상 반영)
    let bestIdx = cluster[0];
    let bestScore = articles[bestIdx]._score;
    for (const idx of cluster) {
      if (articles[idx]._score > bestScore) {
        bestScore = articles[idx]._score;
        bestIdx = idx;
      }
    }
    result.push(articles[bestIdx]);
    for (const idx of cluster) used.add(idx);
  }

  return result;
}

/** 유사도 기반 중복 제거만 수행. 정렬된 순서 유지, 클러스터 내 첫 번째 유지. 최대 12건 제한용 */
export function deduplicateBySimilarity<T extends { title: string; body?: string }>(
  articles: T[],
  threshold = SIMILARITY_THRESHOLD
): T[] {
  const result: T[] = [];
  const used = new Set<number>();

  for (let i = 0; i < articles.length; i++) {
    if (used.has(i)) continue;
    const a = articles[i];
    const cluster = [i];
    const aText = `${a.title} ${a.body ?? ""}`;

    for (let j = i + 1; j < articles.length; j++) {
      if (used.has(j)) continue;
      const b = articles[j];
      const bText = `${b.title} ${b.body ?? ""}`;
      if (similarity(aText, bText) >= threshold) {
        cluster.push(j);
        used.add(j);
      }
    }
    result.push(articles[cluster[0]]);
    for (const idx of cluster) used.add(idx);
  }
  return result;
}

/** 경제·금융 분야 지표 (이 중 하나라도 없으면 국내 시황에서 제외) */
const ECONOMY_SECTOR_KEYWORDS = [
  "주가", "주식", "증시", "코스피", "코스닥", "KOSPI", "KOSDAQ", "종목", "테마주",
  "금리", "연준", "Fed", "기준금리", "CPI", "물가", "인플레이션", "GDP",
  "실적", "매출", "영업이익", "순이익", "가이던스", "어닝", "EPS", "실적발표",
  "경제", "금융", "증권", "증권사", "은행", "환율", "원달러", "수출", "무역",
  "M&A", "인수", "인수합병", "IPO", "상장", "배당", "합병", "공모",
  "반도체", "AI", "전기차", "EV", "배터리", "2차전지", "바이오", "헬스케어",
  "부동산", "건설", "금융지주", "보험", "산업", "기업", "재벌", "대기업",
  "석유", "유가", "원유", "금값", "원자재", "원료", "전력", "인프라",
  "증권가", "시장", "투자", "펀드", "연기금", "금감원", "증선", "금융위",
  "삼성", "SK", "하이닉스", "현대", "기아", "네이버", "카카오", "쿠팡", "LG", "포스코",
];

/** 기사가 경제 분야인지 (제목+본문에 경제 지표 키워드 1개 이상) */
function isEconomySectorArticle(title: string, body: string): boolean {
  const text = `${title} ${body}`;
  return ECONOMY_SECTOR_KEYWORDS.some((kw) => text.includes(kw));
}

/** 한국 언론사 기사에서 순수 해외소식(한국 기업 무관) 제외용 키워드 */
const KOREAN_COMPANY_INDICATORS = [
  "삼성", "SK", "하이닉스", "현대", "기아", "네이버", "카카오", "쿠팡", "LG", "POSCO", "포스코",
  "에코프로", "셀리버리", "피엔티", "제넥신", "로보티즈", "유니셈", "한화", "두산", "현대차",
  "코스피", "코스닥", "국내", "한국", "서울", "수출", "원화", "한국은행", "금융위",
];
/** 순수 해외 주제 키워드 (이만 있고 한국 기업 없으면 제외) */
const OVERSEAS_ONLY_INDICATORS = [
  "엔비디아", "Nvidia", "NVDA", "애플", "Apple", "AAPL", "테슬라", "Tesla", "TSLA",
  "마이크로소프트", "Microsoft", "MSFT", "구글", "Google", "아마존", "Amazon", "메타", "Meta",
  "S&P500", "나스닥", "NASDAQ", "다우존스", "Fed", "연준", "FOMC", "파월",
];

function isOverseasOnlyArticle(title: string, body: string): boolean {
  const text = `${title} ${body}`;
  const hasKorean = KOREAN_COMPANY_INDICATORS.some((k) => text.includes(k));
  if (hasKorean) return false;
  return OVERSEAS_ONLY_INDICATORS.some((k) => text.includes(k));
}

export interface FilterOptions {
  watchlist: WatchlistItem[];
  /** 사용자 메모리에서 파싱한 관심 키워드 (섹터·기업명 등) */
  interestKeywords?: string[];
  /** true=해외, false=국내. 국내 시 한국언론사의 순수 해외소식 제외 */
  isInternational?: boolean;
}

/**
 * 5가지 규칙을 적용하여 고품질 기사만 필터링·정렬
 */
export function filterHighQualityNews(
  articles: NewsArticle[],
  options: FilterOptions
): NewsArticle[] {
  const { watchlist, interestKeywords = [], isInternational = true } = options;

  // 규칙 2: 클릭베이트 즉시 폐기
  let afterClickbait = articles.filter((a) => !hasClickbait(a.title, a.body ?? ""));

  // 국내 시: 경제 분야 외 기사 제외 + 순수 해외소식 제외
  if (!isInternational) {
    afterClickbait = afterClickbait.filter((a) => {
      if (!isEconomySectorArticle(a.title, a.body ?? "")) return false;
      if (isOverseasOnlyArticle(a.title, a.body ?? "")) return false;
      return true;
    });
  }

  // 규칙 1, 3, 4 점수 산출 (관심종목·관심키워드 1순위)
  const scored = afterClickbait.map((a) => {
    const body = a.body ?? "";
    let score = 0;

    score += getWatchlistScore(a.title, body, watchlist, isInternational);
    score += getInterestKeywordScore(a.title, body, interestKeywords); // 사용자 메모리 키워드
    if (hasFactAndFigure(a.title, body)) score += 20;
    if (hasSpeculativePhrase(a.title, body)) score -= 10;

    score += getOfficialGuidanceScore(a.title, body) * 5;
    score += getThemeScore(a.title, body) * 2;
    score += getBigTechM7Score(a.title, body); // 빅테크 M7·AI 기업 기사 우선

    return { ...a, _score: Math.max(0, score) };
  });

  // 점수 기준 정렬 (높은 순)
  const sorted = [...scored].sort((a, b) => b._score - a._score);

  // 규칙 5: 중복 제거
  const deduped = deduplicate(sorted);

  return deduped.map(({ _score, ...a }) => a);
}
