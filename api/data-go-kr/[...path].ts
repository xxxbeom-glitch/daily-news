/**
 * 공공데이터 API 프록시 (Vercel 프로덕션용)
 * - 개발: Vite proxy (vite.config.ts)
 * - 프로덕션: 이 서버리스 함수가 /api/data-go-kr/* 요청을 apis.data.go.kr로 전달
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathSeg = (req.query.path as string[]) ?? [];
  const path = pathSeg.join("/");
  const q = { ...req.query };
  delete q.path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v != null) params.set(k, Array.isArray(v) ? v[0]! : String(v));
  }
  const search = params.toString() ? "?" + params.toString() : "";
  const target = `https://apis.data.go.kr/${path}${search}`;

  try {
    const proxyRes = await fetch(target, {
      method: req.method ?? "GET",
      headers: {
        "Accept": "application/json",
        ...(req.headers["content-type"] ? { "Content-Type": req.headers["content-type"] as string } : {}),
      },
    });

    const contentType = proxyRes.headers.get("content-type") ?? "application/json";
    res.setHeader("Content-Type", contentType);
    res.status(proxyRes.status);

    if (contentType.includes("json")) {
      const json = await proxyRes.json();
      return res.json(json);
    }
    const text = await proxyRes.text();
    return res.send(text);
  } catch (err) {
    console.error("[data-go-kr proxy]", err);
    res.status(502).json({ error: "프록시 요청 실패" });
  }
}
