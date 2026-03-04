/**
 * 저장된 아카이브 전체 → PDF 문서 → ZIP 파일로 내보내기
 */
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import type { ArchiveSession } from "../data/newsSources";
import type { IndexData, IssueItem, StockMover, EarningsItem } from "../data/marketSummary";

const PDF_WIDTH = 595;
const PDF_HEIGHT = 842;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sessionToPrintableHtml(session: ArchiveSession): string {
  const data = session.marketSummary;
  const aiModel = session.aiModel ?? "gemini";

  if (!data || !Array.isArray(data.indices)) {
    return `
      <div style="padding:24px;font-family:sans-serif;color:#111;font-size:14px;">
        <h2 style="margin:0 0 16px 0;">${escapeHtml(session.title)}</h2>
        <p style="color:#666;">이전 형식으로 저장된 아카이브입니다. 시황 요약을 확인할 수 없습니다.</p>
      </div>
    `;
  }

  const isIntl = data.regionLabel.includes("해외");
  const lineStyle = "line-height:1.5;";

  const indicesHtml = data.indices
    .map(
      (idx: IndexData) =>
        `<div style="${lineStyle} margin-bottom:4px;">
          <span style="font-size:14px;color:#111;">${escapeHtml(idx.name)}</span>
          <span style="font-size:14px;color:${idx.isUp ? "#059669" : "#dc2626"};">
            ${escapeHtml(idx.value)} ${escapeHtml(idx.change)}
          </span>
        </div>`
    )
    .join("");

  const issuesHtml = (data.keyIssues ?? [])
    .slice(0, isIntl ? 10 : 12)
    .map(
      (item: IssueItem) =>
        `<div style="margin-bottom:12px;">
          <div style="font-size:14px;font-weight:500;${lineStyle};">${escapeHtml(item.title)}</div>
          <div style="font-size:14px;color:#444;${lineStyle};margin-top:4px;">${escapeHtml(item.body)}</div>
        </div>`
    )
    .join("");

  const moversUpHtml = (data.moversUp ?? [])
    .map(
      (m: StockMover) =>
        `<div style="margin-bottom:6px;">
          <span style="font-size:14px;font-weight:500;">${escapeHtml(m.name)}</span>
          <span style="font-size:14px;color:#666;">(${escapeHtml(m.ticker)})</span>
          <span style="font-size:14px;color:${m.isUp ? "#059669" : "#dc2626"};">${escapeHtml(m.changeRate)}</span>
          <div style="font-size:13px;color:#555;${lineStyle};margin-top:2px;">${escapeHtml(m.reason)}</div>
        </div>`
    )
    .join("");

  const moversDownHtml = (data.moversDown ?? [])
    .map(
      (m: StockMover) =>
        `<div style="margin-bottom:6px;">
          <span style="font-size:14px;font-weight:500;">${escapeHtml(m.name)}</span>
          <span style="font-size:14px;color:#666;">(${escapeHtml(m.ticker)})</span>
          <span style="font-size:14px;color:${m.isUp ? "#059669" : "#dc2626"};">${escapeHtml(m.changeRate)}</span>
          <div style="font-size:13px;color:#555;${lineStyle};margin-top:2px;">${escapeHtml(m.reason)}</div>
        </div>`
    )
    .join("");

  const totalAssessment = data.totalAssessment?.trim() || (data.totalAssessmentError ? "(요약 오류)" : "");

  let earningsHtml = "";
  if (data.earningsPast && data.earningsPast.length > 0) {
    earningsHtml = `
      <div style="margin-top:18px;padding-top:18px;border-top:1px dashed #ddd;">
        <div style="font-size:14px;font-weight:600;${lineStyle};">간밤 실적 결과</div>
        <div style="margin-top:8px;">
          ${data.earningsPast
            .map(
              (e: EarningsItem) =>
                `<div style="margin-bottom:6px;">
                  <span style="font-size:14px;font-weight:500;">${escapeHtml(e.company)}</span>
                  <span style="font-size:14px;color:#666;">(${escapeHtml(e.ticker)})</span>
                  ${e.changeRate ? `<span style="font-size:14px;color:${e.changeRate.startsWith("+") ? "#059669" : "#dc2626"};">${escapeHtml(e.changeRate)}</span>` : ""}
                  <div style="font-size:13px;color:#555;${lineStyle};margin-top:2px;">${escapeHtml(e.result)}</div>
                </div>`
            )
            .join("")}
        </div>
      </div>
    `;
  }
  if (data.earningsUpcoming && data.earningsUpcoming.length > 0) {
    earningsHtml += `
      <div style="margin-top:12px;">
        <div style="font-size:14px;font-weight:600;${lineStyle};">예정 발표 일정</div>
        <div style="margin-top:6px;font-size:14px;color:#555;">
          ${data.earningsUpcoming.map((s: string) => `<div>${escapeHtml(s)}</div>`).join("")}
        </div>
      </div>
    `;
  }

  const articles = session.articles ?? [];
  const bySource = new Map<string, typeof articles>();
  for (const a of articles) {
    const src = a.source || "(출처 없음)";
    if (!bySource.has(src)) bySource.set(src, []);
    bySource.get(src)!.push(a);
  }
  const usedArticlesHtml =
    articles.length > 0
      ? `
    <div style="margin-top:24px;padding-top:24px;border-top:1px dashed #ddd;font-size:11px;color:#666;">
      <div style="font-weight:600;margin-bottom:8px;">사용된 기사 (${articles.length})</div>
      ${Array.from(bySource.entries())
        .map(
          ([source, items]) =>
            `<div style="margin-bottom:12px;">
              <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(source)}</div>
              <div>${items.map((a) => `<div style="margin-bottom:2px;">${escapeHtml(a.title)}</div>`).join("")}</div>
            </div>`
        )
        .join("")}
    </div>
  `
      : "";

  return `
    <div style="width:${PDF_WIDTH}px;padding:28px;font-family:'Malgun Gothic',sans-serif;background:#fff;color:#111;">
      <div style="border-bottom:1px dashed #ddd;padding-bottom:20px;margin-bottom:20px;">
        <div style="font-size:11px;color:#666;${lineStyle}">${escapeHtml(data.date)}</div>
        <div style="font-size:18px;font-weight:700;${lineStyle}">${escapeHtml(data.regionLabel)}</div>
        <div style="font-size:11px;color:#888;margin-top:6px;">Generated by ${aiModel === "gemini" ? "Gemini AI" : "ChatGPT"}</div>
      </div>
      <div style="margin-top:22px;padding-top:22px;border-top:1px dashed #ddd;">
        <div style="font-size:16px;font-weight:700;${lineStyle}">📝 오늘의 시황 총평</div>
        <div style="font-size:14px;${lineStyle};margin-top:14px;">${escapeHtml(totalAssessment) || "-"}</div>
      </div>
      <div style="margin-top:22px;padding-top:22px;border-top:1px dashed #ddd;">
        <div style="font-size:16px;font-weight:700;${lineStyle}">📊 대표 지수</div>
        <div style="margin-top:14px;">${indicesHtml}</div>
      </div>
      <div style="margin-top:22px;padding-top:22px;border-top:1px dashed #ddd;">
        <div style="font-size:16px;font-weight:700;${lineStyle}">📋 주요 이슈 정리</div>
        <div style="margin-top:14px;">${issuesHtml}</div>
      </div>
      ${(data.moversUp?.length ?? 0) + (data.moversDown?.length ?? 0) > 0 ? `
      <div style="margin-top:22px;padding-top:22px;border-top:1px dashed #ddd;">
        <div style="font-size:16px;font-weight:700;${lineStyle}">📈 ${escapeHtml(data.stockMoversLabel ?? "등락률")}</div>
        <div style="margin-top:14px;">
          <div style="font-size:14px;font-weight:600;${lineStyle}">상승</div>
          ${moversUpHtml}
          <div style="font-size:14px;font-weight:600;${lineStyle};margin-top:18px;">하락</div>
          ${moversDownHtml}
        </div>
      </div>
      ` : ""}
      ${earningsHtml}
      ${usedArticlesHtml}
    </div>
  `;
}

async function sessionToPdfBlob(session: ArchiveSession): Promise<Blob | null> {
  const html = sessionToPrintableHtml(session);
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-9999px;top:0;width:595px;background:#fff;z-index:-1;";
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: PDF_WIDTH,
    });

    document.body.removeChild(container);

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const imgW = PDF_WIDTH;
    const imgH = (canvas.height * PDF_WIDTH) / canvas.width;
    let h = imgH;
    let pos = 0;

    pdf.addImage(imgData, "JPEG", 0, pos, imgW, imgH);
    h -= PDF_HEIGHT;
    while (h > 0) {
      pos = -PDF_HEIGHT + (imgH - h);
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, pos, imgW, imgH);
      h -= PDF_HEIGHT;
    }

    return pdf.output("blob");
  } catch {
    try {
      document.body.removeChild(container);
    } catch {
      /* ignore */
    }
    return null;
  }
}

function sanitizeFilename(s: string): string {
  return s.replace(/[<>:"/\\|?*]/g, "_").slice(0, 80);
}

export async function exportArchivesToPdfZip(
  sessions: ArchiveSession[]
): Promise<{ ok: boolean; blob?: Blob; error?: string }> {
  const valid = sessions.filter(
    (s) => s.marketSummary && Array.isArray(s.marketSummary?.indices)
  );
  if (valid.length === 0 && sessions.length > 0) {
    return { ok: false, error: "PDF로 변환할 수 있는 아카이브가 없습니다." };
  }
  if (sessions.length === 0) {
    return { ok: false, error: "저장된 아카이브가 없습니다." };
  }

  const zip = new JSZip();
  const toProcess = valid.length > 0 ? valid : sessions;

  for (let i = 0; i < toProcess.length; i++) {
    const session = toProcess[i];
    const blob = await sessionToPdfBlob(session);
    if (blob) {
      const safeTitle = sanitizeFilename(session.title);
      const filename = `${safeTitle}.pdf`;
      zip.file(filename, blob);
    }
  }

  const names = Object.keys(zip.files);
  if (names.length === 0) {
    return { ok: false, error: "PDF 변환에 실패했습니다." };
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  return { ok: true, blob: zipBlob };
}
