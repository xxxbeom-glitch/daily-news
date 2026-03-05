/**
 * PDF 파일에서 텍스트 추출 (pdfjs-dist)
 */

import * as pdfjsLib from "pdfjs-dist";

let workerInitialized = false;
function initWorker() {
  if (workerInitialized) return;
  const base = typeof window !== "undefined" ? window.location.origin + (import.meta.env.BASE_URL || "/") : "";
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${base.replace(/\/$/, "")}/pdf.worker.min.mjs`;
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
