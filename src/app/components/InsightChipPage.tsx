import { useState, useCallback } from "react";
import { Clipboard, X, Loader2 } from "lucide-react";
import { runInsightAnalysis } from "../utils/insightAnalysis";
import { InsightReportView } from "./InsightReportView";
import { addInsightArchive } from "../utils/insightArchiveStorage";
import type { InsightArchiveItem } from "../data/insightReport";
import { getSelectedModelId } from "../utils/persistState";

/** 인사이트 칩은 Gemini 3 Flash 기본 사용 */
function getInsightModel(): "gemini" {
  return "gemini";
}

export function InsightChipPage() {
  const [inputValue, setInputValue] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<InsightArchiveItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        const url = text.trim();
        const hasProtocol = /^https?:\/\//i.test(url);
        setInputValue(hasProtocol ? url : `https://${url}`);
      }
    } catch {
      setError("클립보드 접근에 실패했습니다.");
    }
  }, []);

  const addChipFromInput = useCallback(() => {
    const v = inputValue.trim();
    if (!v) return;
    const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      new URL(url);
    } catch {
      setError("유효하지 않은 URL입니다.");
      return;
    }
    setChips((prev) => (prev.includes(url) ? prev : [...prev, url]));
    setInputValue("");
    setError(null);
  }, [inputValue]);

  const removeChip = useCallback((url: string) => {
    setChips((prev) => prev.filter((u) => u !== url));
  }, []);

  const runAnalysis = useCallback(async () => {
    const url = chips[0];
    if (!url) {
      setError("분석할 URL을 입력해주세요.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const modelId = getSelectedModelId();
      const geminiId = modelId.startsWith("gemini-") ? modelId : undefined;
      const res = await runInsightAnalysis({ url }, { modelId: geminiId });
      if (!res.ok) {
        setError(res.error ?? "분석 실패");
        return;
      }
      const item: InsightArchiveItem = {
        id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        url: res.url,
        title: res.title,
        source: res.source,
        createdAt: new Date().toISOString(),
        report: res.report,
        aiModel: getInsightModel(),
      };
      addInsightArchive(item);
      setResult(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }, [chips]);

  const handleKeyDown = (e: React.KeyboardEvent, isInput: boolean) => {
    if (e.key === "Enter") {
      if (isInput) addChipFromInput();
      else runAnalysis();
    }
  };

  return (
    <div className="flex flex-col min-h-full px-4 py-4">
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-2 items-center">
          <div className="flex-1 flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/5 px-3 py-2.5">
            <input
              type="text"
              placeholder="URL 링크 입력"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, true)}
              className="flex-1 min-w-0 bg-transparent text-white placeholder-white/40 outline-none"
              style={{ fontSize: 14 }}
              disabled={analyzing}
            />
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="p-2 rounded-[6px] text-white/50 hover:text-white/90 hover:bg-white/5 transition-colors shrink-0"
              title="클립보드 붙여넣기"
              disabled={analyzing}
            >
              <Clipboard size={18} />
            </button>
          </div>
          <button
            type="button"
            onClick={addChipFromInput}
            className="py-2.5 px-3 rounded-[10px] border border-[#618EFF]/40 bg-[#618EFF]/20 text-[#618EFF] hover:bg-[#618EFF]/30 transition-colors shrink-0"
            style={{ fontSize: 13, fontWeight: 500 }}
            disabled={analyzing}
          >
            추가
          </button>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((url) => (
              <div
                key={url}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 max-w-full"
              >
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/90 truncate max-w-[200px] hover:underline text-sm"
                >
                  {url}
                </a>
                <button
                  type="button"
                  onClick={() => removeChip(url)}
                  className="p-0.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                  title="제거"
                  disabled={analyzing}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {chips.length > 0 && (
          <button
            type="button"
            onClick={runAnalysis}
            disabled={analyzing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] bg-[#618EFF]/20 border border-[#618EFF]/40 text-[#618EFF] hover:bg-[#618EFF]/30 disabled:opacity-50 transition-colors"
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
          <div className="px-3 py-2 rounded-[8px] bg-red-500/10 border border-red-500/30 text-red-400" style={{ fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>

      {result && (
        <InsightReportView
          data={result.report}
          title={result.title}
          source={result.source}
          dateStr={new Date(result.createdAt).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            weekday: "short",
          })}
          aiModel={result.aiModel}
        />
      )}
    </div>
  );
}
