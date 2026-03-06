/**
 * 원문 URL에서 기사 본문 추출 (Reader View)
 * DOM 파싱으로 article/main 등 본문 영역 추출
 */

import { fetchViaCorsProxy } from "./corsProxy";

export interface ArticleReaderResult {
  title: string | null;
  textContent: string | null;
  excerpt: string | null;
  byline: string | null;
}

const ARTICLE_CACHE_MAX = 30;
const articleCache = new Map<string, ArticleReaderResult>();

const CONTENT_SELECTORS = [
  "article",
  "[role='main']",
  "main",
  ".article__body",
  ".article-body",
  ".post-content",
  ".entry-content",
  ".content-body",
  ".article-content",
  ".story-body",
  "#article-body",
  ".articleBody",
  ".post-body",
  ".story-body-text",
  "[itemprop='articleBody']",
  ".pf-content",
  /* 매일경제, 한국경제 등 국내 언론사 */
  ".news_body",
  "#news_body",
  ".view_content",
  ".article-view",
  ".news_ct",
  "#newsct",
  ".news_end_body",
  ".cont_news",
  ".article_txt",
];

const BLOCK_TAGS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BR", "TR", "SECTION", "ARTICLE", "BLOCKQUOTE"]);

function extractTextWithStructure(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll("script, style, nav, aside, footer, .ad, .advertisement").forEach((n) => n.remove());

  function walk(node: Node, parts: string[]): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent ?? "").replace(/\s+/g, " ").trim();
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
    for (const child of elem.childNodes) walk(child, childParts);
    const joined = childParts.join(isBlock ? "\n\n" : " ");
    if (joined.trim()) parts.push(joined.trim());
  }

  const parts: string[] = [];
  for (const child of clone.childNodes) walk(child, parts);
  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extractText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll("script, style, nav, aside, footer, .ad, .advertisement").forEach((n) => n.remove());
  const structured = extractTextWithStructure(clone);
  if (structured.length > 200) return structured;
  return clone.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

export async function fetchArticleContent(url: string): Promise<ArticleReaderResult> {
  const cached = articleCache.get(url);
  if (cached) return cached;

  const { ok, text } = await fetchViaCorsProxy(url, { timeoutMs: 12000 });
  if (!ok || !text) {
    throw new Error("기사를 불러올 수 없습니다.");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");

  const title = doc.querySelector("title")?.textContent?.trim() ?? null;
  let textContent: string | null = null;

  for (const sel of CONTENT_SELECTORS) {
    const el = doc.querySelector(sel);
    if (el) {
      const extracted = extractText(el);
      if (extracted.length > 200) {
        textContent = extracted;
        break;
      }
    }
  }
  if (!textContent) {
    const body = doc.body?.cloneNode(true) as Element | null;
    if (body) {
      body.querySelectorAll("script, style, nav, header, footer, aside, iframe").forEach((n) => n.remove());
      textContent = extractTextWithStructure(body).slice(0, 5000) || null;
    }
  }
  if (textContent) textContent = textContent.slice(0, 15000);

  const result: ArticleReaderResult = { title, textContent, excerpt: null, byline: null };
  if (articleCache.size >= ARTICLE_CACHE_MAX) {
    const firstKey = articleCache.keys().next().value;
    if (firstKey) articleCache.delete(firstKey);
  }
  articleCache.set(url, result);
  return result;
}
