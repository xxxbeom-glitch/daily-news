import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Clipboard, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { runInsightAnalysis } from "../utils/insightAnalysis";
import { InsightReportView } from "./InsightReportView";
import { addInsightArchive, loadInsightArchives, removeInsightArchive } from "../utils/insightArchiveStorage";
import { saveInsightChipState, loadInsightChipState } from "../utils/persistState";
import type { InsightArchiveItem } from "../data/insightReport";
import { getSelectedModelId } from "../utils/persistState";

function getInsightModel(): "gemini" {
  return "gemini";
}

export function InsightChipPage() {
  const [inputValue, setInputValue] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<InsightArchiveItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"분석" | "아카이빙">("분석");
  const [archiveItems, setArchiveItems] = useState<InsightArchiveItem[]>([]);
  const [selectedArchive, setSelectedArchive] = useState<InsightArchiveItem | null>(null);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const hasRestoredRef = useRef(false);

  const allLabels = useMemo(() => {
    const set = new Set<string>();
    for (const item of archiveItems) {
      for (const l of item.report?.labels ?? []) {
        if (l?.trim()) set.add(l.trim());
      }
    }
    return Array.from(set).sort();
  }, [archiveItems]);

  const filteredItems = useMemo(() => {
    if (!filterLabel) return archiveItems;
    return archiveItems.filter(
      (i) => i.report?.labels?.some((l) => String(l).trim() === filterLabel) ?? false
    );
  }, [archiveItems, filterLabel]);

  useEffect(() => {
    setArchiveItems(loadInsightArchives());
  }, [result, activeTab]);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    const saved = loadInsightChipState();
    if (saved) {
      if (saved.activeTab) setActiveTab(saved.activeTab);
      if (Array.isArray(saved.chips) && saved.chips.length > 0) setChips([saved.chips[0]]);
      if (saved.result && typeof saved.result === "object") {
        const r = saved.result as InsightArchiveItem;
        if (r.report && r.id) setResult(r);
      }
      if (saved.selectedArchiveId) {
        const items = loadInsightArchives();
        const found = items.find((i) => i.id === saved.selectedArchiveId);
        if (found) setSelectedArchive(found);
      }
    }
  }, []);

  useEffect(() => {
    saveInsightChipState({
      activeTab,
      chips,
      result: result ? { ...result } : null,
      selectedArchiveId: selectedArchive?.id ?? null,
    });
  }, [activeTab, chips, result, selectedArchive]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        const url = /^https?:\/\//i.test(text.trim()) ? text.trim() : `https://${text.trim()}`;
        try {
          new URL(url);
          setChips([url]);
          setError(null);
        } catch {
          setError("유효하지 않은 URL입니다.");
        }
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
      setChips([url]);
      setInputValue("");
      setError(null);
    } catch {
      setError("유효하지 않은 URL입니다.");
    }
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
        publishedAt: res.publishedAt,
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") addChipFromInput();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-4 pt-5 pb-6">
      <div className="flex items-stretch gap-2 mb-4 shrink-0">
        <div className="flex-1 min-w-0 flex items-center gap-1.5 rounded-[10px] border border-white/10 bg-white/5 px-3 py-1 h-10 overflow-hidden">
          {chips.map((url) => (
            <div
              key={url}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/10 px-2 py-0.5 shrink-0"
            >
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/90 truncate max-w-[160px] hover:underline"
                style={{ fontSize: 12 }}
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
                <X size={12} />
              </button>
            </div>
          ))}
          <input
            type="text"
            placeholder={chips.length === 0 ? "URL 링크 입력" : ""}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-[120px] bg-transparent text-white placeholder-white/40 outline-none py-0"
            style={{ fontSize: 12 }}
            disabled={analyzing}
          />
          <button
            type="button"
            onClick={handlePasteFromClipboard}
            className="p-1 rounded-[6px] text-white/50 hover:text-white/90 hover:bg-white/5 transition-colors shrink-0"
            title="클립보드 붙여넣기"
            disabled={analyzing}
          >
            <Clipboard size={16} />
          </button>
        </div>

        <div className="flex shrink-0 h-10 rounded-[10px] border border-white/10 bg-white/5 overflow-hidden">
          <button
            type="button"
            onClick={() => { setActiveTab("분석"); setSelectedArchive(null); }}
            className={`flex-1 min-w-[52px] h-full flex items-center justify-center transition-colors border-r border-white/10 ${
              activeTab === "분석" ? "text-white" : "opacity-40"
            }`}
            style={{ fontSize: 12 }}
          >
            분석
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("아카이빙")}
            className={`flex-1 min-w-[52px] h-full flex items-center justify-center transition-colors ${
              activeTab === "아카이빙" ? "text-white" : "opacity-40"
            }`}
            style={{ fontSize: 12 }}
          >
            결과
          </button>
        </div>
      </div>

      {activeTab === "분석" && (
        <>
          {chips.length > 0 && (
            <button
              type="button"
              onClick={runAnalysis}
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
            <div className="mb-4 px-3 py-2 rounded-[8px] bg-red-500/10 border border-red-500/30 text-red-400" style={{ fontSize: 13 }}>
              {error}
            </div>
          )}

          {result && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <InsightReportView
                data={result.report}
                title={result.title}
                publishedAt={result.publishedAt}
                createdAt={result.createdAt}
                aiModel={result.aiModel}
              />
            </div>
          )}
        </>
      )}

      {activeTab === "아카이빙" && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {selectedArchive ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setSelectedArchive(null)}
                  className="text-white hover:underline"
                  style={{ fontSize: 13 }}
                >
                  목록
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeInsightArchive(selectedArchive.id);
                    setSelectedArchive(null);
                    setArchiveItems(loadInsightArchives());
                  }}
                  className="text-white/70 hover:text-red-400 transition-colors"
                  style={{ fontSize: 13 }}
                >
                  삭제하기
                </button>
              </div>
              <InsightReportView
                data={selectedArchive.report}
                title={selectedArchive.title}
                publishedAt={selectedArchive.publishedAt}
                createdAt={selectedArchive.createdAt}
                aiModel={selectedArchive.aiModel}
              />
            </div>
          ) : archiveItems.length === 0 ? (
            <div className="py-12 text-center text-white/50" style={{ fontSize: 14 }}>
              아카이브된 인사이트가 없습니다.
            </div>
          ) : (
            <div>
              {allLabels.length > 0 && (
                <div className="mb-3 rounded-[10px] border border-white/10 bg-white/5 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setTagsExpanded((e) => !e)}
                    className="w-full flex items-center justify-between text-left"
                    style={{ fontSize: 12 }}
                  >
                    <span className="text-white/70">전체 태그</span>
                    {tagsExpanded ? <ChevronUp size={16} className="text-white/50" /> : <ChevronDown size={16} className="text-white/50" />}
                  </button>
                  <div className={`flex flex-wrap gap-2 mt-2 ${tagsExpanded ? "" : "overflow-hidden max-h-8"}`}>
                    {allLabels.map((label, i) => {
                      const isActive = filterLabel === label;
                      const colors = ["bg-emerald-500/20 text-emerald-300", "bg-blue-500/20 text-blue-300", "bg-amber-500/20 text-amber-300", "bg-purple-500/20 text-purple-300", "bg-cyan-500/20 text-cyan-300"];
                      const colorClass = colors[i % colors.length];
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setFilterLabel(isActive ? null : label)}
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-opacity ${colorClass} ${isActive ? "ring-1 ring-white/50" : ""}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {filterLabel && (
                <div className="mb-2 flex items-center gap-2">
                  <span style={{ fontSize: 12 }} className="text-white/50">
                    "{filterLabel}" 필터 중
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterLabel(null)}
                    className="text-[#618EFF] hover:underline"
                    style={{ fontSize: 12 }}
                  >
                    해제
                  </button>
                </div>
              )}
              <div className="space-y-3">
                {filteredItems.length === 0 ? (
                  <div className="py-8 text-center text-white/50" style={{ fontSize: 13 }}>
                    해당 태그를 포함한 리포트가 없습니다.
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedArchive(item)}
                      className="w-full h-[72px] text-left rounded-[10px] border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/8 transition-colors flex flex-col justify-center"
                    >
                      <div style={{ fontSize: 14, fontWeight: 600 }} className="text-white/95 truncate">
                        {item.title || item.url}
                      </div>
                      <div style={{ fontSize: 12 }} className="text-white/40 mt-1">
                        {item.source && `${item.source} · `}
                        {item.publishedAt
                          ? new Date(item.publishedAt).toLocaleString("ko-KR")
                          : new Date(item.createdAt).toLocaleDateString("ko-KR")}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
