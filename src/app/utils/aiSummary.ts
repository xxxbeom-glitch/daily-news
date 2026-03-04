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

const GEMINI_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"];
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
  const region = isInternational ? "해외(미국·글로벌)" : "국내(한국)";
  const articleList = buildArticleContext(articles);

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

  return `아래는 ${region} 금융·경제 뉴스 헤드라인입니다. 이 기사들을 분석하여 시황 요약 JSON을 생성해주세요.${watchlistSection}${memorySection}${moversSection}

## 뉴스 헤드라인
${articleList}

## 요청
위 기사들을 바탕으로 시황 요약을 작성해주세요. 반드시 아래 JSON 형식으로만 응답하고, 다른 텍스트는 포함하지 마세요.

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
- keyIssues: title 1줄, body 개조식·명사형 종결. 항목별 줄바꿈만. 문두 불릿·기호(■, -, • 등) 절대 금지. 2줄 이상 구체적 서술.
${isInternational ? "- keyIssues 비율: 미국 중심 뉴스 약 80%. 미국 시장·정책·경제 이슈 우선." : "- keyIssues: [국내 전용] 반드시 정확히 12개. 100% 한국 기반. 경제·정책·부동산·의료·사회 등 + 삼성·SK·현대차·네이버·카카오 등 국내 상위 기업 관련 중요한 뉴스가 있으면 함께 포함. 부족하면 기타 시장 이슈로 채워 12개 맞출 것."}
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
    { "title": "1줄 제목", "body": "항목1 (명사형 종결)\n항목2 (명사형 종결)" }
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
  "regionLabel": "국내 시황 요약",${includeTotalAssessment ? `
  "totalAssessment": "아나운서 브리핑처럼 서술형·존댓말(~습니다)로 총평.",` : ""}
  "indices": [
    { "name": "코스피", "value": "수치", "change": "+0.5%", "changeAbs": "▲12.34", "isUp": true },
    { "name": "코스닥", "value": "수치", "change": "-0.2%", "changeAbs": "▼1.75", "isUp": false },
    { "name": "코스피 200", "value": "수치", "change": "+0.3%", "changeAbs": "▲2.10", "isUp": true }
  ],
  "indicesSources": [{ "outlet": "출처", "headline": "헤드라인" }],
  "keyIssues": [
    { "title": "1줄 제목", "body": "항목1 (명사형 종결)\n항목2 (명사형 종결)" }
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
    regionLabel: (parsed.regionLabel as string) || (isInternational ? "해외 시황 요약" : "국내 시황 요약"),
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

function getApiKey(name: "VITE_GEMINI_API_KEY" | "VITE_OPENAI_API_KEY"): string {
  let key = (import.meta.env[name] as string) ?? "";
  key = key.trim().replace(/^["']|["']$/g, "");
  return key;
}

async function callGemini(prompt: string): Promise<string> {
  const key = getApiKey("VITE_GEMINI_API_KEY");
  if (!key) {
    throw new Error("Gemini API 키가 설정되지 않았습니다. .env에 VITE_GEMINI_API_KEY를 추가해주세요.");
  }

  let lastError: Error | null = null;
  for (const model of GEMINI_MODELS) {
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

async function callOpenAI(prompt: string): Promise<string> {
  const key = getApiKey("VITE_OPENAI_API_KEY");
  if (!key) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다. .env에 VITE_OPENAI_API_KEY를 추가해주세요.");
  }

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
        model: OPENAI_MODEL,
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
  const { articles, isInternational, model, watchlist, interestMemory, moversSeed } = options;

  if (articles.length === 0) {
    throw new Error("분석할 기사가 없습니다.");
  }

  const prompt = buildPrompt(articles, isInternational, {
    watchlist,
    moversSeed,
    interestMemory,
    includeTotalAssessment: model === "gemini",
  });
  const rawResponse = model === "gemini" ? await callGemini(prompt) : await callOpenAI(prompt);
  const data = parseAndNormalize(rawResponse, isInternational);
  if (model === "gpt") {
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
