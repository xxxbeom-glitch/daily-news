import { useState, useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, Sparkles, Cpu, Bot, Trash2, Download, Cloud, RefreshCw, ChevronDown, ChevronRight, CloudDownload, CloudUpload, Plus } from "lucide-react";
import { useArchive } from "../context/ArchiveContext";
import { useFirebase } from "../context/FirebaseContext";
import { getEffectiveSources, type ArchiveSession } from "../data/newsSources";
import { addCustomSource, removeCustomSource, isCustomSourceId } from "../utils/customRssStorage";
import { getSelectedSources, setSelectedSources, getSelectedModelId, setSelectedModelId as persistSetSelectedModelId } from "../utils/persistState";
import { GEMINI_MODELS, CLAUDE_MODELS, OPENAI_MODELS } from "../utils/adminSettings";
import { saveBlobToLocalStorage, uploadBlobToGoogleDrive } from "../utils/exportArchives";
import { exportArchivesToPdfZip } from "../utils/exportPdfZip";
import { fetchViaCorsProxy } from "../utils/corsProxy";


const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

const RSS_CHECK_TIMEOUT_MS = 10000;

async function checkRssFeed(url: string, sourceId?: string): Promise<boolean> {
  const useRss2JsonFirst = (sourceId ?? "").startsWith("gn_") || sourceId === "yna_economy";
  const useRss2JsonFallback = useRss2JsonFirst || (sourceId ?? "").startsWith("rss_");

  if (!useRss2JsonFirst) {
    const { ok, text } = await fetchViaCorsProxy(url, { timeoutMs: RSS_CHECK_TIMEOUT_MS });
    if (ok && (text.includes("<rss") || text.includes("<feed") || text.includes("<?xml"))) return true;
  }
  if (useRss2JsonFallback) {
    const apiKey = (import.meta.env.VITE_RSS2JSON_API_KEY as string)?.trim().replace(/^["']|["']$/g, "") ?? "";
    const rss2JsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}${apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : ""}`;
    const { ok, text } = await fetchViaCorsProxy(rss2JsonUrl, { timeoutMs: RSS_CHECK_TIMEOUT_MS });
    if (ok && /"status"\s*:\s*"ok"/.test(text ?? "")) return true;
  }
  if (useRss2JsonFirst) {
    const { ok, text } = await fetchViaCorsProxy(url, { timeoutMs: RSS_CHECK_TIMEOUT_MS });
    if (ok && (text.includes("<rss") || text.includes("<feed") || text.includes("<?xml"))) return true;
  }
  return false;
}

function getApiKey(name: "VITE_GEMINI_API_KEY" | "VITE_OPENAI_API_KEY" | "VITE_ANTHROPIC_API_KEY" | "VITE_OPENROUTER_API_KEY"): string {
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
    const msg = e instanceof Error ? e.message : "스크랩한 기사";
    return { ok: false, message: msg };
  }
}

async function checkAnthropicApi(): Promise<{ ok: boolean; message?: string }> {
  const openRouterKey = getApiKey("VITE_OPENROUTER_API_KEY");
  if (openRouterKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openRouterKey}`,
          "HTTP-Referer": window.location.origin,
        },
        body: JSON.stringify({
          model: "anthropic/claude-3.5-sonnet",
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
      const msg = e instanceof Error ? e.message : "스크랩한 기사";
      return { ok: false, message: msg };
    }
  }
  const key = getApiKey("VITE_ANTHROPIC_API_KEY");
  if (!key) {
    return { ok: false, message: "API 키가 설정되지 않았습니다. (.env에 VITE_ANTHROPIC_API_KEY 또는 VITE_OPENROUTER_API_KEY 추가)" };
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
    const msg = e instanceof Error ? e.message : "스크랩한 기사";
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
    const msg = e instanceof Error ? e.message : "스크랩한 기사";
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
    if (!msg) return "네트워크 오류";
    if (msg.includes("quota") || msg.includes("billing") || msg.includes("exceeded") || msg.includes("rate_limit")) return "할당량초과";
    if ((msg.includes("Invalid") && msg.includes("key")) || msg.includes("invalid_api_key") || msg.includes("401")) return "API 키오류";
    const lower = msg.toLowerCase();
    if (msg.includes("403") || lower.includes("region") || lower.includes("country") || lower.includes("blocked") || lower.includes("geo") || lower.includes("forbidden") || lower.includes("not available") || lower.includes("restricted")) return "지역제한";
    if (msg.includes("not found") || msg.includes("model")) return "모델 오류";
    return msg.length > 50 ? msg.slice(0, 50) + "…" : msg;
  };
  const errors: string[] = [];
  if (!geminiResult.ok) errors.push(`Gemini: ${translateError(geminiResult.message)}`);
  if (!gptResult.ok) errors.push(`ChatGPT: ${translateError(gptResult.message)}`);
  if (!anthropicResult.ok) errors.push(`Claude: ${translateError(anthropicResult.message)}`);
  if (errors.length === 0) errors.push("정상");

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

/** 리포트 동기화 버튼 */
function ReportSyncButtons({
  sessions,
  isEnabled,
  uid,
  refreshSessionsFromCloud,
  syncAllSessionsToCloud,
}: {
  sessions: ArchiveSession[];
  isEnabled: boolean;
  uid: string | null;
  refreshSessionsFromCloud: () => Promise<void>;
  syncAllSessionsToCloud: (sessions: ArchiveSession[]) => Promise<{ ok: boolean; message: string }>;
}) {
  const [loading, setLoading] = useState<"pull" | "push" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handlePull = async () => {
    if (!uid) {
      setResult({ ok: false, message: "?데이터 동기화??. (?? > 로그인)" });
      setTimeout(() => setResult(null), 4000);
      return;
    }
    setLoading("pull");
    setResult(null);
    try {
      await refreshSessionsFromCloud();
      setResult({ ok: true, message: "클라우드에서 가져왔습니다" });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "스크랩한 기사" });
    } finally {
      setLoading(null);
    }
    setTimeout(() => setResult(null), 4000);
  };

  const handlePush = async () => {
    setLoading("push");
    setResult(null);
    try {
      const res = await syncAllSessionsToCloud(sessions);
      setResult(res);
    } finally {
      setLoading(null);
    }
    setTimeout(() => setResult(null), 4000);
  };

  if (!isEnabled) {
    return (
      <p style={{ fontSize: 13 }} className="text-white/50">
        Firebase가 비활성화되어 있습니다. (.env에 VITE_FIREBASE_* 추가)
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePull}
          disabled={loading !== null || !uid}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] border border-white/10 bg-white/5 text-white/80 hover:bg-white/8 disabled:opacity-50 transition-colors"
          style={{ fontSize: 13 }}
        >
          <CloudDownload size={16} />
          {loading === "pull" ? "가져오는 중…" : "클라우드에서 가져오기"}
        </button>
        <button
          type="button"
          onClick={handlePush}
          disabled={loading !== null || !uid}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] border border-white/10 bg-white/5 text-white/80 hover:bg-white/8 disabled:opacity-50 transition-colors"
          style={{ fontSize: 13 }}
        >
          <CloudUpload size={16} />
          {loading === "push" ? "업로드 중…" : "클라우드에 업로드"}
        </button>
      </div>
      {result && (
        <p
          style={{ fontSize: 12 }}
          className={result.ok ? "text-emerald-400/90" : "text-red-400/90"}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}

/** 동기화 실패 시 확인 사항 */
function ReportSyncFailureHint() {
  return (
    <details className="mt-2">
      <summary style={{ fontSize: 12 }} className="text-white/40 cursor-pointer hover:text-white/60">
        동기화 실패 시 확인 사항
      </summary>
      <ul style={{ fontSize: 11, lineHeight: 1.6 }} className="text-white/40 mt-2 pl-4 space-y-1 list-disc">
        <li>스크랩한 기사 보기</li>
        <li>Firestore 문서 1MB 제한: 리포트가 크면 uploadedImages 제외 후 저장됩니다.</li>
        <li>Firebase Console &gt; Authentication &gt; 허용된 도메인에 URL(또는 IP) 추가 (예: 192.168.x.x)</li>
        <li>{"Firestore 규칙: users/{userId}에 read, write 권한 부여"}</li>
        <li>규칙 저장 후 동기화 재시도 (Firebase Console &gt; Authentication)</li>
      </ul>
    </details>
  );
}

export function SettingsPage() {
  const { sessions, clearAllSessions } = useArchive();
  const firebase = useFirebase();
  const [selectedModelId, setSelectedModelId] = useState(getSelectedModelId());
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() => getSelectedSources().sources);
  const [newRssName, setNewRssName] = useState("");
  const [newRssUrl, setNewRssUrl] = useState("");
  const [customSourcesVersion, setCustomSourcesVersion] = useState(0);
  const [sourceStatus, setSourceStatus] = useState<Record<string, "ok" | "error">>({});
  const [apiStatus, setApiStatus] = useState<{
    gpt: "ok" | "error";
    gemini: "ok" | "error";
    anthropic: "ok" | "error";
    errorMessage: string;
  }>({ gpt: "error", gemini: "error", anthropic: "error", errorMessage: "" });
  const [lastCheckTime, setLastCheckTime] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ type: string; ok: boolean; message: string } | null>(null);
  const [exportPdfLoading, setExportPdfLoading] = useState(false);
  const [aiEngineExpanded, setAiEngineExpanded] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [apiExpanded, setApiExpanded] = useState(false);

  const effectiveSources = useMemo(() => getEffectiveSources(), [customSourcesVersion]);

  const handleSetSelectedModelId = (id: string) => {
    setSelectedModelId(id);
  };

  const handleSaveSelectedModel = () => {
    persistSetSelectedModelId(selectedModelId);
  };

  const getModelLabel = (id: string): string => {
    if (id.startsWith("gemini-")) return `Gemini (${id})`;
    if (id.startsWith("claude-")) return `Claude (${id})`;
    if (id.startsWith("gpt-")) return `ChatGPT (${id})`;
    return id;
  };

  const toggleSourceSelection = useCallback((id: string) => {
    setSelectedSourceIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      setSelectedSources({ sources: next });
      return next;
    });
  }, []);

  const handleAddRss = useCallback(() => {
    const name = newRssName.trim() || "커스텀 RSS";
    const url = newRssUrl.trim();
    if (!url) return;
    const added = addCustomSource(name, url);
    setSelectedSourceIds((prev) => {
      const next = prev.includes(added.id) ? prev : [...prev, added.id];
      setSelectedSources({ sources: next });
      return next;
    });
    setCustomSourcesVersion((v) => v + 1);
    setNewRssName("");
    setNewRssUrl("");
  }, [newRssName, newRssUrl]);

  const handleRemoveRss = useCallback((id: string, isCustom: boolean) => {
    if (isCustom) {
      removeCustomSource(id);
      setSelectedSourceIds((prev) => {
        const next = prev.filter((x) => x !== id);
        setSelectedSources({ sources: next });
        return next;
      });
      setCustomSourcesVersion((v) => v + 1);
    } else {
      toggleSourceSelection(id);
    }
  }, [toggleSourceSelection]);

  const runCheck = useCallback(async () => {
    setIsChecking(true);
    try {
      const { sourceStatus: s, apiStatus: a } = await checkConnectionStatus(getEffectiveSources() as { id: string; name: string; rssUrl: string }[]);
      setSourceStatus(s);
      setApiStatus(a);
      setLastCheckTime(Date.now());
    } finally {
      setIsChecking(false);
    }
  }, [customSourcesVersion]);

  const handleRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastCheckTime < REFRESH_COOLDOWN_MS && lastCheckTime > 0) {
      const remain = Math.ceil((REFRESH_COOLDOWN_MS - (now - lastCheckTime)) / 60000);
      alert(`새로고침은 5분에 한 번만 가능합니다. (${remain}분 후)`);
      return;
    }
    runCheck();
  }, [lastCheckTime, runCheck]);

  // ?? ??1??+ 6관리자 (스크랩한 기사 보기? - 관리자 로그인)
  useEffect(() => {
    runCheck();
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const schedule = () => {
      if (document.hidden) return;
      runCheck();
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } else {
        if (!intervalId) intervalId = setInterval(schedule, SIX_HOURS_MS);
      }
    };
    if (!document.hidden) intervalId = setInterval(schedule, SIX_HOURS_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (intervalId) clearInterval(intervalId);
    };
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
        setExportStatus({ type: "pdfzip", ok: false, message: error || "PDF 생성 중…" });
      } else {
        const filename = `newsbrief-archives-${new Date().toISOString().slice(0, 10)}.zip`;
        const result = await saveBlobToLocalStorage(blob, filename);
        setExportStatus({
          type: "pdfzip",
          ok: result.ok,
          message: result.ok ? "PDF(ZIP)? 데이터 동기화로그인." : (result.error || "로그인??"),
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
        setExportStatus({ type: "pdfzip", ok: false, message: error || "PDF 생성 중…" });
      } else {
        const filename = `newsbrief-archives-${new Date().toISOString().slice(0, 10)}.zip`;
        const result = await uploadBlobToGoogleDrive(blob, filename, "application/zip");
        setExportStatus({
          type: "pdfzip",
          ok: result.ok,
          message: result.ok ? "PDF(ZIP)? Google Drive? 내보내기.." : (result.error || "로그인?"),
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
              <p className="text-white mb-1" style={{ fontSize: 16, fontWeight: 600 }}>전체 삭제</p>
              <p className="text-white/60 mb-5" style={{ fontSize: 14, lineHeight: 1.5 }}>
                모든 리포트를 삭제합니다. 삭제 후 복구할 수 없습니다...
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearAllCancel}
                  className="flex-1 py-2.5 rounded-[10px] border border-white/10 bg-white/5 text-white/80 hover:bg-white/8 transition-colors"
                  style={{ fontSize: 14, fontWeight: 500 }}
                >취소</button>
                <button
                  type="button"
                  onClick={handleClearAllConfirm}
                  className="flex-1 py-2.5 rounded-[10px] border border-red-500/50 bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  style={{ fontSize: 14, fontWeight: 500 }}
                >삭제</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* AI 모델 설정 */}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <button
            type="button"
            onClick={() => setAiEngineExpanded((v) => !v)}
            className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors text-left px-4"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            <span>AI 모델</span>
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
              >저장</button>
            </div>
          )}
        </div>
      </section>

      {/* 데이터 동기화 - ?? */}

      {/* 데이터 동기화? */}
      {false && (<section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <div className="flex items-center justify-between px-4 h-[72px]">
            <button
              type="button"
              onClick={() => setSourcesExpanded((v) => !v)}
              className="flex items-center gap-2 text-white hover:opacity-90 transition-opacity text-left flex-1 min-w-0"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              데이터 동기화?
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
              로그인?
            </button>
          </div>
          {sourcesExpanded && (
          <div className="border-t border-white/6 px-4 pb-4 pt-4 overflow-hidden min-w-0">
            <div className="text-white/40 mb-2" style={{ fontSize: 12, fontWeight: 600 }}>
              RSS 소스
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mb-3 min-w-0">
              <input
                type="text"
                placeholder="이름"
                value={newRssName}
                onChange={(e) => setNewRssName(e.target.value)}
                className="min-w-0 flex-1 rounded-[8px] border border-white/15 bg-white/5 px-3 py-2 text-white placeholder-white/40"
                style={{ fontSize: 13 }}
              />
              <input
                type="url"
                placeholder="RSS URL"
                value={newRssUrl}
                onChange={(e) => setNewRssUrl(e.target.value)}
                className="min-w-0 flex-1 rounded-[8px] border border-white/15 bg-white/5 px-3 py-2 text-white placeholder-white/40"
                style={{ fontSize: 13 }}
              />
              <button
                type="button"
                onClick={handleAddRss}
                disabled={!newRssUrl.trim()}
                className="shrink-0 rounded-[8px] border border-[#618EFF]/40 bg-[#618EFF]/20 px-3 py-2 text-[#618EFF] hover:bg-[#618EFF]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontSize: 13 }}
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="divide-y divide-white/6 max-h-[240px] overflow-y-auto min-w-0">
            {effectiveSources.map((s) => {
              const status = sourceStatus[s.id] ?? "ok";
              const isSelected = selectedSourceIds.includes(s.id);
              const isCustom = isCustomSourceId(s.id);
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 py-3 min-w-0">
                  <label
                    htmlFor={`rss-src-${s.id}`}
                    className="flex items-center gap-2 cursor-pointer min-w-0 overflow-hidden"
                  >
                    <input
                      id={`rss-src-${s.id}`}
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSourceSelection(s.id)}
                      className="w-4 h-4 shrink-0 rounded border-white/20 bg-white/5 text-[#618EFF] focus:ring-[#618EFF]/50"
                    />
                    <span style={{ fontSize: 14 }} className="text-white/90 truncate block min-w-0">{s.name}</span>
                  </label>
                  <div className="relative z-10 flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className={`flex items-center gap-1.5 shrink-0 ${status === "ok" ? "text-emerald-400" : "text-red-400"}`} style={{ fontSize: 12 }}>
                      {status === "ok" ? <><CheckCircle2 size={12} />연결됨</> : <><XCircle size={12} />실패</>}
                    </span>
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveRss(s.id, isCustom);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveRss(s.id, isCustom);
                      }}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[8px] text-white/40 hover:text-red-400 hover:bg-white/5 active:bg-white/10 touch-manipulation"
                      title={isCustom ? "삭제" : "선택 해제"}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
          )}
        </div>
      </section>)}

      {/* API 설정 */}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <div className="flex items-center justify-between px-4 h-[72px]">
            <button
              type="button"
              onClick={() => setApiExpanded((v) => !v)}
              className="flex items-center gap-2 text-white hover:opacity-90 transition-opacity text-left flex-1 min-w-0"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              API 설정
              <ChevronDown
                size={16}
                className={`text-white/60 transition-transform shrink-0 ${apiExpanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>
          {apiExpanded && (
          <div className="border-t border-white/6 divide-y divide-white/6 px-4 pb-4 pt-4">
          {[
            { key: "gemini" as const, label: "Gemini", icon: Sparkles },
            { key: "anthropic" as const, label: "Claude", icon: Bot },
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
                    로그인
                  </>
                ) : (
                  <>
                    <XCircle size={14} />
                    실패
                  </>
                )}
              </span>
            </div>
          ))}
          <div className="pt-2">
            <div style={{ fontSize: 12 }} className="text-white/40 mb-1">
              로그인? :
            </div>
            <div
              className="rounded-[8px] bg-white/5 border border-white/8 px-3 py-2"
              style={{ fontSize: 13, lineHeight: 1.5 }}
            >
              <span className={apiStatus.gpt === "ok" && apiStatus.gemini === "ok" && apiStatus.anthropic === "ok" ? "text-emerald-400/90" : "text-red-400/90"}>
                {apiStatus.errorMessage}
              </span>
              {apiStatus.errorMessage.includes("로그인?") && (
                <p style={{ fontSize: 11 }} className="text-white/45 mt-2">
                  VPN ?? ?? ?? ?? 데이터 동기화 로그인.
                </p>
              )}
            </div>
          </div>
          </div>
          )}
        </div>
      </section>

      {/* ?데이터 동기화? - 로그인? */}
      {false && (
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <button type="button" className="w-full h-[72px]">
            ?데이터 동기화?
          </button>
          <div className="px-4 pb-4 pt-4 border-t border-white/6 space-y-2">
          <button
            type="button"
            onClick={handleClearAllClick}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-white/10 bg-white/5 text-white/70 hover:bg-white/8 transition-colors"
            style={{ fontSize: 14 }}
          >
            <Trash2 size={16} />
            로그인?
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu((v) => !v)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-white/10 bg-white/5 text-white/70 hover:bg-white/8 transition-colors"
              style={{ fontSize: 14 }}
            >
              <Download size={16} />
              로그인?
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
                      {exportPdfLoading ? "PDF 생성 중…" : "PDF(ZIP) ?? ??"}
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
                      {exportPdfLoading ? "PDF 생성 중…" : "PDF(ZIP) ?? ??"}
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
            로그인 스크랩한 기사 보기          </Link>
          {sessions.length > 0 && (
            <p style={{ fontSize: 12 }} className="text-white/35 mt-1">
              로그인 {sessions.length}?            </p>
          )}
          </div>
        </div>
      </section>
      )}

      {/* 내보내기*/}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/6">
            <p style={{ fontSize: 14, fontWeight: 600 }} className="text-white">데이터 동기화</p>
          </div>
          <div className="p-4 space-y-3">
            <ReportSyncButtons
              sessions={sessions}
              isEnabled={firebase.isEnabled}
              uid={firebase.uid}
              refreshSessionsFromCloud={firebase.refreshSessionsFromCloud}
              syncAllSessionsToCloud={firebase.syncAllSessionsToCloud}
            />
            <ReportSyncFailureHint />
          </div>
        </div>
      </section>

      {/* 아카이빙 */}
      <section className="mb-4">
        <Link
          to="/settings/archive"
          className="block bg-white/5 border border-white/8 rounded-[10px] overflow-hidden"
        >
          <div className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors px-4">
            <span style={{ fontSize: 14, fontWeight: 600 }}>아카이빙</span>
            <ChevronRight size={20} className="text-white/40 shrink-0" />
          </div>
        </Link>
      </section>

      {/* 스크랩한 기사 */}
      <section className="mb-4">
        <Link
          to="/settings/scrap"
          className="block bg-white/5 border border-white/8 rounded-[10px] overflow-hidden"
        >
          <div className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors px-4">
            <span style={{ fontSize: 14, fontWeight: 600 }}>스크랩한 기사</span>
            <ChevronRight size={20} className="text-white/40 shrink-0" />
          </div>
        </Link>
      </section>

      {/* 로그인?*/}
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

      {/* 로그인 */}
      {false && (
<section className="mb-4">
        <Link
          to="/settings/admin"
          className="block bg-white/5 border border-white/8 rounded-[10px] overflow-hidden"
        >
          <div className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors px-4">
            <span style={{ fontSize: 14, fontWeight: 600 }}>로그인</span>
            <ChevronRight size={20} className="text-white/40 shrink-0" />
          </div>
        </Link>
      </section>
)}


      {/* ?? 로그인? (lightweight-charts attributionLogo ?데이터 동기화로그인) */}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden px-4 py-3">
          <p style={{ fontSize: 12 }} className="text-white/50">
            Charts by TradingView lightweight-charts{" "}
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
