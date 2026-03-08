/**
 * RSS/원격 리소스 CORS 프록시 (Vercel 프로덕션용)
 * - 언론사 RSS, Yahoo Finance 등 직접 fetch 시 CORS 차단 방지
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const ALLOWED_HOSTS = new Set([
  "www.hankyung.com",
  "www.mk.co.kr",
  "news.sbs.co.kr",
  "api.sbs.co.kr",
  "www.yna.co.kr",
  "news.google.com",
  "finnhub.io",
  "finance.yahoo.com",
  "www.cnbc.com",
  "feeds.marketwatch.com",
  "seekingalpha.com",
  "feeds.a.dj.com",
  "feeds.bloomberg.com",
  "query1.finance.yahoo.com",
  "api.rss2json.com",
  "api.allorigins.win",
  "corsproxy.io",
  "cors.x2u.in",
]);

const ALLOWED_DOMAIN_SUFFIXES = [
  ".hankyung.com",
  ".mk.co.kr",
  ".yna.co.kr",
  ".sbs.co.kr",
  ".hani.co.kr",
  ".chosun.com",
  ".donga.com",
  ".khan.co.kr",
  ".joongang.co.kr",
];

function isAllowedUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:") return false;
    if (ALLOWED_HOSTS.has(u.hostname)) return true;
    return ALLOWED_DOMAIN_SUFFIXES.some((s) => u.hostname === s.slice(1) || u.hostname.endsWith(s));
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = typeof req.query.url === "string" ? req.query.url : "";
  if (!url) {
    return res.status(400).json({ error: "url 파라미터 필요" });
  }

  if (!isAllowedUrl(url)) {
    return res.status(403).json({ error: "허용되지 않은 URL" });
  }

  try {
    const targetOrigin = (() => {
      try {
        return new URL(url).origin + "/";
      } catch {
        return "";
      }
    })();
    const proxyRes = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        ...(targetOrigin ? { Referer: targetOrigin } : {}),
      },
    });

    const text = await proxyRes.text();
    if (!proxyRes.ok) {
      const host = (() => { try { return new URL(url).hostname; } catch { return "?"; } })();
      console.error(`[cors-proxy] ${proxyRes.status} ${url} | host=${host} | body=${text.slice(0, 200)}`);
      return res.status(proxyRes.status).end();
    }
    res.setHeader("Content-Type", proxyRes.headers.get("content-type") || "text/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.send(text);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const code = e?.code ?? (e?.name ?? "unknown");
    console.error(`[cors-proxy] ${code} ${url}`, e?.message ?? String(err));
    return res.status(502).json({ error: "프록시 요청 실패", code: String(code) });
  }
}
