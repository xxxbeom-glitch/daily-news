/**
 * PDF 파일에서 텍스트 추출 (pdfjs-dist)
 * 모바일 Safari 등에서 워커 로드 실패 시 CDN 폴백 사용
 * 삼성 브라우저 등에서 toHex 오류 시 legacy 빌드 사용
 */

const PDFJS_VERSION = "5.5.207";
const WORKER_CDN = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
const LEGACY_WORKER_CDN = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/legacy/build/pdf.worker.min.mjs`;

function isLegacyBrowser(): boolean {
  const ua = navigator.userAgent;
  return /Android|SamsungBrowser|Samsung|webOS/i.test(ua);
}

let pdfjsLib: Awaited<typeof import("pdfjs-dist")> | Awaited<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null =
  null;

async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  if (isLegacyBrowser()) {
    pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = LEGACY_WORKER_CDN;
  } else {
    pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN;
  }
  return pdfjsLib;
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const lib = await getPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: buffer }).promise;
  const numPages = pdf.numPages;
  const parts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    if (text.trim()) parts.push(text.trim());
  }

  return parts.join("\n\n");
}
