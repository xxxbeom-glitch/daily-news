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

/**
 * CORS 프록시를 통해 URL에서 텍스트 fetch (여러 프록시 순차 시도)
 */
export async function fetchViaCorsProxy(
  targetUrl: string,
  options?: { timeoutMs?: number }
): Promise<{ ok: boolean; text: string; error?: string }> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError: string | undefined;

  for (const buildProxyUrl of PROXIES) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const proxyUrl = buildProxyUrl(targetUrl);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }

      const text = await res.text();

      // allorigins.win은 JSON 래핑할 수 있음 - contents 필드 확인
      if (text.startsWith("{") && text.includes("contents")) {
        try {
          const json = JSON.parse(text) as { contents?: string };
          const contents = json?.contents;
          if (typeof contents === "string") return { ok: true, text: contents };
        } catch {
          // JSON 파싱 실패 시 원본 텍스트 사용
        }
      }

      return { ok: true, text };
    } catch (e) {
      clearTimeout(timeout);
      lastError = e instanceof Error ? e.message : "네트워크 오류";
    }
  }

  return { ok: false, text: "", error: lastError };
}
