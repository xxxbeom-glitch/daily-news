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
    .map((a, i) => `${i + 1}. [${a.sourceName}] ${a.title}`)
    .join("\n");
}

function isDomesticSymbol(sym: string): boolean {
  return sym.endsWith(".KS") || sym.endsWith(".KQ");
}

/** 기사 수가 이 값 미만이면 sparse(희소) 모드 - moversSeed·시장 데이터 비중 확대 */
const SPARSE_ARTICLE_THRESHOLD = 5;

function buildPrompt(
  articles: RawRssArticle[],
  isInternational: boolean,
  opts?: {
    watchlist?: { symbol: string; name: string; isDomestic?: boolean }[];
    moversSeed?: { up: { name: string; ticker: string; changeRate: string }[]; down: { name: string; ticker: string; changeRate: string }[] };
    interestMemory?: string;
    includeTotalAssessment?: boolean;
  }
): string {
  const watchlist = opts?.watchlist;
  const moversSeed = opts?.moversSeed;
  const interestMemory = opts?.interestMemory;
  const includeTotalAssessment = opts?.includeTotalAssessment ?? false;
  const isSparseArticles = articles.length < SPARSE_ARTICLE_THRESHOLD;
  const region = isInternational ? "해외(미국·글로벌)" : "국내(한국)";
  const articleList = buildArticleContext(articles, isSparseArticles ? 50 : 25);

  const relevantWatchlist = (watchlist ?? []).filter((w) => {
    const domestic = w.isDomestic ?? isDomesticSymbol(w.symbol);
    return isInternational !== domestic;
  });
  const watchlistSection =
    relevantWatchlist.length > 0
      ? `\n## 관심종목\n뉴스에 아래 기업 관련 내용이 있으면 keyIssues에 자연스럽게 녹여 포함. (별도 섹션 만들지 말 것)\n${relevantWatchlist.map((w) => `${w.name}(${w.symbol})`).join(", ")}\n`
      : "";

  const memorySection =
    interestMemory && interestMemory.trim().length > 0
      ? `\n## 사용자 관심사\n아래 키워드/섹터/기업 관련 뉴스가 있으면 keyIssues에 우선 포함.\n${interestMemory.trim()}\n`
      : "";

  const moversSection = isInternational && moversSeed && (moversSeed.up.length > 0 || moversSeed.down.length > 0)
    ? `\n## M7 및 반도체주 등락 (각 기업별 reason 필수)\nmoversUp/moversDown에 아래 종목 그대로 사용. 각 reason: 명사형 종결(~함/~됨/~임) 필수. 2줄 이상 구체적으로. 요약만 하지 말 것.\n상승: ${moversSeed.up.map((m) => `${m.name}(${m.ticker}) ${m.changeRate}`).join(", ")}\n하락: ${moversSeed.down.map((m) => `${m.name}(${m.ticker}) ${m.changeRate}`).join(", ")}\n`
    : "";

  const sparseSection = isSparseArticles
    ? `\n## [기사 부족 시 주의] 기사 수가 매우 적습니다(${articles.length}편). moversSeed(등락 종목)·시장 지수 데이터를 우선 활용하고, 각 기사를 심층 분석하여 핵심을 최대한 추출하세요. 기사와 시장 데이터를 결합하여 요약하세요.\n`
    : "";

  const analysisStyle =
    isSparseArticles
      ? "각 기사를 심층 분석하여 핵심을 최대한 추출하고, 기사와 시장 데이터를 결합하여 요약하세요."
      : "기사들을 종합하여 시장 추세를 분석하세요.";

  return `아래는 ${region} 금융·경제 뉴스 헤드라인입니다. 이 기사들을 분석하여 시황 요약 JSON을 생성해주세요.${watchlistSection}${memorySection}${moversSection}${sparseSection}

## 뉴스 헤드라인
${articleList}

## 요청
위 기사들을 바탕으로 시황 요약을 작성해주세요. ${analysisStyle} 반드시 아래 JSON 형식으로만 응답하고, 다른 텍스트는 포함하지 마세요.

### 필수 규칙
- 숫자·지수 값: 기사 내용 바탕 합리적 추정, 없으면 "—" 표시
- 문체 [전체 적용]: 반드시 '개조식' 및 '명사형 종결'만 사용.
  · 개조식: 줄글 금지. 항목별 줄바꿈으로만 분리. 불릿·문장 앞 기호 절대 금지(■, -, •, ◆ 등 어떤 기호도 문두에 넣지 말 것).
  · 명사형 종결: 문장 끝은 명사 또는 명사형 어미(-음, -기, -함, -됨)로만 맺음.
  · 금지어(keyIssues 등에 한함): ~다, ~습니다, ~요, ~합니다 등 서술형·경어체 사용 금지. (totalAssessment는 예외, 존댓말 사용)
  · 간결성: 수식어·감정 표현 배제, 사실·핵심 데이터 위주 압축.
  · 적용 대상: keyIssues, geopoliticalIssues, movers reason, earnings result. (totalAssessment는 아래 별도 규칙)
- 문체 예시: [입력] 장 초반에 국제유가가 9% 넘게 치솟으면서... → [출력] 장 초반 국제유가 급등(9%↑)에 따른 투자심리 위축 및 주식·채권 전반 매도세 확산
- 모든 문자열: 한글로
- 기업 표기: "기업명(티커)" 형태. 기업명은 한글로 표기 가능하면 한글로 (엔비디아, 애플, 테슬라 등).
- keyIssues vs bigTechIssues: bigTechIssues는 사용하지 않음. 해외·국내 모두 keyIssues만 사용.
- keyIssues: title 1줄, body 개조식·명사형 종결. 항목별 줄바꿈만. 문두 불릿·기호(■, -, • 등) 절대 금지. body는 반드시 3줄 이상 구체적 서술.
${isInternational ? "- keyIssues 비율: 미국 중심 뉴스 약 80%. 미국 시장·정책·경제 이슈 우선." : "- keyIssues: [국내 전용] 반드시 정확히 12개. 각 항목 body는 3줄 이상. 100% 한국 기반. 경제·정책·부동산·의료·사회 등 + 삼성·SK·현대차·네이버·카카오 등 국내 상위 기업 관련 중요한 뉴스가 있으면 함께 포함. 부족하면 기타 시장 이슈로 채워 12개 맞출 것."}
${isInternational ? "- geopoliticalIssues: 최소 5~8개. 각 body 개조식·명사형 종결. 2줄 이상." : ""}
${isInternational ? "- earningsPast: 뉴스에서 간밤 발표된 실적(기업명, result는 개조식·명사형 종결) 추출. 없으면 빈 배열. earningsUpcoming: 뉴스에서 예정 실적 일정 추출. 없으면 빈 배열. (실적 일정은 API로 별도 수집됨)" : ""}

${includeTotalAssessment ? `- totalAssessment: [필수] [예외 문체] 아나운서가 브리핑하듯 서술형·존댓말로 작성. ~습니다, ~했습니다 등 사용. 뉴스 종합 분석·추론 기반 총평. 비워두지 말 것.` : ""}

### JSON 형식 (이 형식으로만 응답)
${isInternational ? `{
  "date": "YYYY-MM-DD 요요일",
  "regionLabel": "해외 시황 요약",${includeTotalAssessment ? `
  "totalAssessment": "아나운서 브리핑처럼 서술형·존댓말(~습니다)로 총평.",` : ""}
  "indices": [
    { "name": "지수명", "value": "수치", "change": "+0.5%", "changeAbs": "▲12.34", "isUp": true }
  ],
  "indicesSources": [{ "outlet": "출처", "headline": "헤드라인" }],
  "keyIssues": [
    { "title": "1줄 제목", "body": "항목1 (명사형 종결)\n항목2 (명사형 종결)\n항목3 이상 (명사형 종결)" }
  ],
  "keyIssuesSources": [{ "outlet": "출처", "headline": "헤드라인" }],
  "stockMoversLabel": "M7 및 반도체주 등락율",
  "moversUp": [...],
  "moversDown": [...],
  "moversSources": [...],
  "geopoliticalLabel": "국제 정세 이슈",
  "geopoliticalIssues": [{ "title": "1줄", "body": "항목 (명사형 종결)" }],
  "geopoliticalSources": [...],
  "earningsPast": [...],
  "earningsUpcoming": [...],
  "earningsSources": [...]
}` : `{
  "date": "YYYY-MM-DD 요요일",
  "regionLabel": "한국 시장 뉴스",${includeTotalAssessment ? `
  "totalAssessment": "아나운서 브리핑처럼 서술형·존댓말(~습니다)로 총평.",` : ""}
  "indices": [
    { "name": "코스피", "value": "수치", "change": "+0.5%", "changeAbs": "▲12.34", "isUp": true },
    { "name": "코스닥", "value": "수치", "change": "-0.2%", "changeAbs": "▼1.75", "isUp": false },
    { "name": "코스피 200", "value": "수치", "change": "+0.3%", "changeAbs": "▲2.10", "isUp": true }
  ],
  "indicesSources": [{ "outlet": "출처", "headline": "헤드라인" }],
  "keyIssues": [
    { "title": "1줄 제목", "body": "항목1 (명사형 종결)\n항목2 (명사형 종결)\n항목3 이상 (명사형 종결)" }
  ],
  "keyIssuesSources": [...],
  "stockMoversLabel": "",
  "moversUp": [],
  "moversDown": [],
  "moversSources": [],
  "bigTechLabel": "",
  "bigTechIssues": [],
  "bigTechSources": []
}`}

국내 indices: [필수] 코스피, 코스닥, 코스피200 포함.
국내: 실적발표(earnings) 포함하지 말 것.
해외 indices: S&P500, 나스닥, 다우존스 등.

${isInternational ? "- earningsPast: 뉴스에 있으면 추출. earningsUpcoming은 API로 채움." : ""}
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
    keyIssues: ensureIssueItems((parsed.keyIssues as IssueItem[]) ?? []),
    keyIssuesSources: ensureSourceRefs((parsed.keyIssuesSources as SourceRef[]) ?? []),
    stockMoversLabel: (parsed.stockMoversLabel as string) ?? (isInternational ? "S&P500" : ""),
    moversUp: ensureStockMovers((parsed.moversUp as StockMover[]) ?? []),
    moversDown: ensureStockMovers((parsed.moversDown as StockMover[]) ?? []),
    moversSources: ensureSourceRefs((parsed.moversSources as SourceRef[]) ?? []),
    bigTechLabel: (parsed.bigTechLabel as string) ?? (isInternational ? "빅테크 & AI 기업 이슈" : "국내 대표·대장주 이슈"),
    bigTechIssues: ensureIssueItems((parsed.bigTechIssues as IssueItem[]) ?? []),
    bigTechSources: ensureSourceRefs((parsed.bigTechSources as SourceRef[]) ?? []),
  };

  if (isInternational && parsed.geopoliticalIssues) {
    data.geopoliticalLabel = "국제 정세 이슈";
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
  model: "gemini" | "gpt";
  /** 관리자 지정 모델 ID (Gemini/OpenAI 모델 중 하나) */
  modelId?: string;
  watchlist?: { symbol: string; name: string; isDomestic?: boolean }[];
  /** 사용자가 입력한 관심 섹터·기업 메모리. AI 프롬프트에 반영 */
  interestMemory?: string;
  /** 해외: 상승/하락 TOP 종목. AI가 기사에서 상승/하락 이유 찾아 reason에 작성 */
  moversSeed?: { up: { name: string; ticker: string; changeRate: string }[]; down: { name: string; ticker: string; changeRate: string }[] };
}

/**
 * AI API를 호출하여 시황 요약 생성
 */
export async function generateMarketSummary(options: GenerateSummaryOptions): Promise<MarketSummaryData> {
  const { articles, isInternational, model, modelId, watchlist, interestMemory, moversSeed } = options;

  if (articles.length === 0) {
    throw new Error("분석할 기사가 없습니다.");
  }

  const useGemini = modelId ? GEMINI_MODELS.includes(modelId) : model === "gemini";
  const useOpenAI = modelId ? OPENAI_MODELS.includes(modelId) : model === "gpt";
  const geminiModelId = useGemini && modelId && GEMINI_MODELS.includes(modelId) ? modelId : undefined;
  const openAIModelId = useOpenAI && modelId && OPENAI_MODELS.includes(modelId) ? modelId : undefined;

  const prompt = buildPrompt(articles, isInternational, {
    watchlist,
    moversSeed,
    interestMemory,
    includeTotalAssessment: useGemini,
  });
  const rawResponse = useGemini ? await callGemini(prompt, geminiModelId) : await callOpenAI(prompt, openAIModelId);
  const data = parseAndNormalize(rawResponse, isInternational);
  if (!useGemini) {
    data.totalAssessmentError = true;
  } else if (!data.totalAssessment || !String(data.totalAssessment).trim()) {
    data.totalAssessmentError = true;
  }
  if (moversSeed) mergeMoversWithSeed(data, moversSeed);
  if (!isInternational) {
    while (data.keyIssues.length < 12) {
      data.keyIssues.push({ title: "기타 시장 이슈", body: "추가 뉴스 부족으로 별도 이슈 없음." });
    }
  }
  return data;
}

/** 2차 검증 프롬프트: 검증용 데이터와 요약을 비교해 오류 수정 */
function buildVerificationPrompt(data: MarketSummaryData): string {
  const indicesStr = data.indices.map((i) => `${i.name}: ${i.value} (${i.change})`).join(", ");
  const moversUpStr = data.moversUp.map((m) => `${m.name}(${m.ticker}): ${m.changeRate}`).join(", ");
  const moversDownStr = data.moversDown.map((m) => `${m.name}(${m.ticker}): ${m.changeRate}`).join(", ");
  return `## 검증용 기준 데이터 (Yahoo Finance 실데이터 - 변경 불가)
아래는 야후파이낸스에서 확인된 **지수·기업 등락** 실데이터입니다. 이 값들이 최종 기준입니다.

### 대표 지수 (실데이터)
${indicesStr}

### 상승 종목 (실데이터)
${moversUpStr || "(없음)"}

### 하락 종목 (실데이터)
${moversDownStr || "(없음)"}

---

## 현재 시황 요약 (검증 대상)
아래 요약 내용 중 위 실데이터와 **충돌하는 숫자**(지수값, 등락률, %, 기업별 changeRate 등)가 있으면 반드시 수정하세요.
- totalAssessment, keyIssues, geopoliticalIssues, movers reason, earnings result 등 텍스트에 언급된 숫자를 검증용 기준에 맞게 고치세요.
- 수정이 필요 없으면 원문을 그대로 유지하세요.
- indices, moversUp, moversDown는 검증용 기준 데이터를 **그대로** 사용하세요. (AI가 바꾸지 말 것)

### 현재 요약
- totalAssessment: ${(data.totalAssessment ?? "").slice(0, 600)}
- keyIssues: ${JSON.stringify(data.keyIssues.slice(0, 10).map((k) => ({ title: k.title, body: (k.body ?? "").slice(0, 200) })))}
- geopoliticalIssues: ${JSON.stringify((data.geopoliticalIssues ?? []).slice(0, 8).map((g) => ({ title: g.title, body: (g.body ?? "").slice(0, 150) })))}
- moversUp: ${JSON.stringify(data.moversUp.map((m) => ({ name: m.name, ticker: m.ticker, changeRate: m.changeRate, reason: (m.reason ?? "").slice(0, 150) })))}
- moversDown: ${JSON.stringify(data.moversDown.map((m) => ({ name: m.name, ticker: m.ticker, changeRate: m.changeRate, reason: (m.reason ?? "").slice(0, 150) })))}

---

## 요청
1. 위 검증용 기준 데이터와 비교하여, 요약 텍스트에 **숫자·등락률 오류**가 있으면 수정.
2. 수정된 전체 시황 요약을 아래 JSON 형식으로 출력. indices·moversUp·moversDown는 반드시 검증용 기준 데이터를 그대로 사용.
3. 다른 텍스트는 변경하지 말고, 오류 수정만 수행.
4. 반드시 유효한 JSON만 출력하세요.

### 출력 JSON 형식 (indices, moversUp, moversDown는 검증용 기준과 동일하게)
{ "date": "...", "regionLabel": "...", "totalAssessment": "...", "indices": [...], "keyIssues": [...], "moversUp": [...], "moversDown": [...], "geopoliticalIssues": [...] }
반드시 유효한 JSON만 출력하세요.`;
}

/**
 * AI 2차 검증: 실데이터(지수·등락율)와 요약을 비교해 숫자 오류를 수정
 * - indices·movers는 이미 Yahoo 등 실데이터로 채워져 있음 (그대로 유지)
 * - totalAssessment, keyIssues, geopoliticalIssues, movers reason 등 텍스트 내 오류 수정
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
    if (data.earningsPast?.length) corrected.earningsPast = data.earningsPast;
    if (data.earningsUpcoming?.length) corrected.earningsUpcoming = data.earningsUpcoming;
    return corrected;
  } catch {
    return data;
  }
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
- keyIssues: title 1줄, body 개조식·명사형 종결. body는 3줄 이상.
- totalAssessment: 아나운서 브리핑처럼 서술형·존댓말(~습니다)로 총평.

### JSON 형식
{
  "date": "YYYY-MM-DD 요요일",
  "regionLabel": "해외 시황 요약",
  "totalAssessment": "아나운서 브리핑처럼 서술형·존댓말(~습니다)로 총평.",
  "indices": [
    { "name": "지수명", "value": "수치", "change": "+0.5%", "changeAbs": "▲12.34", "isUp": true }
  ],
  "indicesSources": [{ "outlet": "출처", "headline": "헤드라인" }],
  "keyIssues": [
    { "title": "1줄 제목", "body": "항목1 (명사형 종결)\\n항목2 (명사형 종결)\\n항목3 이상 (명사형 종결)" }
  ],
  "keyIssuesSources": [{ "outlet": "출처", "headline": "헤드라인" }],
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

  const keyIssues = flex.content
    ? [{ title: "유튜브 시황 요약", body: flex.content }]
    : [];

  return {
    date: dateStr,
    regionLabel: "해외 시황 요약",
    totalAssessment: flex.content?.slice(0, 200) ?? "",
    indices: [],
    indicesSources: [],
    keyIssues,
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
  "keyIssues": [{ "title": "1줄 제목", "body": "항목 (명사형 종결)" }],
  "keyIssuesSources": [],
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
