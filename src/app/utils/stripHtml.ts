const BLOCK_TAGS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BR", "TR", "SECTION", "ARTICLE", "BLOCKQUOTE"]);

function walkPreserveStructure(node: Node, parts: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = (node.textContent ?? "").replace(/[ \t]+/g, " ").trim();
    if (t) parts.push(t);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const elem = node as Element;
  if (elem.tagName === "BR") {
    parts.push("\n");
    return;
  }
  const isBlock = BLOCK_TAGS.has(elem.tagName);
  const childParts: string[] = [];
  for (const child of elem.childNodes) walkPreserveStructure(child, childParts);
  const joined = childParts.join(isBlock ? "\n\n" : " ");
  if (joined.trim()) parts.push(joined.trim());
}

/**
 * HTML 태그 제거 및 엔티티 디코딩
 * RSS description 등 HTML 포함 문자열을 순수 텍스트로 변환 (문단·줄바꿈 구조 유지)
 */
export function stripHtmlToText(html: string): string {
  if (!html || typeof html !== "string") return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const parts: string[] = [];
  for (const child of tmp.childNodes) walkPreserveStructure(child, parts);
  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
