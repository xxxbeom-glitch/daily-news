/**
 * 기업분석 API - 설정의 System Instruction 사용
 */

import { getCompanyAnalysisSystemInstruction } from "./persistState";

export interface CompanyAnalysisResult {
  metadata: {
    company_name: string;
    ticker: string;
    market: string;
    last_updated: string;
  };
  analysis_sections: Array<{ title: string; content: string }>;
  key_summary: {
    growth_driver: string;
    risk_factor: string;
    overall_opinion: string;
  };
}

/** 기업분석 실행. 설정 > System Instruction을 system_instruction으로 사용. (현재는 null 반환) */
export async function runCompanyAnalysis(
  _companyName: string
): Promise<CompanyAnalysisResult | null> {
  const systemInstruction = getCompanyAnalysisSystemInstruction();
  void systemInstruction;
  return null;
}
