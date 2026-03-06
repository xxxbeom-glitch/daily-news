const BLOCK_TAGS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BR", "TR", "SECTION", "ARTICLE", "BLOCKQUOTE"]);

/** RSS description HTML에서 본문 영역만 추출 시도 (광고·메뉴 등 제외) */
const RSS_BODY_SELECTORS = [
  "article",
  "[itemprop='articleBody']",
  ".article-body",
  ".article__body",
  ".post-content",
  ".entry-content",
  ".content-body",
  ".article-content",
  ".story-body",
  "#article-body",
  ".articleBody",
  ".news_body",
  "#news_body",
  ".view_content",
  ".news_ct",
  "#newsct",
  ".cont_news",
  ".article_txt",
  "main",
  "[role='main']",
];

const JUNK_SELECTORS = "script, style, nav, aside, footer, .ad, .advertisement, .related, .sidebar, .social-share, .share-buttons, .newsletter, iframe";

/**
 * RSS description HTML에서 본문만 추출 (광고·메뉴·관련기사 등 제외)
 * 본문 선택자를 찾으면 해당 영역만 사용, 없으면 전체에서 태그 제거
 */
export function extractArticleBodyFromHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  tmp.querySelectorAll(JUNK_SELECTORS).forEach((n) => n.remove());
  for (const sel of RSS_BODY_SELECTORS) {
    const el = tmp.querySelector(sel);
    if (el) {
      const parts: string[] = [];
      walkPreserveStructure(el, parts);
      const result = parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
      if (result.length > 150) return result;
    }
  }
  const parts: string[] = [];
  for (const child of tmp.childNodes) walkPreserveStructure(child, parts);
  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

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
