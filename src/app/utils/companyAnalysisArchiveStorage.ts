/**
 * 기업분석 아카이브 localStorage
 */

import type { CompanyAnalysisResult } from "./companyAnalysisApi";

export interface CompanyAnalysisArchiveItem {
  id: string;
  companyName: string;
  createdAt: string;
  result: CompanyAnalysisResult;
}

export const COMPANY_ANALYSIS_ARCHIVES_KEY = "newsbrief_company_analysis_archives";

export function loadCompanyAnalysisArchives(): CompanyAnalysisArchiveItem[] {
  try {
    const raw = localStorage.getItem(COMPANY_ANALYSIS_ARCHIVES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompanyAnalysisArchiveItem[];
    const items = Array.isArray(parsed) ? parsed : [];
    return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export function saveCompanyAnalysisArchives(items: CompanyAnalysisArchiveItem[]): void {
  try {
    localStorage.setItem(COMPANY_ANALYSIS_ARCHIVES_KEY, JSON.stringify(items));
  } catch {
    console.warn("[CompanyAnalysisArchive] localStorage 저장 실패");
  }
}

export function addCompanyAnalysisArchive(item: CompanyAnalysisArchiveItem): void {
  const items = loadCompanyAnalysisArchives();
  items.unshift(item);
  saveCompanyAnalysisArchives(items);
}

export function removeCompanyAnalysisArchive(id: string): void {
  const items = loadCompanyAnalysisArchives().filter((i) => i.id !== id);
  saveCompanyAnalysisArchives(items);
}
