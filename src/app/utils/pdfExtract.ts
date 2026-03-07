/**
 * PDF 파일에서 텍스트 추출 (pdfjs-dist)
 * 모바일 Safari 등에서 워커 로드 실패 시 CDN 폴백 사용
 */

import * as pdfjsLib from "pdfjs-dist";

const PDFJS_VERSION = "5.5.207";
const WORKER_CDN = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

let workerInitialized = false;
function initWorker() {
  if (workerInitialized) return;
  // 모바일 Safari 등에서 로컬 워커 경로가 실패하는 경우가 있어 CDN 사용
  pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN;
  workerInitialized = true;
}

export async function extractTextFromPdf(file: File): Promise<string> {
  initWorker();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
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
