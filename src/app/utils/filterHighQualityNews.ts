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

/** 규칙 4: 관심 종목 일치 점수 (1순위) */
function getWatchlistScore(
  title: string,
  body: string,
  watchlist: WatchlistItem[]
): number {
  if (watchlist.length === 0) return 0;
  const text = `${title} ${body}`;
  let score = 0;
  for (const w of watchlist) {
    if (text.includes(w.name) || text.includes(w.symbol)) score += 10;
    if (text.includes(w.name.split(/\s/)[0])) score += 5; // "삼성" 등
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

const SIMILARITY_THRESHOLD = 0.35;

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

export interface FilterOptions {
  watchlist: WatchlistItem[];
}

/**
 * 5가지 규칙을 적용하여 고품질 기사만 필터링·정렬
 */
export function filterHighQualityNews(
  articles: NewsArticle[],
  options: FilterOptions
): NewsArticle[] {
  const { watchlist } = options;

  // 규칙 2: 클릭베이트 즉시 폐기
  const afterClickbait = articles.filter(
    (a) => !hasClickbait(a.title, a.body)
  );

  // 규칙 1, 3, 4 점수 산출
  const scored = afterClickbait.map((a) => {
    const body = a.body ?? "";
    let score = 0;

    if (hasFactAndFigure(a.title, body)) score += 20;
    if (hasSpeculativePhrase(a.title, body)) score -= 10;

    score += getOfficialGuidanceScore(a.title, body) * 5;
    score += getWatchlistScore(a.title, body, watchlist);
    score += getThemeScore(a.title, body) * 2;

    return { ...a, _score: Math.max(0, score) };
  });

  // 점수 기준 정렬 (높은 순)
  const sorted = [...scored].sort((a, b) => b._score - a._score);

  // 규칙 5: 중복 제거
  const deduped = deduplicate(sorted);

  return deduped.map(({ _score, ...a }) => a);
}
