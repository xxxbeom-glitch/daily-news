/**
 * AI API (Gemini/Claude)를 이용한 시황 요약 생성
 */

import type { MarketSummaryData, IssueItem, StockMover, IndexData, SourceRef } from "../data/marketSummary";

export interface RawRssArticle {
  title: string;
  link: string;
  pubDate: string;
  sourceId: string;
  sourceName: string;
  body?: string;
}

const GEMINI_MODEL = "gemini-1.5-flash";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

function buildArticleContext(articles: RawRssArticle[], maxItems = 25): string {
  return articles
    .slice(0, maxItems)
    .map((a, i) => `${i + 1}. [${a.sourceName}] ${a.title}`)
    .join("\n");
}

function buildPrompt(articles: RawRssArticle[], isInternational: boolean): string {
  const region = isInternational ? "해외(미국·글로벌)" : "국내(한국)";
  const articleList = buildArticleContext(articles);

  return `아래는 ${region} 금융·경제 뉴스 헤드라인입니다. 이 기사들을 분석하여 시황 요약 JSON을 생성해주세요.

## 뉴스 헤드라인
${articleList}

## 요청
위 기사들을 바탕으로 시황 요약을 작성해주세요. 반드시 아래 JSON 형식으로만 응답하고, 다른 텍스트는 포함하지 마세요.
- 숫자·지수 값은 기사 내용을 바탕으로 합리적으로 추정하거나, 기사에 없으면 "—"로 표시
- 문체: "~했음", "~됐음", "~임" (과거·현재 혼용)
- 모든 문자열은 한글로

## JSON 형식 (이 형식으로만 응답)
{
  "date": "YYYY-MM-DD 요요일",
  "regionLabel": "${isInternational ? "해외 시황 요약" : "국내 시황 요약"}",
  "indices": [
    { "name": "지수명", "value": "수치", "change": "+0.5%", "changeAbs": "▲12.34", "isUp": true }
  ],
  "indicesSources": [{ "outlet": "출처", "headline": "헤드라인" }],
  "keyIssues": [
    { "title": "1줄 제목", "body": "2줄 서술" }
  ],
  "keyIssuesSources": [{ "outlet": "출처", "headline": "헤드라인" }],
  "stockMoversLabel": "${isInternational ? "S&P500" : ""}",
  "moversUp": [
    { "name": "기업명", "ticker": "티커", "changeRate": "+5.0%", "isUp": true, "reason": "이유 1~2줄" }
  ],
  "moversDown": [
    { "name": "기업명", "ticker": "티커", "changeRate": "-2.0%", "isUp": false, "reason": "이유 1~2줄" }
  ],
  "moversSources": [{ "outlet": "출처", "headline": "헤드라인" }],
  "bigTechLabel": "${isInternational ? "빅테크 & AI 기업 이슈" : "국내 시가총액 100위 기업 이슈"}",
  "bigTechIssues": [
    { "title": "기업명(티커)", "body": "2줄 서술", "changeRate": "+3.2%" }
  ],
  "bigTechSources": [{ "outlet": "출처", "headline": "헤드라인" }]
}
${isInternational ? `
해외의 경우 위 객체에 다음을 추가: "geopoliticalLabel": "국제 정세 이슈", "geopoliticalIssues": [...], "geopoliticalSources": [...]` : ""}

국내의 경우 indices는 코스피, 코스닥만 포함. 해외의 경우 S&P500, 나스닥, 다우존스 등.
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

function parseAndNormalize(jsonStr: string, isInternational: boolean): MarketSummaryData {
  // JSON 블록만 추출 (마크다운 코드블록 제거)
  let raw = jsonStr.trim();
  const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) raw = codeMatch[1].trim();

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const now = new Date();
  const weekDays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${weekDays[now.getDay()]}`;

  const data: MarketSummaryData = {
    date: (parsed.date as string) || dateStr,
    regionLabel: (parsed.regionLabel as string) || (isInternational ? "해외 시황 요약" : "국내 시황 요약"),
    indices: ensureIndexData((parsed.indices as IndexData[]) ?? []),
    indicesSources: ensureSourceRefs((parsed.indicesSources as SourceRef[]) ?? []),
    keyIssues: ensureIssueItems((parsed.keyIssues as IssueItem[]) ?? []),
    keyIssuesSources: ensureSourceRefs((parsed.keyIssuesSources as SourceRef[]) ?? []),
    stockMoversLabel: (parsed.stockMoversLabel as string) ?? (isInternational ? "S&P500" : ""),
    moversUp: ensureStockMovers((parsed.moversUp as StockMover[]) ?? []),
    moversDown: ensureStockMovers((parsed.moversDown as StockMover[]) ?? []),
    moversSources: ensureSourceRefs((parsed.moversSources as SourceRef[]) ?? []),
    bigTechLabel: (parsed.bigTechLabel as string) ?? (isInternational ? "빅테크 & AI 기업 이슈" : "국내 시가총액 100위 기업 이슈"),
    bigTechIssues: ensureIssueItems((parsed.bigTechIssues as IssueItem[]) ?? []),
    bigTechSources: ensureSourceRefs((parsed.bigTechSources as SourceRef[]) ?? []),
  };

  if (isInternational && parsed.geopoliticalIssues) {
    data.geopoliticalLabel = "국제 정세 이슈";
    data.geopoliticalIssues = ensureIssueItems(parsed.geopoliticalIssues as IssueItem[]);
    data.geopoliticalSources = ensureSourceRefs((parsed.geopoliticalSources as SourceRef[]) ?? []);
  }

  return data;
}

async function callGemini(prompt: string): Promise<string> {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key || typeof key !== "string") {
    throw new Error("Gemini API 키가 설정되지 않았습니다. .env에 VITE_GEMINI_API_KEY를 추가해주세요.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
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
      throw new Error((err as { error?: { message?: string } }).error?.message || `HTTP ${res.status}`);
    }

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) throw new Error("Gemini가 응답을 생성하지 못했습니다.");
    return text;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

async function callClaude(prompt: string): Promise<string> {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!key || typeof key !== "string") {
    throw new Error("Claude API 키가 설정되지 않았습니다. .env에 VITE_ANTHROPIC_API_KEY를 추가해주세요.");
  }

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
        model: CLAUDE_MODEL,
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err as { error?: { message?: string } }).error?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const json = await res.json();
    const content = json?.content;
    const textPart = Array.isArray(content)
      ? content.find((c: { type?: string }) => c?.type === "text")
      : null;
    const text = textPart?.text ?? "";
    if (!text) throw new Error("Claude가 응답을 생성하지 못했습니다.");
    return text;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

export interface GenerateSummaryOptions {
  articles: RawRssArticle[];
  isInternational: boolean;
  model: "gemini" | "claude";
}

/**
 * AI API를 호출하여 시황 요약 생성
 */
export async function generateMarketSummary(options: GenerateSummaryOptions): Promise<MarketSummaryData> {
  const { articles, isInternational, model } = options;

  if (articles.length === 0) {
    throw new Error("분석할 기사가 없습니다.");
  }

  const prompt = buildPrompt(articles, isInternational);
  const rawResponse = model === "gemini" ? await callGemini(prompt) : await callClaude(prompt);
  return parseAndNormalize(rawResponse, isInternational);
}
