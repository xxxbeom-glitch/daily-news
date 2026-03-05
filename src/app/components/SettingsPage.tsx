import { useState, useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, Sparkles, Cpu, Trash2, Download, Cloud, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { useArchive } from "../context/ArchiveContext";
import { domesticSources, internationalSources } from "../data/newsSources";
import { getSelectedSources, setSelectedSources, getInterestMemoryDomestic, setInterestMemoryDomestic, getInterestMemoryInternational, setInterestMemoryInternational, getSelectedModelId, setSelectedModelId, SELECTED_MODEL_CHANGED_EVENT } from "../utils/persistState";
import { GEMINI_MODELS, CLAUDE_MODELS, OPENAI_MODELS } from "../utils/adminSettings";
import { saveBlobToLocalStorage, uploadBlobToGoogleDrive } from "../utils/exportArchives";
import { exportArchivesToPdfZip } from "../utils/exportPdfZip";
import { fetchViaCorsProxy } from "../utils/corsProxy";


const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

const RSS_CHECK_TIMEOUT_MS = 10000;

async function checkRssFeed(url: string, sourceId?: string): Promise<boolean> {
  const useRss2Json = (sourceId ?? "").startsWith("gn_") || (sourceId ?? "").startsWith("rss_") || sourceId === "yna_economy";
  if (useRss2Json) {
    const rss2JsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
    const { ok, text } = await fetchViaCorsProxy(rss2JsonUrl, { timeoutMs: RSS_CHECK_TIMEOUT_MS });
    if (ok && /"status"\s*:\s*"ok"/.test(text ?? "")) return true;
  }
  const urls = [url];
  for (const u of urls) {
    const { ok, text } = await fetchViaCorsProxy(u, { timeoutMs: RSS_CHECK_TIMEOUT_MS });
    if (ok && (text.includes("<rss") || text.includes("<feed") || text.includes("<?xml"))) return true;
  }
  return false;
}

function getApiKey(name: "VITE_GEMINI_API_KEY" | "VITE_OPENAI_API_KEY" | "VITE_ANTHROPIC_API_KEY"): string {
  let key = (import.meta.env[name] as string) ?? "";
  return key.trim().replace(/^["']|["']$/g, "");
}

async function checkGeminiApi(): Promise<{ ok: boolean; message?: string }> {
  const key = getApiKey("VITE_GEMINI_API_KEY");
  if (!key) {
    return { ok: false, message: "API 키가 설정되지 않았습니다. (.env에 VITE_GEMINI_API_KEY 추가)" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) return { ok: true };
    const err = await res.json().catch(() => ({})) as { error?: { message?: string }; message?: string };
    const msg = err?.error?.message ?? err?.message ?? `HTTP ${res.status}`;
    return { ok: false, message: msg };
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : "연결 실패";
    return { ok: false, message: msg };
  }
}

async function checkAnthropicApi(): Promise<{ ok: boolean; message?: string }> {
  const key = getApiKey("VITE_ANTHROPIC_API_KEY");
  if (!key) {
    return { ok: false, message: "API 키가 설정되지 않았습니다. (.env에 VITE_ANTHROPIC_API_KEY 추가)" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 5,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (res.ok) return { ok: true };
    const msg = data?.error?.message || `HTTP ${res.status}`;
    return { ok: false, message: msg };
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : "연결 실패";
    return { ok: false, message: msg };
  }
}

async function checkOpenAIApi(): Promise<{ ok: boolean; message?: string }> {
  const key = getApiKey("VITE_OPENAI_API_KEY");
  if (!key) {
    return { ok: false, message: "API 키가 설정되지 않았습니다. (.env에 VITE_OPENAI_API_KEY 추가)" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 5,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string; type?: string } };
    if (res.ok) return { ok: true };
    const err = data?.error;
    const msg = err?.message || `HTTP ${res.status}`;
    const code = err?.code ?? (res.status === 429 ? "rate_limit_exceeded" : res.status === 401 ? "invalid_api_key" : "");
    const fullMsg = code ? `${msg} [${code}]` : msg;
    return { ok: false, message: fullMsg };
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : "연결 실패";
    return { ok: false, message: msg };
  }
}

async function checkConnectionStatus(
  sources: { id: string; rssUrl: string }[]
): Promise<{
  sourceStatus: Record<string, "ok" | "error">;
  apiStatus: {
    gpt: "ok" | "error";
    gemini: "ok" | "error";
    anthropic: "ok" | "error";
    errorMessage: string;
  };
}> {
  const [sourceResults, geminiResult, gptResult, anthropicResult] = await Promise.all([
    Promise.all(
      sources
        .filter((s) => s.id !== "finnhub")
        .map(async (s) => {
          const ok = await checkRssFeed(s.rssUrl, s.id);
          return [s.id, ok ? "ok" as const : "error" as const] as const;
        })
    ),
    checkGeminiApi(),
    checkOpenAIApi(),
    checkAnthropicApi(),
  ]);

  const sourceStatus = Object.fromEntries(sourceResults);
  const translateError = (msg: string | undefined): string => {
    if (!msg) return "연결 실패";
    if (msg.includes("quota") || msg.includes("billing") || msg.includes("exceeded") || msg.includes("rate_limit")) return "할당량 초과";
    if ((msg.includes("Invalid") && msg.includes("key")) || msg.includes("invalid_api_key") || msg.includes("401")) return "API 키 오류";
    if (msg.includes("403") || msg.includes("region") || msg.includes("country")) return "지역 제한";
    if (msg.includes("not found") || msg.includes("model")) return "모델 오류";
    return msg.length > 50 ? msg.slice(0, 50) + "…" : msg;
  };
  const errors: string[] = [];
  if (!geminiResult.ok) errors.push(`Gemini: ${translateError(geminiResult.message)}`);
  if (!gptResult.ok) errors.push(`ChatGPT: ${translateError(gptResult.message)}`);
  if (!anthropicResult.ok) errors.push(`Claude: ${translateError(anthropicResult.message)}`);
  if (errors.length === 0) errors.push("모든 API 연결 정상");

  return {
    sourceStatus,
    apiStatus: {
      gpt: gptResult.ok ? "ok" : "error",
      gemini: geminiResult.ok ? "ok" : "error",
      anthropic: anthropicResult.ok ? "ok" : "error",
      errorMessage: errors.join(" / "),
    },
  };
}

export function SettingsPage() {
  const { sessions, clearAllSessions } = useArchive();
  const [aiEngineExpanded, setAiEngineExpanded] = useState(false);
  const [memoryExpanded, setMemoryExpanded] = useState(false);
  const [interestMemoryDomestic, setInterestMemoryDomesticState] = useState(() => getInterestMemoryDomestic());
  const [interestMemoryInternational, setInterestMemoryInternationalState] = useState(() => getInterestMemoryInternational());
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [apiExpanded, setApiExpanded] = useState(false);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ type: string; ok: boolean; message: string } | null>(null);
  const [exportPdfLoading, setExportPdfLoading] = useState(false);
  const [sourceStatus, setSourceStatus] = useState<Record<string, "ok" | "error">>(() => {
    const ids = [
      ...domesticSources.map((s) => s.id),
      ...internationalSources.map((s) => s.id),
    ];
    return Object.fromEntries(ids.map((id) => [id, "ok" as const]));
  });
  const [apiStatus, setApiStatus] = useState({
    gpt: "error" as "ok" | "error",
    gemini: "ok" as "ok" | "error",
    anthropic: "error" as "ok" | "error",
    errorMessage: "API 연결 상태 확인 중…",
  });
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);
  const [selectedSourceIds, setSelectedSourceIds] = useState<{ domestic: string[]; international: string[] }>(() =>
    getSelectedSources()
  );
  const [selectedModelId, setSelectedModelIdState] = useState<string>(() => getSelectedModelId());

  useEffect(() => {
    const handler = () => setSelectedModelIdState(getSelectedModelId());
    window.addEventListener(SELECTED_MODEL_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SELECTED_MODEL_CHANGED_EVENT, handler);
  }, []);

  const handleSetSelectedModelId = (modelId: string) => {
    setSelectedModelIdState(modelId);
  };

  const handleSaveSelectedModel = () => {
    setSelectedModelId(selectedModelId);
  };

  const getModelLabel = (id: string): string => {
    if (id.startsWith("gemini-")) return `Gemini (${id})`;
    if (id.startsWith("claude-")) return `Claude (${id})`;
    if (id.startsWith("gpt-")) return `ChatGPT (${id})`;
    return id;
  };

  const allSources = useMemo(
    () => [...domesticSources, ...internationalSources],
    []
  );

  const toggleSourceSelection = useCallback((id: string, region: "domestic" | "international") => {
    setSelectedSourceIds((prev) => {
      const list = prev[region];
      const next = list.includes(id)
        ? list.filter((x) => x !== id)
        : [...list, id];
      const nextState = { ...prev, [region]: next };
      setSelectedSources(nextState);
      return nextState;
    });
  }, []);

  const runCheck = useCallback(async () => {
    setIsChecking(true);
    try {
      const { sourceStatus: s, apiStatus: a } = await checkConnectionStatus(allSources);
      setSourceStatus(s);
      setApiStatus(a);
      setLastCheckTime(Date.now());
    } finally {
      setIsChecking(false);
    }
  }, [allSources]);

  const handleRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastCheckTime < REFRESH_COOLDOWN_MS && lastCheckTime > 0) {
      const remain = Math.ceil((REFRESH_COOLDOWN_MS - (now - lastCheckTime)) / 60000);
      alert(`새로고침은 5분에 한 번만 가능합니다. (${remain}분 후)`);
      return;
    }
    runCheck();
  }, [lastCheckTime, runCheck]);

  // 진입 시 1회 + 6시간마다 자동 체크
  useEffect(() => {
    runCheck();
    const interval = setInterval(runCheck, SIX_HOURS_MS);
    return () => clearInterval(interval);
  }, [runCheck]);

  const handleClearAllClick = () => {
    setDeleteConfirm(true);
  };

  const handleClearAllConfirm = () => {
    clearAllSessions();
    setDeleteConfirm(false);
  };

  const handleClearAllCancel = () => {
    setDeleteConfirm(false);
  };

  const handleExportPdfZipToStorage = async () => {
    setExportPdfLoading(true);
    try {
      const { ok, blob, error } = await exportArchivesToPdfZip(sessions);
      setShowExportMenu(false);
      if (!ok || !blob) {
        setExportStatus({ type: "pdfzip", ok: false, message: error || "PDF 변환 실패" });
      } else {
        const filename = `newsbrief-archives-${new Date().toISOString().slice(0, 10)}.zip`;
        const result = await saveBlobToLocalStorage(blob, filename);
        setExportStatus({
          type: "pdfzip",
          ok: result.ok,
          message: result.ok ? "PDF(ZIP)로 내부저장소에 저장되었습니다." : (result.error || "저장 실패"),
        });
      }
    } finally {
      setExportPdfLoading(false);
      setTimeout(() => setExportStatus(null), 4000);
    }
  };

  const handleExportPdfZipToGoogleDrive = async () => {
    setExportPdfLoading(true);
    try {
      const { ok, blob, error } = await exportArchivesToPdfZip(sessions);
      setShowExportMenu(false);
      if (!ok || !blob) {
        setExportStatus({ type: "pdfzip", ok: false, message: error || "PDF 변환 실패" });
      } else {
        const filename = `newsbrief-archives-${new Date().toISOString().slice(0, 10)}.zip`;
        const result = await uploadBlobToGoogleDrive(blob, filename, "application/zip");
        setExportStatus({
          type: "pdfzip",
          ok: result.ok,
          message: result.ok ? "PDF(ZIP)가 구글 드라이브에 저장되었습니다." : (result.error || "업로드 실패"),
        });
      }
    } finally {
      setExportPdfLoading(false);
      setTimeout(() => setExportStatus(null), 4000);
    }
  };

  return (
    <div className="flex flex-col min-h-full px-4 pt-6 pb-8 w-full">
      {exportStatus && (
        <div
          className={`fixed bottom-6 left-4 right-4 max-w-[430px] mx-auto px-4 py-3 rounded-[10px] z-[110] ${
            exportStatus.ok
              ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
              : "bg-red-500/20 border border-red-500/40 text-red-300"
          }`}
          style={{ fontSize: 14 }}
          role="status"
        >
          {exportStatus.message}
        </div>
      )}
      {deleteConfirm && (
        <>
          <div
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm"
            onClick={handleClearAllCancel}
            aria-hidden
          />
          <div className="fixed inset-0 z-[111] flex items-center justify-center p-4">
            <div
              className="w-full max-w-[340px] rounded-[10px] border border-white/10 bg-[#12121a] shadow-xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-white mb-1" style={{ fontSize: 16, fontWeight: 600 }}>
                전체 삭제
              </p>
              <p className="text-white/60 mb-5" style={{ fontSize: 14, lineHeight: 1.5 }}>
                저장된 아카이브를 모두 삭제하시겠습니까?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearAllCancel}
                  className="flex-1 py-2.5 rounded-[10px] border border-white/10 bg-white/5 text-white/80 hover:bg-white/8 transition-colors"
                  style={{ fontSize: 14, fontWeight: 500 }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleClearAllConfirm}
                  className="flex-1 py-2.5 rounded-[10px] border border-red-500/50 bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  style={{ fontSize: 14, fontWeight: 500 }}
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* AI 엔진 설정 */}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <button
            type="button"
            onClick={() => setAiEngineExpanded((v) => !v)}
            className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors text-left px-4"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            <span>AI 엔진</span>
            <span className="flex items-center gap-2 text-white/60 font-normal truncate max-w-[60%]">
              {getModelLabel(selectedModelId)}
              <ChevronDown
                size={16}
                className={`transition-transform shrink-0 ${aiEngineExpanded ? "rotate-180" : ""}`}
              />
            </span>
          </button>
          {aiEngineExpanded && (
            <div className="px-4 pb-4 pt-4 border-t border-white/6 divide-y divide-white/6 max-h-[280px] overflow-y-auto">
              {GEMINI_MODELS.map((id) => (
                <label key={id} className="flex items-center gap-3 py-3 cursor-pointer">
                  <input
                    type="radio"
                    name="ai-engine"
                    checked={selectedModelId === id}
                    onChange={() => handleSetSelectedModelId(id)}
                    className="w-4 h-4 border-white/20 bg-white/5 text-[#618EFF] focus:ring-[#618EFF]/50"
                  />
                  <span style={{ fontSize: 14 }} className="text-white/90">{getModelLabel(id)}</span>
                </label>
              ))}
              {CLAUDE_MODELS.map((id) => (
                <label key={id} className="flex items-center gap-3 py-3 cursor-pointer">
                  <input
                    type="radio"
                    name="ai-engine"
                    checked={selectedModelId === id}
                    onChange={() => handleSetSelectedModelId(id)}
                    className="w-4 h-4 border-white/20 bg-white/5 text-[#618EFF] focus:ring-[#618EFF]/50"
                  />
                  <span style={{ fontSize: 14 }} className="text-white/90">{getModelLabel(id)}</span>
                </label>
              ))}
              {OPENAI_MODELS.map((id) => (
                <label key={id} className="flex items-center gap-3 py-3 cursor-pointer">
                  <input
                    type="radio"
                    name="ai-engine"
                    checked={selectedModelId === id}
                    onChange={() => handleSetSelectedModelId(id)}
                    className="w-4 h-4 border-white/20 bg-white/5 text-[#618EFF] focus:ring-[#618EFF]/50"
                  />
                  <span style={{ fontSize: 14 }} className="text-white/90">{getModelLabel(id)}</span>
                </label>
              ))}
              <button
                type="button"
                onClick={handleSaveSelectedModel}
                className="mt-3 w-full py-2.5 rounded-[10px] bg-[#618EFF]/20 hover:bg-[#618EFF]/30 text-[#618EFF] border border-[#618EFF]/40 text-sm font-medium transition-colors"
              >
                저장
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 기억할 관심사 - 숨김 */}
      {false && (
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <button
            type="button"
            onClick={() => setMemoryExpanded((v) => !v)}
            className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors text-left px-4"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            기억할 관심사
            <ChevronDown size={16} className={`text-white/60 transition-transform shrink-0 ${memoryExpanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </section>
      )}

      {/* 언론사 연결상태 - 숨김 */}
      {false && (
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <div className="flex items-center justify-between px-4 h-[72px]">
            <button
              type="button"
              onClick={() => setSourcesExpanded((v) => !v)}
              className="flex items-center gap-2 text-white hover:opacity-90 transition-opacity text-left flex-1 min-w-0"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              언론사 연결상태
              <ChevronDown
                size={16}
                className={`text-white/60 transition-transform shrink-0 ${sourcesExpanded ? "rotate-180" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isChecking}
              className="flex items-center gap-1.5 rounded-[6px] border border-white/10 bg-white/5 px-2.5 py-1.5 text-white/60 hover:text-white/80 hover:bg-white/8 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              style={{ fontSize: 12 }}
            >
              <RefreshCw size={14} className={isChecking ? "animate-spin" : ""} />
              새로고침
            </button>
          </div>
          {sourcesExpanded && (
          <div className="border-t border-white/6 px-4 pb-4 pt-4">
            <div className="text-white/40 mb-2" style={{ fontSize: 12, fontWeight: 600 }}>
              국내 언론사
              <span className="text-white/30 ml-1" style={{ fontSize: 11, fontWeight: 400 }}>
                (해외 시황: 뉴욕증시·나스닥·S&P500 등 포함 기사 반영)
              </span>
            </div>
            <div className="divide-y divide-white/6 mb-4">
            {domesticSources.map((s) => {
              const status = sourceStatus[s.id] ?? "ok";
              const isSelected = selectedSourceIds.domestic.includes(s.id);
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSourceSelection(s.id, "domestic")}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#618EFF] focus:ring-[#618EFF]/50"
                    />
                    <span style={{ fontSize: 14 }} className="text-white/90 truncate">{s.name}</span>
                  </label>
                  <span className={`flex items-center gap-1.5 shrink-0 ${status === "ok" ? "text-emerald-400" : "text-red-400"}`} style={{ fontSize: 13 }}>
                    {status === "ok" ? <><CheckCircle2 size={14} />정상</> : <><XCircle size={14} />오류</>}
                  </span>
                </div>
              );
            })}
            </div>
            <div className="text-white/40 mb-2" style={{ fontSize: 12, fontWeight: 600 }}>해외 시황 RSS</div>
            <div className="divide-y divide-white/6">
            {internationalSources.map((s) => {
              const status = sourceStatus[s.id] ?? "ok";
              const isSelected = selectedSourceIds.international.includes(s.id);
              const label = s.id.startsWith("rss_") ? "[시황] " : "";
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSourceSelection(s.id, "international")}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#618EFF] focus:ring-[#618EFF]/50"
                    />
                    <span style={{ fontSize: 14 }} className="text-white/90 truncate">
                      {label}{s.name}
                    </span>
                  </label>
                  <span className={`flex items-center gap-1.5 shrink-0 ${status === "ok" ? "text-emerald-400" : "text-red-400"}`} style={{ fontSize: 13 }}>
                    {status === "ok" ? <><CheckCircle2 size={14} />정상</> : <><XCircle size={14} />오류</>}
                  </span>
                </div>
              );
            })}
            </div>
          </div>
          )}
        </div>
      </section>
      )}

      {/* API 연결상태 */}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <div className="flex items-center justify-between px-4 h-[72px]">
            <button
              type="button"
              onClick={() => setApiExpanded((v) => !v)}
              className="flex items-center gap-2 text-white hover:opacity-90 transition-opacity text-left flex-1 min-w-0"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              API 연결상태
              <ChevronDown
                size={16}
                className={`text-white/60 transition-transform shrink-0 ${apiExpanded ? "rotate-180" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isChecking}
              className="flex items-center gap-1.5 rounded-[6px] border border-white/10 bg-white/5 px-2.5 py-1.5 text-white/60 hover:text-white/80 hover:bg-white/8 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              style={{ fontSize: 12 }}
            >
              <RefreshCw size={14} className={isChecking ? "animate-spin" : ""} />
              새로고침
            </button>
          </div>
          {apiExpanded && (
          <div className="border-t border-white/6 divide-y divide-white/6 px-4 pb-4 pt-4">
          {[
            { key: "gemini" as const, label: "Gemini", icon: Sparkles },
            { key: "anthropic" as const, label: "Claude", icon: null },
            { key: "gpt" as const, label: "ChatGPT", icon: Cpu },
          ].map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                {Icon && <Icon size={16} className="text-white/70" />}
                <span style={{ fontSize: 14 }} className="text-white/90">{label}</span>
              </div>
              <span className={`flex items-center gap-1.5 ${apiStatus[key] === "ok" ? "text-emerald-400" : "text-red-400"}`} style={{ fontSize: 13 }}>
                {apiStatus[key] === "ok" ? (
                  <>
                    <CheckCircle2 size={14} />
                    연결
                  </>
                ) : (
                  <>
                    <XCircle size={14} />
                    오류
                  </>
                )}
              </span>
            </div>
          ))}
          <div className="pt-2">
            <div style={{ fontSize: 12 }} className="text-white/40 mb-1">
              {apiStatus.gpt === "ok" && apiStatus.gemini === "ok" && apiStatus.anthropic === "ok" ? "상태" : "오류내용"} :
            </div>
            <div
              className="rounded-[8px] bg-white/5 border border-white/8 px-3 py-2"
              style={{ fontSize: 13, lineHeight: 1.5 }}
            >
              <span className={apiStatus.gpt === "ok" && apiStatus.gemini === "ok" && apiStatus.anthropic === "ok" ? "text-emerald-400/90" : "text-red-400/90"}>
                {apiStatus.errorMessage}
              </span>
            </div>
          </div>
          </div>
          )}
        </div>
      </section>

      {/* 저장된 아카이브 - 숨김 */}
      {false && (
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <button type="button" className="w-full h-[72px]">
            저장된 아카이브
          </button>
          <div className="px-4 pb-4 pt-4 border-t border-white/6 space-y-2">
          <button
            type="button"
            onClick={handleClearAllClick}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-white/10 bg-white/5 text-white/70 hover:bg-white/8 transition-colors"
            style={{ fontSize: 14 }}
          >
            <Trash2 size={16} />
            전체삭제
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu((v) => !v)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-white/10 bg-white/5 text-white/70 hover:bg-white/8 transition-colors"
              style={{ fontSize: 14 }}
            >
              <Download size={16} />
              내보내기
            </button>
            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-[100]"
                  onClick={() => setShowExportMenu(false)}
                  aria-hidden
                />
                <div className="fixed bottom-24 left-4 right-4 max-w-[430px] mx-auto rounded-[10px] border border-white/10 bg-[#12121a] shadow-xl z-[101] overflow-hidden">
                  <button
                    type="button"
                    onClick={handleExportPdfZipToStorage}
                    disabled={exportPdfLoading || sessions.length === 0}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left border-t border-white/6 first:border-t-0 disabled:opacity-50"
                    style={{ fontSize: 14 }}
                  >
                    <Download size={18} className="text-white/60" />
                    <span className="text-white/90">
                      {exportPdfLoading ? "PDF 생성 중…" : "PDF(ZIP) · 내부저장소에 저장"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdfZipToGoogleDrive}
                    disabled={exportPdfLoading || sessions.length === 0}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left border-t border-white/6 disabled:opacity-50"
                    style={{ fontSize: 14 }}
                  >
                    <Cloud size={18} className="text-white/60" />
                    <span className="text-white/90">
                      {exportPdfLoading ? "PDF 생성 중…" : "PDF(ZIP) · 구글드라이브에 저장"}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
          <Link
            to="/"
            className="block mt-2 text-[#618EFF] hover:text-[#8BABFF]"
            style={{ fontSize: 13 }}
          >
            오늘의 시황에서 보기 →
          </Link>
          {sessions.length > 0 && (
            <p style={{ fontSize: 12 }} className="text-white/35 mt-1">
              저장된 시황 {sessions.length}건
            </p>
          )}
          </div>
        </div>
      </section>
      )}

      {/* 로그인 */}
      <section className="mb-4">
        <Link
          to="/settings/login"
          className="block bg-white/5 border border-white/8 rounded-[10px] overflow-hidden"
        >
          <div className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors px-4">
            <span style={{ fontSize: 14, fontWeight: 600 }}>로그인</span>
            <ChevronRight size={20} className="text-white/40 shrink-0" />
          </div>
        </Link>
      </section>

      {/* 관리자 기능 */}
      <section className="mb-4">
        <Link
          to="/settings/admin"
          className="block bg-white/5 border border-white/8 rounded-[10px] overflow-hidden"
        >
          <div className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors px-4">
            <span style={{ fontSize: 14, fontWeight: 600 }}>관리자</span>
            <ChevronRight size={20} className="text-white/40 shrink-0" />
          </div>
        </Link>
      </section>

      {/* 차트 라이선스 (lightweight-charts attributionLogo 비활성화 시 요구사항) */}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden px-4 py-3">
          <p style={{ fontSize: 12 }} className="text-white/50">
            오늘의 시장 차트는 TradingView lightweight-charts를 사용합니다.{" "}
            <a
              href="https://www.tradingview.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#618EFF] hover:underline"
            >
              TradingView
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
