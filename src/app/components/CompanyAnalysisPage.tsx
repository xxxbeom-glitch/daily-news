import { useState } from "react";
import { BarChart2 } from "lucide-react";
import { InsightReportView } from "./InsightReportView";
import { runCompanyAnalysis } from "../utils/companyAnalysisApi";
import type { InsightReportData } from "../data/insightReport";

const NULL_REPORT_DATA: InsightReportData = {
  articleSummary: ["(데이터 없음)"],
  keyPoints: "(데이터 없음)",
  score: 0,
  signal: "중립",
  strategy: "(데이터 없음)",
};

export function CompanyAnalysisPage() {
  const [companyName, setCompanyName] = useState("");
  const [analyzedCompany, setAnalyzedCompany] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    const trimmed = companyName.trim();
    if (!trimmed) return;
    setAnalyzing(true);
    const result = await runCompanyAnalysis(trimmed);
    setAnalyzing(false);
    setAnalyzedCompany(trimmed);
    void result;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-4 pt-5 pb-6">
      <div className="flex flex-col gap-4 mb-4 shrink-0">
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          placeholder="기업 이름을 입력하세요"
          className="w-full px-4 py-3 rounded-[10px] border border-white/10 bg-white/5 text-white placeholder-white/40 outline-none"
          style={{ fontSize: 14 }}
        />

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!companyName.trim() || analyzing}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-[#618EFF]/40 bg-[#618EFF]/20 text-[#618EFF] hover:bg-[#618EFF]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ fontSize: 14, fontWeight: 600 }}
        >
          <BarChart2 size={18} />
          {analyzing ? "분석 중…" : "기업분석하기"}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {analyzedCompany && (
          <InsightReportView
            data={NULL_REPORT_DATA}
            title={analyzedCompany}
            embedded={true}
          />
        )}
      </div>
    </div>
  );
}
