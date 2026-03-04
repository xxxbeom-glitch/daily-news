/**
 * RSS/원격 리소스 CORS 프록시 (Vercel 프로덕션용)
 * - 언론사 RSS, Yahoo Finance 등 직접 fetch 시 CORS 차단 방지
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const ALLOWED_HOSTS = new Set([
  "www.hankyung.com",
  "www.mk.co.kr",
  "news.sbs.co.kr",
  "finnhub.io",
  "finance.yahoo.com",
  "www.cnbc.com",
  "feeds.a.dj.com",
  "feeds.bloomberg.com",
  "query1.finance.yahoo.com",
  "api.allorigins.win",
  "corsproxy.io",
  "cors.x2u.in",
]);

function isAllowedUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:") return false;
    return ALLOWED_HOSTS.has(u.hostname) || u.hostname.endsWith(".hankyung.com") || u.hostname.endsWith(".mk.co.kr");
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

    if (!proxyRes.ok) {
      return res.status(proxyRes.status).end();
    }

    const text = await proxyRes.text();
    res.setHeader("Content-Type", proxyRes.headers.get("content-type") || "text/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.send(text);
  } catch (err) {
    console.error("[cors-proxy]", err);
    return res.status(502).json({ error: "프록시 요청 실패" });
  }
}
