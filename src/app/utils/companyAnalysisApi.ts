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
  analysis_sections: Array<{
    title: string;
    content: string;
    /** "어느 기업과 연결되어 있는가?" 섹션에서만 사용. 검색(분석) 대상 회사 제외한 언급 회사명 목록 */
    mentioned_companies?: string[];
  }>;
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
      "content": "주요 고객사, 공급사 및 실적이 연동되는 관련 기업을 명시하고, 이들 간의 실적 영향 관계를 분석한 서술형 내용이 들어감.",
      "mentioned_companies": ["관련기업1", "관련기업2"]
    }
  ],
  "sectors": ["정보기술 (IT)", "반도체/AI"],
  "key_summary": {
    "growth_driver": "핵심 성장 요소 1줄 요약",
    "risk_factor": "주의 리스크 1줄 요약",
    "overall_opinion": "전반적인 투자 상태에 대한 분석가적 총평"
  }
}
mentioned_companies: "어느 기업과 연결되어 있는가?" 섹션에서만 필수. 분석 대상(metadata.company_name) 제외, content에 언급된 고객/공급/연동 기업명만 문자열 배열로 포함.

sectors 규칙 (필수 준수):
- 제1라벨 (필수): [1. 글로벌 표준 11대 섹터] 중 해당 기업과 가장 일치하는 항목을 반드시 하나 선택하여 첫 번째 요소로 지정. 기사에 해당 섹터 명칭이 없더라도 기업 업종에 맞춰 강제 부여.
- 후속 라벨 (선택): 기사가 구체적 기술/트렌드를 다루면 [2. 투자자 중심 핵심 테마]에서 적절한 것을 선택해 뒤에 붙임 (최대 4개).
- 우선순위: [표준 섹터] > [핵심 테마] > [기사 내 주요 종목/키워드] 순으로 배치.
- 기사에 해당 단어가 없더라도 대분류 섹터명은 반드시 부여할 것.

[1. 글로벌 표준 11대 섹터 (GICS 기준)]:
- 정보기술 (IT): 반도체, 소프트웨어, 하드웨어, AI 인프라
- 커뮤니케이션 서비스: 인터넷 포털, 통신, 엔터테인먼트(미디어, 게임)
- 금융: 은행, 증권, 보험, 지주사
- 경기소비재: 자동차, 유통, 호텔, 의류 (경기에 민감함)
- 헬스케어: 제약, 바이오, 의료기기, 헬스케어 서비스
- 산업재: 방산, 기계, 건설, 조선, 항공, 로보틱스
- 에너지: 석유, 가스, 정유, 에너지 장비
- 소재: 화학, 철강, 금속, 배터리 소재
- 필수소비재: 음식료, 생활용품, 담배, 주류
- 유틸리티: 전기, 수도, 가스 공급
- 부동산: 리츠(REITs), 부동산 개발

[2. 투자자 중심 핵심 테마 (표준 섹터보다 구체적, 태그용)]: 반도체/AI, 우주/항공, 방산, 모빌리티, 이차전지, 로보틱스, 바이오/신약, 빅테크, 핀테크, 신재생에너지.`;

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
        const mentionsRaw = o.mentioned_companies;
        const mentioned_companies = Array.isArray(mentionsRaw)
          ? mentionsRaw.map((m: unknown) => String(m ?? "").trim()).filter(Boolean)
          : undefined;
        return {
          title: String(o.title ?? "").trim(),
          content: String(o.content ?? "").trim(),
          ...(mentioned_companies?.length ? { mentioned_companies } : {}),
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
