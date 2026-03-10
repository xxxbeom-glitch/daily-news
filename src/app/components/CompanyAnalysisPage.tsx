import { useState, useEffect } from "react";
import { Search, Loader2, ArrowLeft } from "lucide-react";
import { CompanyAnalysisResultView } from "./CompanyAnalysisResultView";
import { runCompanyAnalysis, type CompanyAnalysisResult } from "../utils/companyAnalysisApi";
import {
  loadCompanyAnalysisArchives,
  addCompanyAnalysisArchive,
  removeCompanyAnalysisArchive,
  type CompanyAnalysisArchiveItem,
} from "../utils/companyAnalysisArchiveStorage";

export function CompanyAnalysisPage() {
  const [companyName, setCompanyName] = useState("");
  const [result, setResult] = useState<CompanyAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<"분석" | "결과">("분석");
  const [archiveItems, setArchiveItems] = useState<CompanyAnalysisArchiveItem[]>([]);
  const [selectedArchive, setSelectedArchive] = useState<CompanyAnalysisArchiveItem | null>(null);

  const showBackButton = activeTab === "결과" && selectedArchive !== null;

  useEffect(() => {
    setArchiveItems(loadCompanyAnalysisArchives());
  }, [result, activeTab]);

  const handleAnalyze = async () => {
    const trimmed = companyName.trim();
    if (!trimmed) {
      setError("기업 이름을 입력해주세요.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const data = await runCompanyAnalysis(trimmed);
      if (data) {
        const item: CompanyAnalysisArchiveItem = {
          id: `company-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          companyName: trimmed,
          createdAt: new Date().toISOString(),
          result: data,
        };
        addCompanyAnalysisArchive(item);
        setResult(data);
      } else {
        setError("분석 결과를 가져오지 못했습니다.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "기업분석에 실패했습니다.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAnalyze();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-4 pt-5 pb-6">
      <div className="flex items-stretch gap-2 mb-4 shrink-0">
        {showBackButton ? (
          <button
            type="button"
            onClick={() => setSelectedArchive(null)}
            className="flex items-center justify-center w-10 h-10 shrink-0 rounded-[10px] border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors"
            title="목록"
          >
            <ArrowLeft size={18} />
          </button>
        ) : null}
        <div
          className={`flex-1 min-w-0 flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/5 px-3 h-10 overflow-hidden ${showBackButton ? "max-w-[calc(100%-3rem)]" : ""}`}
        >
          <Search size={16} className="text-white/40 shrink-0" />
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="기업 이름 입력"
            className="flex-1 min-w-[100px] bg-transparent text-white placeholder-white/40 outline-none py-0"
            style={{ fontSize: 12 }}
            disabled={analyzing}
          />
        </div>

        <div className="flex shrink-0 h-10 rounded-[10px] border border-white/10 bg-white/5 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setActiveTab("분석");
              setSelectedArchive(null);
            }}
            className={`flex-1 min-w-[52px] h-full flex items-center justify-center transition-colors border-r border-white/10 ${
              activeTab === "분석" ? "text-white" : "opacity-40"
            }`}
            style={{ fontSize: 12 }}
          >
            분석
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("결과")}
            className={`flex-1 min-w-[52px] h-full flex items-center justify-center transition-colors ${
              activeTab === "결과" ? "text-white" : "opacity-40"
            }`}
            style={{ fontSize: 12 }}
          >
            결과
          </button>
        </div>
      </div>

      {activeTab === "분석" && (
        <>
          {companyName.trim() && (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] bg-[#618EFF]/20 border border-[#618EFF]/40 text-[#618EFF] hover:bg-[#618EFF]/30 disabled:opacity-50 transition-colors mb-4"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              {analyzing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  분석 중…
                </>
              ) : (
                  "분석 실행"
                )}
            </button>
          )}

          {error && (
            <div
              className="mb-4 px-3 py-2 rounded-[8px] bg-red-500/10 border border-red-500/30 text-red-400"
              style={{ fontSize: 13 }}
            >
              {error}
            </div>
          )}

          {result && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <CompanyAnalysisResultView
                data={result}
                embedded={true}
              />
            </div>
          )}
        </>
      )}

      {activeTab === "결과" && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {selectedArchive ? (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-6">
              <CompanyAnalysisResultView
                data={selectedArchive.result}
                embedded={false}
                onDelete={() => {
                  removeCompanyAnalysisArchive(selectedArchive.id);
                  const next = loadCompanyAnalysisArchives();
                  setArchiveItems(next);
                  setSelectedArchive(null);
                }}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              {archiveItems.length === 0 ? (
                <div className="py-12 text-center text-white/50" style={{ fontSize: 14 }}>
                  저장된 기업분석 결과가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {archiveItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedArchive(item)}
                      className="w-full h-[72px] text-left rounded-[10px] border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/8 transition-colors flex flex-col justify-center"
                    >
                      <div
                        style={{ fontSize: 14, fontWeight: 600 }}
                        className="text-white/95 truncate"
                      >
                        {item.companyName}
                      </div>
                      <div style={{ fontSize: 12 }} className="text-white/40 mt-1">
                        {item.result?.metadata?.market && `${item.result.metadata.market} · `}
                        {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
