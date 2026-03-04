/**
 * CORS 프록시를 통한 원격 리소스 fetch
 * allorigins.win이 불안정할 수 있어 corsproxy.io를 대체 수단으로 사용
 */

type ProxyBuilder = (targetUrl: string) => string;

const PROXIES: ProxyBuilder[] = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://cors.x2u.in/${url}`,
];

const DEFAULT_TIMEOUT_MS = 12000;
const PER_PROXY_TIMEOUT_MS = 8000;

async function tryOneProxy(
  targetUrl: string,
  buildProxyUrl: (u: string) => string,
  timeoutMs: number
): Promise<{ ok: boolean; text: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const proxyUrl = buildProxyUrl(targetUrl);
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { ok: false, text: "" };
    let text = await res.text();
    if (text.startsWith("{") && text.includes("contents")) {
      try {
        const json = JSON.parse(text) as { contents?: string };
        if (typeof json?.contents === "string") text = json.contents;
      } catch {
        /* ignore */
      }
    }
    return { ok: true, text };
  } catch {
    clearTimeout(timeout);
    return { ok: false, text: "" };
  }
}

/**
 * CORS 프록시를 통해 URL에서 텍스트 fetch (병렬 시도 → 가장 빠른 응답 사용)
 */
export async function fetchViaCorsProxy(
  targetUrl: string,
  options?: { timeoutMs?: number }
): Promise<{ ok: boolean; text: string; error?: string }> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const perProxy = Math.min(PER_PROXY_TIMEOUT_MS, Math.ceil(timeoutMs / 2));

  const results = await Promise.all(
    PROXIES.map((build) => tryOneProxy(targetUrl, build, perProxy))
  );
  const firstOk = results.find((r) => r.ok && r.text);
  if (firstOk) return { ok: true, text: firstOk.text };
  return { ok: false, text: "", error: "네트워크 오류" };
}
