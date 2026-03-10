import { useState } from "react";
import { BarChart2 } from "lucide-react";
import { CompanyAnalysisResultView } from "./CompanyAnalysisResultView";
import { runCompanyAnalysis, type CompanyAnalysisResult } from "../utils/companyAnalysisApi";

export function CompanyAnalysisPage() {
  const [companyName, setCompanyName] = useState("");
  const [result, setResult] = useState<CompanyAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    const trimmed = companyName.trim();
    if (!trimmed) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const data = await runCompanyAnalysis(trimmed);
      if (data) setResult(data);
      else setError("분석 결과를 가져오지 못했습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "기업분석에 실패했습니다.");
    } finally {
      setAnalyzing(false);
    }
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
        {error && (
          <div style={{ fontSize: 13 }} className="text-red-400 py-3">
            {error}
          </div>
        )}
        {result && (
          <CompanyAnalysisResultView data={result} embedded={true} />
        )}
      </div>
    </div>
  );
}
