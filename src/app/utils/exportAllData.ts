/**
 * 전체 데이터 백업: 리포트, 인사이트칩, 기업분석, 설정 → JSON ZIP
 */
import JSZip from "jszip";
import { ARCHIVES_STORAGE_KEY } from "./archiveStorage";
import { loadInsightArchives } from "./insightArchiveStorage";
import { loadCompanyAnalysisArchives } from "./companyAnalysisArchiveStorage";
import {
  getSelectedSources,
  getInterestMemoryDomestic,
  getInterestMemoryInternational,
  getSelectedModel,
  getSelectedModelId,
  getCompanyAnalysisSystemInstruction,
} from "./persistState";

export interface BackupData {
  version: number;
  exportedAt: string;
  sessions: unknown[];
  insightArchives: unknown[];
  companyAnalysisArchives: unknown[];
  settings: {
    selectedSources: unknown;
    interestMemoryDomestic: string;
    interestMemoryInternational: string;
    selectedModel: string;
    selectedModelId: string;
    companyAnalysisSystemInstruction: string;
  };
}

export async function exportAllDataToZip(): Promise<{ ok: boolean; blob?: Blob; error?: string }> {
  try {
    const sessionsRaw = localStorage.getItem(ARCHIVES_STORAGE_KEY);
    const sessions = sessionsRaw ? (JSON.parse(sessionsRaw) as unknown[]) : [];
    const insightArchives = loadInsightArchives();
    const companyAnalysisArchives = loadCompanyAnalysisArchives();
    const selectedSources = getSelectedSources();
    const interestMemoryDomestic = getInterestMemoryDomestic();
    const interestMemoryInternational = getInterestMemoryInternational();
    const selectedModel = getSelectedModel();
    const selectedModelId = getSelectedModelId();
    const companyAnalysisSystemInstruction = getCompanyAnalysisSystemInstruction();

    const backup: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions,
      insightArchives,
      companyAnalysisArchives,
      settings: {
        selectedSources,
        interestMemoryDomestic,
        interestMemoryInternational,
        selectedModel,
        selectedModelId,
        companyAnalysisSystemInstruction,
      },
    };

    const zip = new JSZip();
    zip.file("backup.json", JSON.stringify(backup, null, 2), { compression: "DEFLATE", compressionOptions: { level: 6 } });
    const zipBlob = await zip.generateAsync({ type: "blob" });
    return { ok: true, blob: zipBlob };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "백업 생성 실패";
    return { ok: false, error: msg };
  }
}
