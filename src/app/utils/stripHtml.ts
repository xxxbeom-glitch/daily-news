/**
 * HTML 태그 제거 및 엔티티 디코딩
 * RSS description 등 HTML 포함 문자열을 순수 텍스트로 변환
 */
export function stripHtmlToText(html: string): string {
  if (!html || typeof html !== "string") return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
