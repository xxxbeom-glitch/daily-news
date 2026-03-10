import { useState } from "react";
import { BarChart2 } from "lucide-react";

export function CompanyAnalysisPage() {
  const [companyName, setCompanyName] = useState("");
  const [analyzedCompany, setAnalyzedCompany] = useState<string | null>(null);

  const handleAnalyze = () => {
    const trimmed = companyName.trim();
    if (!trimmed) return;
    setAnalyzedCompany(trimmed);
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
          disabled={!companyName.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-[#618EFF]/40 bg-[#618EFF]/20 text-[#618EFF] hover:bg-[#618EFF]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ fontSize: 14, fontWeight: 600 }}
        >
          <BarChart2 size={18} />
          기업분석하기
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
        {analyzedCompany && (
          <div className="rounded-[10px] border border-white/10 bg-white/5 overflow-hidden p-4">
            <div style={{ fontSize: 14, fontWeight: 600 }} className="text-white/95 mb-2">
              {analyzedCompany}
            </div>
            <div className="rounded-[8px] border border-white/8 bg-white/5 px-4 py-6">
              <p style={{ fontSize: 13 }} className="text-white/50 text-center">
                분석 결과 영역 (데이터: null)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
