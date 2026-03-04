/**
 * 관심사 키워드 → 영문 번역 (Gemini API)
 * 해외 뉴스 기사는 영문이므로 한글 키워드를 영문으로 변환해 매칭
 */

function getGeminiKey(): string {
  let key = (import.meta.env.VITE_GEMINI_API_KEY as string) ?? "";
  return key.trim().replace(/^["']|["']$/g, "");
}

/** 한글이 포함된 키워드가 있는지 */
function hasHangul(text: string): boolean {
  return /[\uAC00-\uD7A3]/.test(text);
}

/**
 * 한글 키워드를 영문으로 번역 (Gemini)
 * 실패 시 빈 배열 반환 (기존 키워드만 사용)
 */
export async function translateKeywordsToEnglish(keywords: string[]): Promise<string[]> {
  const korean = keywords.filter((k) => hasHangul(k));
  if (korean.length === 0) return [];

  const key = getGeminiKey();
  if (!key) return [];

  const prompt = `다음 한글/한국어 키워드를 영문 뉴스 검색용 영어 단어로 번역해주세요. 각 키워드는 콤마(,)로 구분하고, 번역된 영문 단어만 출력하세요. 추가 설명 없이 번역 결과만 출력하세요.

키워드: ${korean.join(", ")}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 256,
          },
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];

    const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return [];

    return text
      .split(/[,，、\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

const INTNL_SOURCE_IDS = new Set([
  "finnhub", "yahoofinance", "cnbc_investing", "cnbc_tech", "wsj", "bloomberg",
]);

export function isInternationalSource(sourceId: string): boolean {
  return INTNL_SOURCE_IDS.has(sourceId);
}

/**
 * 영문 본문을 한글로 번역 (Gemini)
 */
export async function translateTextToKorean(text: string): Promise<string> {
  if (!text.trim()) return "";

  const key = getGeminiKey();
  if (!key) return "";

  const prompt = `다음 영문 뉴스 본문을 자연스러운 한국어로 번역해주세요. 번역 결과만 출력하고, 추가 설명이나 괄호 설명은 넣지 마세요.

---
${text.slice(0, 3000)}
---`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return "";

    const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const result = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return result ?? "";
  } catch {
    clearTimeout(timeout);
    return "";
  }
}
