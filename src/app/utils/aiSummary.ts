/**
 * AI API (Gemini/OpenAI GPT)를 이용한 시황 요약 생성
 */

import type { MarketSummaryData, IssueItem, StockMover, IndexData, SourceRef, EarningsItem } from "../data/marketSummary";

export interface RawRssArticle {
  title: string;
  link: string;
  pubDate: string;
  sourceId: string;
  sourceName: string;
  body?: string;
}

const GEMINI_MODELS = ["gemini-3.1-pro-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"];
const OPENAI_MODEL = "gpt-4o-mini";

function buildArticleContext(articles: RawRssArticle[], maxItems = 25): string {
  return articles
    .slice(0, maxItems)
    .map((a, i) => `${i + 1}. [${a.sourceName}] ${a.title}${a.body ? `\n   본문: ${a.body.slice(0, 200)}` : ""}`)
    .join("\n");
}

function isDomesticSymbol(sym: string): boolean {
  return sym.endsWith(".KS") || sym.endsWith(".KQ");
}

/** 기사 수가 이 값 미만이면 sparse(희소) 모드 - moversSeed·시장 데이터 비중 확대 */
const SPARSE_ARTICLE_THRESHOLD = 5;

/** 해외 시황 헤드라인 기사 필터 키워드 */
export const HEADLINE_KEYWORDS = [
  "S&P500", "나스닥", "장을 마감", "뉴욕 증시", "NYSE",
  "뉴욕증시", "나스닥종합", "다우존스", "뉴욕증권거래소", "뉴욕상업거래소",
  "장을 마쳤다", "시황",
  "미국 증시", "월가", "뉴욕", "증시",
];

function buildPrompt(
  articles: RawRssArticle[],
  isInternational: boolean,
  opts?: {
    watchlist?: { symbol: string; name: string; isDomestic?: boolean }[];
    moversSeed?: { up: { name: string; ticker: string; changeRate: string }[]; down: { name: string; ticker: string; changeRate: string }[] };
    interestMemory?: string;
    includeTotalAssessment?: boolean;
    /** 해외 전용: 키워드 필터된 실제 RSS 기사 (제목/언론사는 AI가 만들지 않고 이 배열에서 그대로 사용) */
    headlineRssArticles?: RawRssArticle[];
  }
): string {
  const watchlist = opts?.watchlist;
  const moversSeed = opts?.moversSeed;
  const interestMemory = opts?.interestMemory;
  const includeTotalAssessment = opts?.includeTotalAssessment ?? false;
  const headlineRssArticles = opts?.headlineRssArticles ?? [];
  const isSparseArticles = articles.length < SPARSE_ARTICLE_THRESHOLD;
  const region = isInternational ? "해외(미국·글로벌)" : "국내(한국)";
  const articleList = buildArticleContext(articles, isSparseArticles ? 50 : 25);

  const relevantWatchlist = (watchlist ?? []).filter((w) => {
    const domestic = w.isDomestic ?? isDomesticSymbol(w.symbol);
    return isInternational !== domestic;
  });
  const watchlistSection =
    relevantWatchlist.length > 0
      ? `\n## 관심종목\n뉴스에 아래 기업 관련 내용이 있으면 totalAssessment에 간략히 언급.\n${relevantWatchlist.map((w) => `${w.name}(${w.symbol})`).join(", ")}\n`
      : "";

  const memorySection =
    interestMemory && interestMemory.trim().length > 0
      ? `\n## 사용자 관심사\n${interestMemory.trim()}\n`
      : "";

  const moversSection = isInternational && moversSeed && (moversSeed.up.length > 0 || moversSeed.down.length > 0)
    ? `\n## M7 및 반도체주 등락 (각 기업별 reason 필수)\nmoversUp/moversDown에 아래 종목 그대로 사용. 각 reason: 명사형 종결(~함/~됨/~임) 필수. 2줄 이상 구체적으로. 요약만 하지 말 것.\n상승: ${moversSeed.up.map((m) => `${m.name}(${m.ticker}) ${m.changeRate}`).join(", ")}\n하락: ${moversSeed.down.map((m) => `${m.name}(${m.ticker}) ${m.changeRate}`).join(", ")}\n`
    : "";

  const sparseSection = isSparseArticles
    ? `\n## [기사 부족 시 주의] 기사 수가 매우 적습니다(${articles.length}편). moversSeed(등락 종목)·시장 지수 데이터를 우선 활용하세요.\n`
    : "";

  const analysisStyle = "기사들을 종합하여 시장 추세를 분석하세요. 기사 원문에 있는 내용만 활용하고, 없는 사건을 지어내지 마세요.";

  const headlineContext = headlineRssArticles.length > 0
    ? `\n## 참고: 수집된 실시간 기사 목록 (제목/출처 변경 금지)\n${headlineRssArticles.slice(0, 15).map((a, i) => `[${i}] [${a.sourceName}] ${a.title}${a.body ? `\n   본문요약: ${a.body.slice(0, 200)}` : ""}`).join("\n")}\n`
    : "";

  return `아래는 ${region} 금융·경제 뉴스 헤드라인입니다. 이 기사들을 분석하여 시황 요약 JSON을 생성해주세요.${watchlistSection}${memorySection}${moversSection}${sparseSection}${headlineContext}

## 뉴스 헤드라인
${articleList}

## 요청
위 기사들을 바탕으로 시황 요약을 작성하세요. ${analysisStyle}
반드시 아래 JSON 형식으로만 응답하고, 다른 텍스트는 포함하지 마세요.

### [최우선] 데이터 우선주의
- **실데이터(지수 종가) > 텍스트**. 지수가 실제로 올랐다면 반드시 상승 표현 사용.
- 등락률 > 0: '상승·반등·강세·호조'만 사용 / < 0: '하락·약세·조정·후퇴'만 사용.
- 기사에 없는 사건·발언·법안을 임의로 추가하지 마세요.

### 필수 규칙
- 문체: totalAssessment만 서술형·존댓말 허용. 기사 원문에 없는 내용 지어내지 마세요.
- 모든 문자열: 한글로. 기업 표기: "기업명(티커)"
${includeTotalAssessment ? `- totalAssessment: [필수] 아나운서 브리핑 방식 서술형·존댓말. 수집된 기사 기반으로만 작성. 기사에 없는 내용 금지.` : ""}

### JSON 형식 (이 형식으로만 응답, keyIssues·geopoliticalIssues 제외)
${isInternational ? `{
  "date": "YYYY-MM-DD 요요일",
  "regionLabel": "해외 시황 요약",${includeTotalAssessment ? `
  "totalAssessment": "서술형·존댓말로 총평 (수집된 기사 기반)",` : ""}
  "indices": [{ "name": "지수명", "value": "수치", "change": "+0.5%", "changeAbs": "▲12.34", "isUp": true }],
  "indicesSources": [],
  "stockMoversLabel": "M7 및 반도체주 등락율",
  "moversUp": [{ "name": "기업명", "ticker": "TICKER", "changeRate": "+1.5%", "isUp": true, "reason": "reason" }],
  "moversDown": [{ "name": "기업명", "ticker": "TICKER", "changeRate": "-1.2%", "isUp": false, "reason": "reason" }],
  "moversSources": [],
  "geopoliticalLabel": "국제 정세 기사",
  "geopoliticalIssues": [],
  "earningsPast": [],
  "earningsUpcoming": [],
  "earningsSources": []
}` : `{
  "date": "YYYY-MM-DD 요요일",
  "regionLabel": "한국 시장 뉴스",${includeTotalAssessment ? `
  "totalAssessment": "서술형·존댓말로 총평",` : ""}
  "indices": [
    { "name": "코스피", "value": "수치", "change": "+0.5%", "changeAbs": "▲12.34", "isUp": true },
    { "name": "코스닥", "value": "수치", "change": "-0.2%", "changeAbs": "▼1.75", "isUp": false },
    { "name": "코스피 200", "value": "수치", "change": "+0.3%", "changeAbs": "▲2.10", "isUp": true }
  ],
  "indicesSources": [],
  "stockMoversLabel": "",
  "moversUp": [],
  "moversDown": [],
  "moversSources": [],
  "bigTechLabel": "",
  "bigTechIssues": []
}`}

국내 indices: 코스피·코스닥·코스피200 필수 포함. 실적발표(earnings) 제외.
해외 indices: S&P500·나스닥·다우존스 등.
반드시 유효한 JSON만 출력하세요.`;
}

function ensureSourceRefs(items: { outlet?: string; headline?: string }[]): SourceRef[] {
  return items?.map((s) => ({
    outlet: s?.outlet ?? "언론사",
    headline: s?.headline ?? "",
  })) ?? [];
}

function ensureIssueItems(items: { title?: string; body?: string; changeRate?: string }[]): IssueItem[] {
  return items?.map((i) => ({
    title: i?.title ?? "",
    body: i?.body ?? "",
    changeRate: i?.changeRate,
  })) ?? [];
}

function ensureStockMovers(items: { name?: string; ticker?: string; changeRate?: string; isUp?: boolean; reason?: string }[]): StockMover[] {
  return items?.map((m) => ({
    name: m?.name ?? "",
    ticker: m?.ticker ?? "",
    changeRate: m?.changeRate ?? "0%",
    isUp: m?.isUp ?? false,
    reason: m?.reason ?? "",
  })) ?? [];
}

function ensureIndexData(items: { name?: string; value?: string; change?: string; changeAbs?: string; isUp?: boolean }[]): IndexData[] {
  return items?.map((i) => ({
    name: i?.name ?? "",
    value: i?.value ?? "—",
    change: i?.change ?? "0%",
    changeAbs: i?.changeAbs,
    isUp: i?.isUp ?? false,
  })) ?? [];
}

function mergeMoversWithSeed(
  data: MarketSummaryData,
  moversSeed?: { up: { name: string; ticker: string; changeRate: string }[]; down: { name: string; ticker: string; changeRate: string }[] }
): void {
  if (!moversSeed || (!moversSeed.up.length && !moversSeed.down.length)) return;
  const aiReasonByTicker = new Map<string, string>();
  const getTicker = (m: { name?: string; ticker?: string }) => {
    if (m.ticker) return m.ticker;
    const match = (m.name ?? "").match(/\(([A-Za-z0-9.]+)\)/);
    return match ? match[1] : "";
  };
  for (const m of data.moversUp) {
    const t = getTicker(m);
    if (t && m.reason) aiReasonByTicker.set(t, m.reason);
  }
  for (const m of data.moversDown) {
    const t = getTicker(m);
    if (t && m.reason) aiReasonByTicker.set(t, m.reason);
  }
  data.moversUp = moversSeed.up.map((s) => ({
    name: s.name,
    ticker: s.ticker,
    changeRate: s.changeRate,
    isUp: true,
    reason: aiReasonByTicker.get(s.ticker) || "관련 이슈 없음",
  }));
  data.moversDown = moversSeed.down.map((s) => ({
    name: s.name,
    ticker: s.ticker,
    changeRate: s.changeRate,
    isUp: false,
    reason: aiReasonByTicker.get(s.ticker) || "관련 이슈 없음",
  }));
}

function parseAndNormalize(jsonStr: string, isInternational: boolean): MarketSummaryData {
  // JSON 블록만 추출 (마크다운 코드블록 제거)
  let raw = jsonStr.trim();
  const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) raw = codeMatch[1].trim();
  // 괄호 밖 텍스트 제거 (일부 모델이 앞뒤에 설명 추가할 수 있음)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) raw = jsonMatch[0];

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("AI 응답이 유효한 JSON이 아닙니다. 다시 시도해주세요.");
  }
  const now = new Date();
  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
  const dateStr = `${now.getFullYear()}. ${String(now.getMonth() + 1).padStart(2, "0")}. ${String(now.getDate()).padStart(2, "0")} (${weekDays[now.getDay()]})`;

  const totalAssessment = parsed.totalAssessment != null ? String(parsed.totalAssessment).trim() : undefined;
  const data: MarketSummaryData = {
    date: dateStr, // 항상 오늘 날짜
    regionLabel: (() => {
      const raw = (parsed.regionLabel as string) || (isInternational ? "해외 시황 요약" : "한국 시장 뉴스");
      if (isInternational && (raw.includes("글로벌") || raw === "글로벌")) return "해외 시황 요약";
      if (!isInternational && (raw.includes("국내") || raw.includes("시황"))) return "한국 시장 뉴스";
      return raw;
    })(),
    ...(totalAssessment ? { totalAssessment } : {}),
    indices: ensureIndexData((parsed.indices as IndexData[]) ?? []),
    indicesSources: ensureSourceRefs((parsed.indicesSources as SourceRef[]) ?? []),
    keyIssues: [],
    keyIssuesSources: [],
    stockMoversLabel: (parsed.stockMoversLabel as string) ?? (isInternational ? "S&P500" : ""),
    moversUp: ensureStockMovers((parsed.moversUp as StockMover[]) ?? []),
    moversDown: ensureStockMovers((parsed.moversDown as StockMover[]) ?? []),
    moversSources: ensureSourceRefs((parsed.moversSources as SourceRef[]) ?? []),
    bigTechLabel: (parsed.bigTechLabel as string) ?? (isInternational ? "빅테크 & AI 기업 이슈" : "국내 대표·대장주 이슈"),
    bigTechIssues: ensureIssueItems((parsed.bigTechIssues as IssueItem[]) ?? []),
    bigTechSources: ensureSourceRefs((parsed.bigTechSources as SourceRef[]) ?? []),
  };

  if (isInternational && parsed.geopoliticalIssues) {
    data.geopoliticalLabel = "국제 정세 기사";
    data.geopoliticalIssues = ensureIssueItems(parsed.geopoliticalIssues as IssueItem[]);
    data.geopoliticalSources = ensureSourceRefs((parsed.geopoliticalSources as SourceRef[]) ?? []);
  }

  if (isInternational) {
    const earningsRaw = parsed.earningsPast as Array<{ company?: string; ticker?: string; changeRate?: string; result?: string }> | undefined;
    if (earningsRaw && Array.isArray(earningsRaw)) {
      data.earningsPast = earningsRaw
        .filter((e) => e?.company && e?.result)
        .map((e) => ({
          company: String(e.company ?? ""),
          ticker: String(e.ticker ?? ""),
          changeRate: e.changeRate,
          result: String(e.result ?? ""),
        })) as EarningsItem[];
    }
    const upcomingRaw = parsed.earningsUpcoming;
    if (Array.isArray(upcomingRaw) && upcomingRaw.length > 0) {
      data.earningsUpcoming = upcomingRaw.map((s) => String(s ?? "")).filter(Boolean);
    }
    if (parsed.earningsSources) {
      data.earningsSources = ensureSourceRefs((parsed.earningsSources as SourceRef[]) ?? []);
    }
  }

  return data;
}

const CLAUDE_MODELS = ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-5-sonnet-latest"];

function getApiKey(name: "VITE_GEMINI_API_KEY" | "VITE_OPENAI_API_KEY" | "VITE_ANTHROPIC_API_KEY"): string {
  let key = (import.meta.env[name] as string) ?? "";
  key = key.trim().replace(/^["']|["']$/g, "");
  return key;
}

async function callGemini(prompt: string, modelId?: string): Promise<string> {
  const key = getApiKey("VITE_GEMINI_API_KEY");
  if (!key) {
    throw new Error("Gemini API 키가 설정되지 않았습니다. .env에 VITE_GEMINI_API_KEY를 추가해주세요.");
  }

  const models = modelId && GEMINI_MODELS.includes(modelId) ? [modelId] : GEMINI_MODELS;
  let lastError: Error | null = null;
  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        lastError = new Error((err as { error?: { message?: string } }).error?.message || `HTTP ${res.status}`);
        continue;
      }

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text) {
        lastError = new Error("Gemini가 응답을 생성하지 못했습니다.");
        continue;
      }
      return text;
    } catch (e) {
      clearTimeout(timeout);
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("Gemini API 호출 실패");
}

async function callClaude(prompt: string, modelId?: string): Promise<string> {
  const key = getApiKey("VITE_ANTHROPIC_API_KEY");
  if (!key) {
    throw new Error("Claude API 키가 설정되지 않았습니다. .env에 VITE_ANTHROPIC_API_KEY를 추가해주세요.");
  }
  const model = modelId && CLAUDE_MODELS.includes(modelId) ? modelId : CLAUDE_MODELS[0];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: { message?: string } }).error?.message || `HTTP ${res.status}`);
    }
    const json = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = json?.content?.[0]?.text ?? "";
    if (!text) throw new Error("Claude가 응답을 생성하지 못했습니다.");
    return text;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"];

async function callOpenAI(prompt: string, modelId?: string): Promise<string> {
  const key = getApiKey("VITE_OPENAI_API_KEY");
  if (!key) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다. .env에 VITE_OPENAI_API_KEY를 추가해주세요.");
  }

  const model = modelId && OPENAI_MODELS.includes(modelId) ? modelId : OPENAI_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = json as { error?: { message?: string; code?: string } };
      const msg = err?.error?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const text = json?.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("ChatGPT가 응답을 생성하지 못했습니다.");
    return text;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

export interface GenerateSummaryOptions {
  articles: RawRssArticle[];
  isInternational: boolean;
  model: "gemini" | "gpt" | "claude";
  /** 관리자 지정 모델 ID */
  modelId?: string;
  watchlist?: { symbol: string; name: string; isDomestic?: boolean }[];
  /** 사용자가 입력한 관심 섹터·기업 메모리. AI 프롬프트에 반영 */
  interestMemory?: string;
  /** 해외: 상승/하락 TOP 종목. AI가 기사에서 상승/하락 이유 찾아 reason에 작성 */
  moversSeed?: { up: { name: string; ticker: string; changeRate: string }[]; down: { name: string; ticker: string; changeRate: string }[] };
}

/**
 * 데이터 파이프라인:
 *   1단계: RSS 기사 키워드 필터 → headlineArticles (AI 개입 0%)
 *   2단계: yfinance 데이터 (moversSeed/indices)
 *   3단계: 데이터 없으면 생성 중단
 *   4단계: AI는 totalAssessment + movers reason만 생성 (keyIssues 폐기)
 */
export async function generateMarketSummary(options: GenerateSummaryOptions): Promise<MarketSummaryData> {
  const { articles, isInternational, model, modelId, watchlist, interestMemory, moversSeed } = options;

  if (articles.length === 0) {
    throw new Error("분석할 기사가 없습니다.");
  }

  // 해외 시황: S&P500/나스닥 등 키워드 필터된 기사만 헤드라인 섹션에 사용
  // ── 1단계: RSS 기사 키워드 필터 (국내·해외 모두 적용) ──
  // 해외: HEADLINE_KEYWORDS 포함 기사만 (키워드 없으면 전체 fallback)
  // 국내: 전체 기사를 헤드라인으로 사용 (키워드 필터 없음)
  const keywordFiltered = articles.filter((a) =>
    HEADLINE_KEYWORDS.some((kw) => a.title.includes(kw) || (a.body ?? "").includes(kw))
  );
  const headlineRssArticles = isInternational
    ? (keywordFiltered.length > 0 ? keywordFiltered : articles).slice(0, 20)
    : articles.slice(0, 20);

  console.log(`[Pipeline] Total RSS articles fetched: ${articles.length}`);
  console.log(`[Pipeline] Filtered Headline articles: ${headlineRssArticles.length}`);
  console.log(`[Pipeline] Current View Mode: ${isInternational ? "International" : "Domestic"}`);

  // ── 파이프라인 검증 ──
  const hasRssArticles = articles.length > 0;
  const hasMarketData = !!(moversSeed && (moversSeed.up.length > 0 || moversSeed.down.length > 0));
  if (!hasRssArticles && !hasMarketData) {
    throw new Error("현재 조건에 부합하는 실시간 기사가 없습니다. RSS 수집 결과를 확인해주세요.");
  }

  const useClaude = model === "claude" || (modelId && CLAUDE_MODELS.includes(modelId));
  const useGemini = !useClaude && (modelId ? GEMINI_MODELS.includes(modelId) : model === "gemini");
  const useOpenAI = !useClaude && !useGemini;
  const claudeModelId = useClaude && modelId && CLAUDE_MODELS.includes(modelId) ? modelId : CLAUDE_MODELS[0];
  const geminiModelId = useGemini && modelId && GEMINI_MODELS.includes(modelId) ? modelId : undefined;
  const openAIModelId = useOpenAI && modelId && OPENAI_MODELS.includes(modelId) ? modelId : undefined;

  const prompt = buildPrompt(articles, isInternational, {
    watchlist,
    moversSeed,
    interestMemory,
    includeTotalAssessment: !!(useGemini || useClaude),
    headlineRssArticles,
  });
  const rawResponse = useClaude
    ? await callClaude(prompt, claudeModelId)
    : useGemini
      ? await callGemini(prompt, geminiModelId)
      : await callOpenAI(prompt, openAIModelId);

  const data = parseAndNormalize(rawResponse, isInternational);

  // ── headlineArticles: RSS 원문 직결 (AI 개입 0%, 국내·해외 모두 적용) ──
  if (headlineRssArticles.length === 0) {
    data.headlineArticles = [];
    data.noHeadlineArticlesMessage = isInternational
      ? "현재 조건에 부합하는 실시간 기사가 없습니다.\n(S&P500, 나스닥, 뉴욕증시, NYSE 등 키워드 포함 기사 없음)"
      : "수집된 RSS 기사가 없습니다.";
  } else {
    data.headlineArticles = headlineRssArticles.map((a) => ({
      sourceName: a.sourceName,
      title: a.title,
      summary: a.body ? a.body.slice(0, 350).trim() : "(본문 미수집)",
      url: a.link,
      verificationStatus: "unverified" as const,
    }));
  }

  if (!useGemini && !useClaude) {
    data.totalAssessmentError = true;
  } else if (!data.totalAssessment || !String(data.totalAssessment).trim()) {
    data.totalAssessmentError = true;
  }
  if (moversSeed) mergeMoversWithSeed(data, moversSeed);
  return data;
}

/** 2차 검증 프롬프트: 검증용 데이터와 요약을 비교해 오류 수정 */
function buildVerificationPrompt(data: MarketSummaryData): string {
  const indicesStr = data.indices.map((i) => `${i.name}: ${i.value} (${i.change})`).join(", ");
  const moversUpStr = data.moversUp.map((m) => `${m.name}(${m.ticker}): ${m.changeRate}`).join(", ");
  const moversDownStr = data.moversDown.map((m) => `${m.name}(${m.ticker}): ${m.changeRate}`).join(", ");
  return `## [최우선 원칙] 수치 > 텍스트
**Yahoo Finance 종가 데이터가 절대 권위입니다.** 기사·해석과 충돌 시 반드시 수치에 맞춰 텍스트를 교정하세요.

## 검증용 기준 데이터 (Yahoo Finance 종가 기준 실데이터 - 변경 불가)
아래는 야후파이낸스 **종가**에서 확인된 지수·기업 등락 실데이터입니다. 이 값들이 최종 기준입니다.

### 대표 지수 (실데이터)
${indicesStr}

### 상승 종목 (실데이터)
${moversUpStr || "(없음)"}

### 하락 종목 (실데이터)
${moversDownStr || "(없음)"}

---

## 현재 시황 요약 (검증 대상)
아래 요약 내용 중 위 실데이터와 **충돌하는 숫자**(지수값, 등락률, %, 기업별 changeRate 등)가 있으면 반드시 수정하세요.
- totalAssessment, geopoliticalIssues, movers reason 등 텍스트에 언급된 숫자를 검증용 기준에 맞게 고치세요. (keyIssues 폐기·검증 제외)
- 수정이 필요 없으면 원문을 그대로 유지하세요.
- indices, moversUp, moversDown는 검증용 기준 데이터를 **그대로** 사용하세요. (AI가 바꾸지 말 것)

### 현재 요약
- totalAssessment: ${(data.totalAssessment ?? "").slice(0, 600)}
- geopoliticalIssues: ${JSON.stringify((data.geopoliticalIssues ?? []).slice(0, 8).map((g) => ({ title: g.title, body: (g.body ?? "").slice(0, 150) })))}
- moversUp: ${JSON.stringify(data.moversUp.map((m) => ({ name: m.name, ticker: m.ticker, changeRate: m.changeRate, reason: (m.reason ?? "").slice(0, 150) })))}
- moversDown: ${JSON.stringify(data.moversDown.map((m) => ({ name: m.name, ticker: m.ticker, changeRate: m.changeRate, reason: (m.reason ?? "").slice(0, 150) })))}

---

## 2차 검증 체크리스트 (반드시 순서대로 확인)

**체크 1** 본문의 지수 포인트·등락 기호(+/-)가 위 실데이터와 수학적으로 일치하는가?
**체크 2** '투자 심리 위축', '매도세 확산' 등 추상적 표현이 실제 '지수 상승'과 충돌하고 있지는 않은가? (지수가 올랐으면 상승·반등·강세·호조만 사용)
**체크 3** 수치와 해석이 충돌하면 → 해석을 삭제하고 수치에 기반한 새 문장 생성. (예: 지수 +0.5%인데 '위축'이라고 쓰면 '악재에도 불구하고 소폭 상승' 등으로 교정)

등락 용어 강제: 수익률 > 0 → 상승·반등·강세·호조만 / 수익률 < 0 → 하락·약세·조정·후퇴만.

---

## 요청
1. 위 체크리스트대로 검증하여 요약 텍스트의 **숫자·등락률·용어 오류**를 수정.
2. 수정된 전체 시황 요약을 아래 JSON 형식으로 출력. indices·moversUp·moversDown는 반드시 검증용 기준 데이터를 그대로 사용.
3. 수정이 필요 없으면 원문 유지. 오류만 교정.
4. 반드시 유효한 JSON만 출력하세요.

### 출력 JSON 형식 (indices, moversUp, moversDown는 검증용 기준과 동일하게)
{ "date": "...", "regionLabel": "...", "totalAssessment": "...", "indices": [...], "moversUp": [...], "moversDown": [...], "geopoliticalIssues": [...] }
반드시 유효한 JSON만 출력하세요.`;
}

/**
 * AI 2차 검증: 실데이터(지수·등락율)와 요약을 비교해 숫자 오류를 수정
 * - indices·movers는 이미 Yahoo 등 실데이터로 채워져 있음 (그대로 유지)
 * - totalAssessment, geopoliticalIssues, movers reason 등 텍스트 내 오류 수정 (keyIssues 폐기)
 */
export async function verifyAndCorrectMarketSummary(
  data: MarketSummaryData,
  opts?: { model?: "gemini" | "gpt" | "claude"; modelId?: string }
): Promise<MarketSummaryData> {
  if (!data.indices?.length && !data.moversUp?.length && !data.moversDown?.length) {
    return data;
  }
  const model = opts?.model ?? "claude";
  const modelId = opts?.modelId;
  const useClaude = model === "claude" || (modelId && CLAUDE_MODELS.includes(modelId));
  const useGemini = !useClaude && (modelId ? GEMINI_MODELS.includes(modelId) : model === "gemini");
  const prompt = buildVerificationPrompt(data);
  try {
    const rawResponse = useClaude
      ? await callClaude(prompt, modelId && CLAUDE_MODELS.includes(modelId) ? modelId : CLAUDE_MODELS[0])
      : useGemini
        ? await callGemini(prompt, modelId && GEMINI_MODELS.includes(modelId) ? modelId : undefined)
        : await callOpenAI(prompt, modelId && OPENAI_MODELS.includes(modelId) ? modelId : undefined);
    const isInternational = (data.regionLabel ?? "").includes("해외");
    const corrected = parseAndNormalize(rawResponse, isInternational);
    corrected.indices = data.indices;
    corrected.moversUp = data.moversUp;
    corrected.moversDown = data.moversDown;
    corrected.indicesSources = data.indicesSources;
    corrected.moversSources = data.moversSources;
    corrected.keyIssues = [];
    if (data.headlineArticles?.length) corrected.headlineArticles = data.headlineArticles;
    if (data.earningsPast?.length) corrected.earningsPast = data.earningsPast;
    if (data.earningsUpcoming?.length) corrected.earningsUpcoming = data.earningsUpcoming;
    return corrected;
  } catch {
    return data;
  }
}

export interface DataVerificationResult {
  matchPercent: number;
  correctedCount: number;
  correctedData: MarketSummaryData;
}

/** 기사 단위 수치 검증 결과 */
interface ArticleAuditResult {
  articleIndex: number;
  status: "verified" | "numerical_error";
  errors: string[];
}

/**
 * 순수 TypeScript 산술 검증: headlineArticles(RSS)만 검증. keyIssues·totalAssessment는 점수 산출에서 제외.
 * 0.05% 이상 차이 → numerical_error
 */
function auditHeadlineArticles(data: MarketSummaryData): ArticleAuditResult[] {
  if (!data.indices?.length || !data.headlineArticles?.length) return [];

  const results: ArticleAuditResult[] = [];

  for (let i = 0; i < data.headlineArticles.length; i++) {
    const art = data.headlineArticles[i];
    const text = `${art.title} ${art.summary ?? ""}`;
    const errors: string[] = [];

    for (const idx of data.indices) {
      const changeStr = idx.change ?? "0%";
      const changeSign = idx.isUp ? 1 : -1;
      const actualChangePct = parseFloat(changeStr.replace(/[^0-9.]/g, "")) * changeSign;
      const escapedName = idx.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const contextRegex = new RegExp(`${escapedName}[^.。\\n]{0,60}`, "gi");
      let contextMatch: RegExpExecArray | null;
      while ((contextMatch = contextRegex.exec(text)) !== null) {
        const ctx = contextMatch[0];
        const mentionsUp = /상승|반등|강세|호조|올랐|오름|증가/.test(ctx);
        const mentionsDown = /하락|약세|조정|후퇴|떨어|내렸|감소/.test(ctx);
        if (mentionsUp && !idx.isUp) {
          errors.push(`${idx.name}: 리포트 상승 서술 ↔ 실데이터 하락 (${idx.change})`);
          break;
        }
        if (mentionsDown && idx.isUp) {
          errors.push(`${idx.name}: 리포트 하락 서술 ↔ 실데이터 상승 (${idx.change})`);
          break;
        }
      }

      const numericRegex = new RegExp(
        `${escapedName}[^.。\\n]{0,80}?([+-]?\\d+\\.\\d+)\\s*%|([+-]?\\d+\\.\\d+)\\s*%[^.。\\n]{0,80}?${escapedName}`,
        "gi"
      );
      let numMatch: RegExpExecArray | null;
      while ((numMatch = numericRegex.exec(text)) !== null) {
        const rawVal = numMatch[1] ?? numMatch[2] ?? "";
        if (!rawVal) continue;
        const mentionedPct = parseFloat(rawVal);
        const absDiff = Math.abs(mentionedPct - Math.abs(actualChangePct));
        if (absDiff >= 0.05) {
          errors.push(`${idx.name}: 리포트 ${mentionedPct > 0 ? "+" : ""}${mentionedPct}% ↔ 실데이터 ${idx.change} (오차 ${absDiff.toFixed(2)}%p)`);
        }
        break;
      }
    }

    results.push({
      articleIndex: i,
      status: errors.length > 0 ? "numerical_error" : "verified",
      errors,
    });
  }

  return results;
}

/** RSS 기사 기준 신뢰도: (수치 언급 기사 중 검증 통과 / 전체 수치 언급 기사) * 100 */
function calculateArticleMatchPercent(articleResults: ArticleAuditResult[]): number {
  const withNumericMention = articleResults.length;
  if (withNumericMention === 0) return 100;
  const verified = articleResults.filter((r) => r.status === "verified").length;
  return Math.round((verified / withNumericMention) * 100);
}

/**
 * [데이터 검증] RSS 기사만 검증. keyIssues 등 AI 가상 데이터는 점수 산출에서 제외.
 * - headlineArticles 각 기사 수치 검증 → verified | numerical_error 분류
 * - 수치 오류 기사는 별도 섹션으로 분리 표시
 */
export async function runDataVerification(data: MarketSummaryData): Promise<DataVerificationResult> {
  const finalData: MarketSummaryData = { ...data };
  finalData.indices = data.indices;
  finalData.indicesSources = data.indicesSources;
  finalData.moversSources = data.moversSources;

  // ── RSS 기사만 검증 (keyIssues 미포함) ──
  const articleResults = auditHeadlineArticles(data);
  const matchPercent = calculateArticleMatchPercent(articleResults);
  const numericalErrorIndices = articleResults
    .filter((r) => r.status === "numerical_error")
    .map((r) => r.articleIndex);
  const articleErrorDetails = articleResults
    .filter((r) => r.errors.length > 0)
    .map((r) => ({ index: r.articleIndex, errors: r.errors }));

  const corrections = articleErrorDetails.flatMap((d) =>
    d.errors.map((e) => ({
      field: `기사[${d.index}] ${(data.headlineArticles ?? [])[d.index]?.title?.slice(0, 30) ?? ""}...`,
      original: e,
      corrected: "실데이터와 일치하지 않음",
    }))
  );

  if (finalData.headlineArticles) {
    finalData.headlineArticles = finalData.headlineArticles.map((h, i) => ({
      ...h,
      verificationStatus: numericalErrorIndices.includes(i) ? "numerical_error" : "verified",
      verificationErrors: articleResults[i]?.errors,
    }));
  }

  finalData.verificationResult = {
    matchPercent,
    correctedCount: numericalErrorIndices.length,
    isVerified: true,
    corrections,
    numericalErrorArticleIndices: numericalErrorIndices,
    articleErrorDetails,
  };

  return { matchPercent, correctedCount: numericalErrorIndices.length, correctedData: finalData };
}

/** 유튜브 영상 제목·설명 기반 시황 요약용 프롬프트 */
function buildPromptFromVideo(title: string, description: string): string {
  const content = `## 유튜브 영상
제목: ${title}

설명:
${description.slice(0, 8000)}

## 요청
위 유튜브 영상 제목과 설명을 바탕으로 해외(미국) 시황 요약을 작성해주세요. 반드시 아래 JSON 형식으로만 응답하고, 다른 텍스트는 포함하지 마세요.

### 필수 규칙 (기존 aiSummary.ts와 동일)
- 문체 [전체 적용]: 반드시 '개조식' 및 '명사형 종결'만 사용.
  · 개조식: 줄글 금지. 항목별 줄바꿈으로만 분리. 불릿·문장 앞 기호 절대 금지.
  · 명사형 종결: 문장 끝은 명사 또는 명사형 어미(-음, -기, -함, -됨)로만 맺음.
  · 금지어: ~다, ~습니다, ~요 등 서술형·경어체 사용 금지. (totalAssessment는 예외)
- 간결성: 수식어·감정 표현 배제, 사실·핵심 데이터 위주 압축.
- totalAssessment: 아나운서 브리핑처럼 서술형·존댓말(~습니다)로 총평. (keyIssues 폐기)

### JSON 형식
{
  "date": "YYYY-MM-DD 요요일",
  "regionLabel": "해외 시황 요약",
  "totalAssessment": "아나운서 브리핑처럼 서술형·존댓말(~습니다)로 총평.",
  "indices": [
    { "name": "지수명", "value": "수치", "change": "+0.5%", "changeAbs": "▲12.34", "isUp": true }
  ],
  "indicesSources": [{ "outlet": "출처", "headline": "헤드라인" }],
  "stockMoversLabel": "M7 및 반도체주 등락율",
  "moversUp": [],
  "moversDown": [],
  "moversSources": [],
  "geopoliticalLabel": "국제 정세 이슈",
  "geopoliticalIssues": [],
  "geopoliticalSources": [],
  "earningsPast": [],
  "earningsUpcoming": [],
  "earningsSources": []
}

영상 내용에 없는 정보는 "—" 또는 빈 배열로 처리. 반드시 유효한 JSON만 출력하세요.`;
  return content;
}

/** 자유 구성 요약용 - AI가 제목·구성 전부 알아서 결정 */
export interface FlexibleVideoSummary {
  content: string; // AI가 만든 요약 전체 (제목·구성 포함)
}

const VIDEO_REPORT_STYLE = `
### [필수] 텍스트 레벨 스타일 (우리 시황 리포트 문체)
- 개조식: 줄글 금지. 항목별 줄바꿈으로만 분리. 문두 불릿·기호(■, -, •, ① 등) 절대 금지.
- 명사형 종결: 문장 끝은 명사 또는 명사형 어미(-음, -기, -함, -됨)로만 맺음.
- 금지어: ~다, ~습니다, ~요, ~했습니다 등 서술형·경어체 사용 금지. (totalAssessment/종합 부분만 예외)
- 기업 표기: "기업명(티커)" 형태. 기업명은 한글로 (엔비디아, 애플, AMD 등).
- 수식어·감정 배제, 사실·데이터 위주.
- 문체 예시: "장 초반 국제유가 급등(9%↑)에 따른 투자심리 위축 및 주식·채권 전반 매도세 확산"
`;

function buildPromptFromVideosFlexible(videos: { title: string; description: string }[]): string {
  const items = videos
    .map((v, i) => `### 영상 ${i + 1}\n제목: ${v.title}\n\n설명:\n${(v.description || "").slice(0, 12000)}`)
    .join("\n\n");
  return `## 유튜브 시황 영상들
${items}

## 요청
위 영상의 제목·설명에 담긴 **모든 시황 관련 내용**을 추출하여, 우리가 정한 **시황 리포트 스타일**로 재구성해주세요.

**요약이 아님. 리포트임.**
- 과한 요약·생략·내용 버리기 금지.
- 영상 속에 나온 내용은 빠짐없이 포함. 숫자·기업명·등락률·이벤트·맥락 전부 반영.
- 우리의 텍스트 스타일·문단 구성을 적용하여 **형태만 변환**할 것.
${VIDEO_REPORT_STYLE}

### [필수] 문단 구성 (재활용)
- 1. 시장 총평: 당일 장세 개요. 지수(다우·나스닥·S&P500·KOSPI 등) 구체적 % 포함. 위 스타일 적용.
- 2. 핵심 이슈: 영상에서 다룬 이슈별로 소제목·본문. 각 body 3줄 이상. 개조식·명사형 종결.
- 3. 매크로 및 기타: 고용·환율·지정학·이벤트 등.
- 4. 종합: 아나운서 브리핑처럼 서술형·존댓말(~습니다)로 마무리. (이 부분만 예외)

### 원칙
- 영상에 있는 내용은 버리지 말고 전부 리포트에 녹일 것.
- 없는 정보는 추측하지 말 것.
- 중요한 구절은 **굵게** 표시 가능.

### 출력 형식
{
  "content": "전체 리포트 텍스트 (위 스타일·문단 구성 적용. 줄바꿈으로 구분)"
}
반드시 유효한 JSON만 출력하세요.`;
}

function parseFlexibleSummary(jsonStr: string): FlexibleVideoSummary {
  let raw = jsonStr.trim();
  const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) raw = codeMatch[1].trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) raw = jsonMatch[0];
  const parsed = JSON.parse(raw) as { content?: string };
  const content = String(parsed?.content ?? "").trim();
  return { content };
}

/**
 * 유튜브 영상 요약 - 섹션 구성 자유 (고정 타이틀 없음)
 * 영상 내용에 맞게 AI가 스스로 섹션을 나누어 요약
 */
export async function generateFlexibleVideoSummaryFromVideos(
  videos: { title: string; description: string }[],
  opts?: { model?: "gemini" | "gpt"; modelId?: string }
): Promise<FlexibleVideoSummary> {
  if (videos.length === 0) throw new Error("선택된 영상이 없습니다.");
  const model = opts?.model ?? "gemini";
  const modelId = opts?.modelId;
  const useGemini = modelId ? GEMINI_MODELS.includes(modelId) : model === "gemini";

  const prompt = buildPromptFromVideosFlexible(videos);
  const rawResponse = useGemini
    ? await callGemini(prompt, modelId && GEMINI_MODELS.includes(modelId) ? modelId : undefined)
    : await callOpenAI(prompt, modelId && OPENAI_MODELS.includes(modelId) ? modelId : undefined);

  return parseFlexibleSummary(rawResponse);
}

/** FlexibleVideoSummary → MarketSummaryData (오늘의 시황 추가용 변환) */
export function flexibleToMarketSummary(flex: FlexibleVideoSummary): MarketSummaryData {
  const now = new Date();
  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
  const dateStr = `${now.getFullYear()}. ${String(now.getMonth() + 1).padStart(2, "0")}. ${String(now.getDate()).padStart(2, "0")} (${weekDays[now.getDay()]})`;

  return {
    date: dateStr,
    regionLabel: "해외 시황 요약",
    totalAssessment: flex.content?.slice(0, 600) ?? "",
    indices: [],
    indicesSources: [],
    keyIssues: [],
    keyIssuesSources: [],
    stockMoversLabel: "",
    moversUp: [],
    moversDown: [],
    moversSources: [],
    bigTechLabel: "",
    bigTechIssues: [],
    bigTechSources: [],
  };
}

/** [레거시] 선택 영상들 제목·설명을 종합하여 미국 시황 요약 (고정 형식) */
function buildPromptFromVideos(videos: { title: string; description: string }[]): string {
  const items = videos
    .map((v, i) => `### 영상 ${i + 1}\n제목: ${v.title}\n\n설명:\n${(v.description || "").slice(0, 4000)}`)
    .join("\n\n");
  return `## 유튜브 시황 영상들
${items}

## 요청
위 유튜브 영상들의 제목과 설명을 종합하여 오늘의 미국 시황 요약을 작성해주세요.
- 문체: 개조식, 명사형 종결(-음, -기, -함, -됨). 문두 불릿·기호 금지.
- 형식은 아래 JSON 구조를 따르되, 영상 내용에 맞게 자유롭게 작성. 영상에 없는 정보는 "—" 또는 빈 배열로.
- 반드시 유효한 JSON만 출력.

### JSON 형식
{
  "date": "YYYY. MM. DD (요)",
  "regionLabel": "해외 시황 요약",
  "totalAssessment": "아나운서 브리핑처럼 서술형·존댓말(~습니다)로 총평.",
  "indices": [{ "name": "지수명", "value": "수치", "change": "+0.5%", "changeAbs": "▲12.34", "isUp": true }],
  "indicesSources": [{ "outlet": "출처", "headline": "헤드라인" }],
  "stockMoversLabel": "M7 및 반도체주 등락율",
  "moversUp": [],
  "moversDown": [],
  "moversSources": [],
  "geopoliticalLabel": "국제 정세 이슈",
  "geopoliticalIssues": [],
  "geopoliticalSources": [],
  "earningsPast": [],
  "earningsUpcoming": [],
  "earningsSources": []
}
반드시 유효한 JSON만 출력하세요.`;
}

/**
 * [레거시] 선택된 유튜브 영상들을 고정 형식으로 시황 요약 생성
 */
export async function generateMarketSummaryFromVideos(
  videos: { title: string; description: string }[],
  opts?: { model?: "gemini" | "gpt"; modelId?: string }
): Promise<MarketSummaryData> {
  if (videos.length === 0) throw new Error("선택된 영상이 없습니다.");
  const model = opts?.model ?? "gemini";
  const modelId = opts?.modelId;
  const useGemini = modelId ? GEMINI_MODELS.includes(modelId) : model === "gemini";

  const prompt = buildPromptFromVideos(videos);
  const rawResponse = useGemini
    ? await callGemini(prompt, modelId && GEMINI_MODELS.includes(modelId) ? modelId : undefined)
    : await callOpenAI(prompt, modelId && OPENAI_MODELS.includes(modelId) ? modelId : undefined);

  const data = parseAndNormalize(rawResponse, true);
  if (!useGemini) data.totalAssessmentError = true;
  else if (!data.totalAssessment?.trim()) data.totalAssessmentError = true;
  return data;
}

/**
 * 유튜브 영상 제목·설명을 이용한 시황 요약 생성
 */
export async function generateMarketSummaryFromVideo(
  title: string,
  description: string,
  opts?: { model?: "gemini" | "gpt"; modelId?: string }
): Promise<MarketSummaryData> {
  const model = opts?.model ?? "gemini";
  const modelId = opts?.modelId;
  const useGemini = modelId ? GEMINI_MODELS.includes(modelId) : model === "gemini";

  const prompt = buildPromptFromVideo(title, description);
  const rawResponse = useGemini
    ? await callGemini(prompt, modelId && GEMINI_MODELS.includes(modelId) ? modelId : undefined)
    : await callOpenAI(prompt, modelId && OPENAI_MODELS.includes(modelId) ? modelId : undefined);

  const data = parseAndNormalize(rawResponse, true);
  if (!useGemini) data.totalAssessmentError = true;
  else if (!data.totalAssessment?.trim()) data.totalAssessmentError = true;
  return data;
}
