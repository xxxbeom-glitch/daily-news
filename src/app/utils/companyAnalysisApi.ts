/**
 * 기업분석 API - 설정의 System Instruction 사용, JSON 스키마 규칙 적용
 */

import { jsonrepair } from "jsonrepair";
import { getCompanyAnalysisSystemInstruction } from "./persistState";

export interface CompanyAnalysisResult {
  metadata: {
    company_name: string;
    ticker: string;
    market: string;
    last_updated: string;
  };
  /** 기업이 속한 섹터 (예: 반도체, 2차전지, 자동차) */
  sectors?: string[];
  analysis_sections: Array<{ title: string; content: string }>;
  key_summary: {
    growth_driver: string;
    risk_factor: string;
    overall_opinion: string;
  };
}

const JSON_SCHEMA_PROMPT = `반드시 아래 JSON 형식으로만 응답하고, 다른 텍스트는 포함하지 마세요.

{
  "metadata": {
    "company_name": "기업명",
    "ticker": "종목코드",
    "market": "KOSPI / NASDAQ 등",
    "last_updated": "YYYY-MM-DD"
  },
  "analysis_sections": [
    {
      "title": "사업의 본질 및 핵심 비즈니스",
      "content": "기업의 수익 구조와 시장 내 위치를 분석한 서술형 내용이 들어감."
    },
    {
      "title": "재무 실적 및 수익성 평가",
      "content": "최근 실적 수치와 수익성 변화 추이를 분석한 서술형 내용이 들어감."
    },
    {
      "title": "최근 시장 동향 및 향후 전망",
      "content": "주요 뉴스, 매크로 환경, 향후 성장 모멘텀을 분석한 서술형 내용이 들어감."
    },
    {
      "title": "어느 기업과 연결되어 있는가?",
      "content": "주요 고객사, 공급사 및 실적이 연동되는 관련 기업을 명시하고, 이들 간의 실적 영향 관계를 분석한 서술형 내용이 들어감."
    }
  ],
  "sectors": ["반도체", "2차전지"],
  "key_summary": {
    "growth_driver": "핵심 성장 요소 1줄 요약",
    "risk_factor": "주의 리스크 1줄 요약",
    "overall_opinion": "전반적인 투자 상태에 대한 분석가적 총평"
  }
}
sectors: 이 기업이 속한 산업/섹터를 문자열 배열로 (최대 5개, 예: 반도체, 2차전지, 자동차, 헬스케어)`;

function getGeminiKey(): string {
  let key = (import.meta.env.VITE_GEMINI_API_KEY as string) ?? "";
  return key.trim().replace(/^["']|["']$/g, "");
}

function extractAndParseJson(text: string): Record<string, unknown> {
  let raw = text.trim();
  const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) raw = codeMatch[1].trim();
  const startIdx = raw.indexOf("{");
  if (startIdx === -1) throw new Error("AI 응답에서 JSON 객체를 찾을 수 없습니다.");
  const endIdx = raw.lastIndexOf("}");
  if (endIdx <= startIdx) throw new Error("AI 응답이 유효한 JSON이 아닙니다.");
  raw = raw.slice(startIdx, endIdx + 1);
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const fixed = jsonrepair(raw);
    return JSON.parse(fixed) as Record<string, unknown>;
  }
}

function parseCompanyAnalysisResult(parsed: Record<string, unknown>): CompanyAnalysisResult {
  const meta = (parsed.metadata as Record<string, unknown>) ?? {};
  const sectionsRaw = parsed.analysis_sections;
  const analysis_sections = Array.isArray(sectionsRaw)
    ? sectionsRaw.map((s: unknown) => {
        const o = (s as Record<string, unknown>) ?? {};
        return {
          title: String(o.title ?? "").trim(),
          content: String(o.content ?? "").trim(),
        };
      }).filter((s) => s.title || s.content)
    : [];
  const ks = (parsed.key_summary as Record<string, unknown>) ?? {};
  const sectorsRaw = parsed.sectors;
  const sectors = Array.isArray(sectorsRaw)
    ? sectorsRaw.slice(0, 5).map((s) => String(s ?? "").trim()).filter(Boolean)
    : undefined;
  return {
    metadata: {
      company_name: String(meta.company_name ?? "").trim(),
      ticker: String(meta.ticker ?? "").trim(),
      market: String(meta.market ?? "").trim(),
      last_updated: String(meta.last_updated ?? "").trim(),
    },
    sectors,
    analysis_sections,
    key_summary: {
      growth_driver: String(ks.growth_driver ?? "").trim(),
      risk_factor: String(ks.risk_factor ?? "").trim(),
      overall_opinion: String(ks.overall_opinion ?? "").trim(),
    },
  };
}

/** 기업분석 실행. 설정 > System Instruction + JSON 스키마 규칙 적용. */
export async function runCompanyAnalysis(
  companyName: string
): Promise<CompanyAnalysisResult | null> {
  const key = getGeminiKey();
  if (!key) {
    throw new Error("Gemini API 키가 설정되지 않았습니다. .env에 VITE_GEMINI_API_KEY를 추가해주세요.");
  }
  const systemInstruction = getCompanyAnalysisSystemInstruction();
  const prompt = `다음 기업에 대해 자본시장 전문 분석가 관점으로 기업 분석을 수행해주세요.

## 분석 대상
${companyName.trim()}

## 요청
${JSON_SCHEMA_PROMPT}
반드시 유효한 JSON만 출력하세요.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          systemInstruction: systemInstruction?.trim() ? { parts: [{ text: systemInstruction }] } : undefined,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
    }
    const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error("기업분석 응답을 생성하지 못했습니다.");
    const parsed = extractAndParseJson(text);
    return parseCompanyAnalysisResult(parsed);
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}
