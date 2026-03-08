/**
 * URL에서 기사 본문 추출 (스크래핑)
 */

import { fetchViaCorsProxy } from "./corsProxy";

const MAX_BODY_LENGTH = 15000;

/** HTML에서 텍스트 본문 추출 - article, main, .article-body 등 우선 */
function extractTextFromHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc.body) return "";

  const selectors = [
    "article",
    "main",
    "[role='main']",
    ".article-body",
    ".article_body",
    ".article-content",
    ".articleContent",
    ".post-content",
    ".news_body",
    ".news-body",
    ".content-body",
    ".content_body",
    "#article-body",
    "#articleBody",
    ".entry-content",
    ".story-body",
    ".news_view",
    ".news-content",
  ];

  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const text = el.textContent?.trim().replace(/\s+/g, " ") ?? "";
      if (text.length > 100) return text;
    }
  }

  const paragraphs = doc.querySelectorAll("p");
  const texts: string[] = [];
  let totalLen = 0;
  for (const p of paragraphs) {
    const t = p.textContent?.trim() ?? "";
    if (t.length > 30) {
      texts.push(t);
      totalLen += t.length;
      if (totalLen >= 3000) break;
    }
  }
  return texts.join("\n\n");
}

export interface ScrapedArticle {
  url: string;
  title: string;
  body: string;
  source?: string;
  /** 기사 발행 일시 (ISO8601 또는 파싱된 문자열) */
  publishedAt?: string;
  ok: boolean;
  error?: string;
}

export async function scrapeArticleFromUrl(url: string): Promise<ScrapedArticle> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { url: trimmed, title: "", body: "", ok: false, error: "URL이 비어 있습니다." };
  }

  try {
    new URL(trimmed);
  } catch {
    return { url: trimmed, title: "", body: "", ok: false, error: "유효하지 않은 URL입니다." };
  }

  const { ok, text, error } = await fetchViaCorsProxy(trimmed, { timeoutMs: 15000 });
  if (!ok || !text) {
    return {
      url: trimmed,
      title: "",
      body: "",
      ok: false,
      error: error ?? "페이지를 가져오지 못했습니다.",
    };
  }

  const doc = new DOMParser().parseFromString(text, "text/html");
  const title =
    doc.querySelector("title")?.textContent?.trim() ??
    doc.querySelector("h1")?.textContent?.trim() ??
    doc.querySelector("meta[property='og:title']")?.getAttribute("content") ??
    "";

  const publishedAt = tryExtractPublishedAt(doc, text);

  const body = extractTextFromHtml(text).slice(0, MAX_BODY_LENGTH);
  if (body.length < 50) {
    const fallback = doc.body?.textContent?.trim().replace(/\s+/g, " ").slice(0, MAX_BODY_LENGTH) ?? "";
    return {
      url: trimmed,
      title,
      body: fallback,
      source: tryExtractSource(trimmed),
      publishedAt,
      ok: fallback.length >= 50,
      error: fallback.length < 50 ? "본문을 추출할 수 없습니다." : undefined,
    };
  }

  return {
    url: trimmed,
    title,
    body,
    source: tryExtractSource(trimmed),
    publishedAt,
    ok: true,
  };
}

function tryExtractPublishedAt(doc: Document, html: string): string | undefined {
  const sel = doc.querySelector("meta[property='article:published_time']");
  const v = sel?.getAttribute("content")?.trim();
  if (v) return v;
  const d = doc.querySelector("meta[name='date']")?.getAttribute("content")?.trim();
  if (d) return d;
  const t = doc.querySelector("time[datetime]")?.getAttribute("datetime")?.trim();
  if (t) return t;
  const itemprop = doc.querySelector("[itemprop='datePublished']")?.getAttribute("content")?.trim()
    ?? doc.querySelector("[itemprop='datePublished']")?.getAttribute("datetime")?.trim();
  if (itemprop) return itemprop;
  const naverSelectors = [
    "span.media_end_head_info_dateline_time",
    "span.media_end_head_info_datestamp_time._ARTICLE_DATE_TIME",
    "span.media_end_head_info_datestamp_time",
  ];
  for (const sel of naverSelectors) {
    const el = doc.querySelector(sel);
    const dataTime = el?.getAttribute("data-date-time")?.trim();
    if (dataTime) return dataTime;
    const text = el?.textContent?.trim();
    if (text && /\d{4}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2}/.test(text)) return text;
  }
  const ldJsonRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ldJsonM;
  while ((ldJsonM = ldJsonRegex.exec(html)) !== null) {
    const inner = ldJsonM[1]?.trim();
      if (!inner) continue;
    try {
      const parsed = JSON.parse(inner) as { datePublished?: string; "@graph"?: Array<{ datePublished?: string }> };
      if (parsed?.datePublished) return parsed.datePublished;
      const graph = parsed?.["@graph"];
      if (Array.isArray(graph)) {
        for (const g of graph) {
          if (g?.datePublished) return g.datePublished;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function tryExtractSource(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const known: Record<string, string> = {
      "hankyung.com": "한국경제",
      "mk.co.kr": "매일경제",
      "yna.co.kr": "연합뉴스",
      "sbs.co.kr": "SBS",
      "hani.co.kr": "한겨레",
      "chosun.com": "조선일보",
      "donga.com": "동아일보",
      "khan.co.kr": "경향신문",
      "n.news.naver.com": "네이버뉴스",
      "news.naver.com": "네이버뉴스",
    };
    return known[host] ?? host;
  } catch {
    return "";
  }
}
