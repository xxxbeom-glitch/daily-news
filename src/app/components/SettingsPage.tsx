import { useState, useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, Trash2, Download, Cloud, RefreshCw, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useArchive } from "../context/ArchiveContext";
import { useFirebase } from "../context/FirebaseContext";
import { getEffectiveSources } from "../data/newsSources";
import { addCustomSource, removeCustomSource, isCustomSourceId } from "../utils/customRssStorage";
import {
  getSelectedSources,
  setSelectedSources,
  getSelectedModelId,
  setSelectedModelId as persistSetSelectedModelId,
  getCompanyAnalysisSystemInstruction,
  setCompanyAnalysisSystemInstruction,
  DEFAULT_COMPANY_ANALYSIS_SYSTEM_INSTRUCTION,
} from "../utils/persistState";
import { GEMINI_MODELS, CLAUDE_MODELS, OPENAI_MODELS } from "../utils/adminSettings";
import { saveBlobToLocalStorage, uploadBlobToGoogleDrive } from "../utils/exportArchives";
import { exportAllDataToZip } from "../utils/exportAllData";
import { fetchViaCorsProxy } from "../utils/corsProxy";


const API_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 60 min
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

/** Check API only between 6am and midnight (KST) */
function isWithinApiCheckHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 24;
}

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

function getApiKey(name: string): string {
  let key = (import.meta.env[name] as string) ?? "";
  return key.trim().replace(/^["']|["']$/g, "");
}

async function checkGeminiApi(): Promise<{ ok: boolean; message?: string }> {
  const key = getApiKey("VITE_GEMINI_API_KEY");
  if (!key) {
    return { ok: false, message: "API key not set. Add VITE_GEMINI_API_KEY to .env" };
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
    const msg = e instanceof Error ? e.message : "Network error";
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
      const msg = e instanceof Error ? e.message : "Network error";
      return { ok: false, message: msg };
    }
  }
  const key = getApiKey("VITE_ANTHROPIC_API_KEY");
  if (!key) {
    return { ok: false, message: "API key not set. Add VITE_ANTHROPIC_API_KEY or VITE_OPENROUTER_API_KEY to .env" };
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
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, message: msg };
  }
}

async function checkOpenAIApi(): Promise<{ ok: boolean; message?: string }> {
  const key = getApiKey("VITE_OPENAI_API_KEY");
  if (!key) {
    return { ok: false, message: "API key not set. Add VITE_OPENAI_API_KEY to .env" };
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
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, message: msg };
  }
}

async function checkDataGoKrApi(): Promise<{ ok: boolean; message?: string }> {
  const key = getApiKey("VITE_DATA_GO_KR_SERVICE_KEY");
  if (!key) return { ok: false, message: "API key not set" };
  const serviceKey = key.includes("%") ? key : encodeURIComponent(key);
  const url = `/api/data-go-kr/1160100/service/GetCorpBasicInfoService_V2/getCorpOutline_V2?serviceKey=${serviceKey}&pageNo=1&numOfRows=1&resultType=json&corpNm=005930`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const text = await res.text();
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}${text.length < 100 ? ": " + text.slice(0, 80) : ""}` };
    let json: { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: unknown } } = {};
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      return { ok: false, message: `Invalid response (HTML or error, ${text.length} chars)` };
    }
    const header = json?.response?.header;
    const code = header?.resultCode;
    const msg = (header?.resultMsg ?? "").trim();
    if (code === "00" || (code === undefined && json?.response?.body != null)) return { ok: true };
    const err = msg || code || "UNKNOWN_ERROR";
    if (err.includes("SERVICE_KEY") || err.includes("REGISTERED") || /KEY|REGISTERED/.test(err)) return { ok: false, message: `API key error: ${err}` };
    if (err.includes("NODATA") || err.includes("NO_DATA")) return { ok: false, message: "No data" };
    return { ok: false, message: err };
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg || "Request failed" };
  }
}

async function checkFinnhubApi(): Promise<{ ok: boolean; message?: string }> {
  const key = getApiKey("VITE_FINNHUB_API_KEY");
  if (!key) return { ok: false, message: "API key not set" };
  const url = `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${key}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = (await res.json().catch(() => ({}))) as { c?: number; error?: string };
    if (!res.ok) return { ok: false, message: data?.error || `HTTP ${res.status}` };
    if (data && typeof data.c === "number") return { ok: true };
    return { ok: false, message: data?.error || "No data" };
  } catch (e) {
    clearTimeout(timeout);
    return { ok: false, message: e instanceof Error ? e.message : "Load failed" };
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
    dataGoKr: "ok" | "error" | "nokey";
    finnhub: "ok" | "error" | "nokey";
    yahoo: "ok" | "error";
    errorMessage: string;
    apiErrorMessages: Record<string, string>;
  };
}> {
  const [sourceResults, geminiResult, gptResult, anthropicResult, dataGoKrResult, finnhubResult] = await Promise.all([
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
    getApiKey("VITE_DATA_GO_KR_SERVICE_KEY") ? checkDataGoKrApi() : Promise.resolve({ ok: false, message: "nokey" }),
    getApiKey("VITE_FINNHUB_API_KEY") ? checkFinnhubApi() : Promise.resolve({ ok: false, message: "nokey" }),
  ]);

  const sourceStatus = Object.fromEntries(sourceResults);
  const translateError = (msg: string | undefined): string => {
    if (!msg) return "Request failed";
    if (msg === "nokey") return "Key not set";
    if (msg.includes("quota") || msg.includes("billing") || msg.includes("exceeded") || msg.includes("rate_limit")) return "Quota exceeded";
    if ((msg.includes("Invalid") && msg.includes("key")) || msg.includes("invalid_api_key") || msg.includes("401")) return "Invalid API key";
    const lower = msg.toLowerCase();
    if (msg.includes("403") || lower.includes("region") || lower.includes("country") || lower.includes("blocked") || lower.includes("geo") || lower.includes("forbidden") || lower.includes("not available") || lower.includes("restricted")) return "Region blocked";
    if (msg.includes("not found") || msg.includes("model")) return "Model not found";
    return msg.length > 50 ? msg.slice(0, 50) + "..." : msg;
  };
  const errors: string[] = [];
  if (!geminiResult.ok) errors.push(`Gemini: ${translateError(geminiResult.message)}`);
  if (!gptResult.ok) errors.push(`ChatGPT: ${translateError(gptResult.message)}`);
  if (!anthropicResult.ok) errors.push(`Claude: ${translateError(anthropicResult.message)}`);
  if (errors.length === 0) errors.push("OK");

  const dataGoKrKey = getApiKey("VITE_DATA_GO_KR_SERVICE_KEY");
  const finnhubKey = getApiKey("VITE_FINNHUB_API_KEY");

  const apiErrorMessages: Record<string, string> = {};
  if (!geminiResult.ok && geminiResult.message) apiErrorMessages.gemini = geminiResult.message;
  if (!gptResult.ok && gptResult.message) apiErrorMessages.gpt = gptResult.message;
  if (!anthropicResult.ok && anthropicResult.message) apiErrorMessages.anthropic = anthropicResult.message;
  if (!dataGoKrResult.ok && dataGoKrResult.message && dataGoKrResult.message !== "nokey") apiErrorMessages.dataGoKr = dataGoKrResult.message;
  if (!finnhubResult.ok && finnhubResult.message && finnhubResult.message !== "nokey") apiErrorMessages.finnhub = finnhubResult.message;

  return {
    sourceStatus,
    apiStatus: {
      gpt: gptResult.ok ? "ok" : "error",
      gemini: geminiResult.ok ? "ok" : "error",
      anthropic: anthropicResult.ok ? "ok" : "error",
      dataGoKr: !dataGoKrKey ? "nokey" : dataGoKrResult.ok ? "ok" : "error",
      finnhub: !finnhubKey ? "nokey" : finnhubResult.ok ? "ok" : "error",
      yahoo: "ok",
      errorMessage: errors.join(" / "),
      apiErrorMessages,
    },
  };
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
    dataGoKr: "ok" | "error" | "nokey";
    finnhub: "ok" | "error" | "nokey";
    yahoo: "ok" | "error";
    errorMessage: string;
    apiErrorMessages: Record<string, string>;
  }>({ gpt: "error", gemini: "error", anthropic: "error", dataGoKr: "nokey", finnhub: "nokey", yahoo: "ok", errorMessage: "", apiErrorMessages: {} });
  const [lastCheckTime, setLastCheckTime] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [checkingApiKey, setCheckingApiKey] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ type: string; ok: boolean; message: string } | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [aiEngineExpanded, setAiEngineExpanded] = useState(false);
  const [systemInstructionExpanded, setSystemInstructionExpanded] = useState(false);
  const [systemInstructionEdit, setSystemInstructionEdit] = useState(() => getCompanyAnalysisSystemInstruction());
  const [systemInstructionSaved, setSystemInstructionSaved] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [apiExpanded, setApiExpanded] = useState(false);
  const [backupExpanded, setBackupExpanded] = useState(false);

  const effectiveSources = useMemo(() => getEffectiveSources(), [customSourcesVersion]);

  const handleSetSelectedModelId = (id: string) => {
    setSelectedModelId(id);
  };

  const handleSaveSelectedModel = () => {
    persistSetSelectedModelId(selectedModelId);
  };

  const handleSaveSystemInstruction = () => {
    setCompanyAnalysisSystemInstruction(systemInstructionEdit.trim() || DEFAULT_COMPANY_ANALYSIS_SYSTEM_INSTRUCTION);
    setSystemInstructionSaved(true);
    setTimeout(() => setSystemInstructionSaved(false), 2000);
  };

  const handleResetSystemInstruction = () => {
    setSystemInstructionEdit(DEFAULT_COMPANY_ANALYSIS_SYSTEM_INSTRUCTION);
  };

  useEffect(() => {
    if (systemInstructionExpanded) {
      setSystemInstructionEdit(getCompanyAnalysisSystemInstruction());
    }
  }, [systemInstructionExpanded]);

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
    const name = newRssName.trim() || "Custom RSS";
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
      alert(`Please wait 5 min before refresh. (${remain} min left)`);
      return;
    }
    runCheck();
  }, [lastCheckTime, runCheck]);

  const handleCheckSingleApi = useCallback(
    async (key: "gemini" | "gpt" | "anthropic" | "dataGoKr" | "finnhub") => {
      if (checkingApiKey) return;
      setCheckingApiKey(key);
      try {
        const checks: Record<typeof key, () => Promise<{ ok: boolean; message?: string }>> = {
          gemini: checkGeminiApi,
          gpt: checkOpenAIApi,
          anthropic: checkAnthropicApi,
          dataGoKr: () =>
            getApiKey("VITE_DATA_GO_KR_SERVICE_KEY")
              ? checkDataGoKrApi()
              : Promise.resolve({ ok: false, message: "nokey" }),
          finnhub: () =>
            getApiKey("VITE_FINNHUB_API_KEY")
              ? checkFinnhubApi()
              : Promise.resolve({ ok: false, message: "nokey" }),
        };
        const result = await checks[key]();
        const status =
          key === "dataGoKr" || key === "finnhub"
            ? (result.message === "nokey" ? "nokey" : result.ok ? "ok" : "error")
            : result.ok
              ? "ok"
              : "error";
        setApiStatus((prev) => ({
          ...prev,
          [key]: status,
          apiErrorMessages: {
            ...prev.apiErrorMessages,
            [key]: result.ok || result.message === "nokey" ? "" : result.message ?? "",
          },
        }));
      } finally {
        setCheckingApiKey(null);
      }
    },
    [checkingApiKey]
  );

  // Initial load + API check when sources change
  useEffect(() => {
    runCheck();
  }, [runCheck]);

  useEffect(() => {
    if (apiExpanded) runCheck();
  }, [apiExpanded, runCheck]);

  // Run API check every 60 min (only during 6am-midnight)
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const schedule = () => {
      if (document.hidden) return;
      if (!isWithinApiCheckHours()) return;
      runCheck();
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } else {
        if (!intervalId) {
          if (isWithinApiCheckHours()) runCheck();
          intervalId = setInterval(schedule, API_CHECK_INTERVAL_MS);
        }
      }
    };
    if (!document.hidden) {
      if (isWithinApiCheckHours()) runCheck();
      intervalId = setInterval(schedule, API_CHECK_INTERVAL_MS);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (intervalId) clearInterval(intervalId);
    };
  }, [runCheck]);

  const handleClearAllClick = () => setDeleteConfirm(true);
  const handleClearAllConfirm = async () => {
    await firebase.syncDeleteAllSessions();
    clearAllSessions();
    setDeleteConfirm(false);
  };

  const handleClearAllCancel = () => {
    setDeleteConfirm(false);
  };

  const handleBackupToLocal = async () => {
    setBackupLoading(true);
    setShowExportMenu(false);
    try {
      const { ok, blob, error } = await exportAllDataToZip();
      if (!ok || !blob) {
        setExportStatus({ type: "backup", ok: false, message: error || "Backup failed" });
      } else {
        const filename = `newsbrief-backup-${new Date().toISOString().slice(0, 10)}.zip`;
        const result = await saveBlobToLocalStorage(blob, filename);
        setExportStatus({ type: "backup", ok: result.ok, message: result.ok ? "Backup saved to local." : (result.error || "Save failed") });
      }
    } finally {
      setBackupLoading(false);
      setTimeout(() => setExportStatus(null), 4000);
    }
  };

  const handleBackupToGoogleDrive = async () => {
    setBackupLoading(true);
    setShowExportMenu(false);
    try {
      const { ok, blob, error } = await exportAllDataToZip();
      if (!ok || !blob) {
        setExportStatus({ type: "backup", ok: false, message: error || "Backup failed" });
      } else {
        const filename = `newsbrief-backup-${new Date().toISOString().slice(0, 10)}.zip`;
        const result = await uploadBlobToGoogleDrive(blob, filename, "application/zip");
        setExportStatus({ type: "backup", ok: result.ok, message: result.ok ? "Backed up to Google Drive." : (result.error || "Upload failed") });
      }
    } finally {
      setBackupLoading(false);
      setTimeout(() => setExportStatus(null), 4000);
    }
  };

  const handleRefreshFromCloud = async () => {
    if (!firebase.isEnabled) {
      setExportStatus({ type: "backup", ok: false, message: "Firebase is disabled." });
      setTimeout(() => setExportStatus(null), 4000);
      return;
    }
    setBackupLoading(true);
    try {
      await Promise.all([
        firebase.refreshSessionsFromCloud(),
        firebase.refreshInsightArchivesFromCloud(),
        firebase.refreshCompanyAnalysisArchivesFromCloud(),
      ]);
      setExportStatus({ type: "backup", ok: true, message: "Data loaded from cloud." });
    } catch (e) {
      setExportStatus({ type: "backup", ok: false, message: e instanceof Error ? e.message : "Load failed" });
    } finally {
      setBackupLoading(false);
      setTimeout(() => setExportStatus(null), 4000);
    }
  };

  const handleSyncToCloud = async () => {
    if (!firebase.isEnabled) {
      setExportStatus({ type: "backup", ok: false, message: "Firebase is disabled." });
      setTimeout(() => setExportStatus(null), 4000);
      return;
    }
    setBackupLoading(true);
    try {
      const { loadInsightArchives } = await import("../utils/insightArchiveStorage");
      const { loadCompanyAnalysisArchives } = await import("../utils/companyAnalysisArchiveStorage");
      const { loadArchiveState, loadSearchState } = await import("../utils/persistState");
      const insightItems = loadInsightArchives();
      const companyItems = loadCompanyAnalysisArchives();
      const archiveState = loadArchiveState();
      const searchState = loadSearchState();
      await firebase.syncSettings({});
      await firebase.syncMeta(archiveState ?? { isInternational: true, selectedSessionId: null }, searchState);
      const [sessionsRes, insightRes, companyRes] = await Promise.all([
        firebase.syncAllSessionsToCloud(sessions),
        firebase.syncAllInsightArchivesToCloud(insightItems),
        firebase.syncAllCompanyAnalysisArchivesToCloud(companyItems),
      ]);
      const ok = sessionsRes.ok && insightRes.ok && companyRes.ok;
      const msg = ok ? "Uploaded to cloud." : [sessionsRes.message, insightRes.message, companyRes.message].filter(Boolean).join(" / ");
      setExportStatus({ type: "backup", ok, message: msg });
    } catch (e) {
      setExportStatus({ type: "backup", ok: false, message: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setBackupLoading(false);
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
              <p className="text-white mb-1" style={{ fontSize: 16, fontWeight: 600 }}>Delete All</p>
              <p className="text-white/60 mb-5" style={{ fontSize: 14, lineHeight: 1.5 }}>
                All reports will be deleted. Cannot be recovered.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearAllCancel}
                  className="flex-1 py-2.5 rounded-[10px] border border-white/10 bg-white/5 text-white/80 hover:bg-white/8 transition-colors"
                  style={{ fontSize: 14, fontWeight: 500 }}
                >Cancel</button>
                <button
                  type="button"
                  onClick={handleClearAllConfirm}
                  className="flex-1 py-2.5 rounded-[10px] border border-red-500/50 bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  style={{ fontSize: 14, fontWeight: 500 }}
                >Delete</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* AI Model */}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <button
            type="button"
            onClick={() => setAiEngineExpanded((v) => !v)}
            className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors text-left px-4"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            <span>AI Model</span>
            <ChevronDown
              size={16}
              className={`text-white/60 transition-transform shrink-0 ${aiEngineExpanded ? "rotate-180" : ""}`}
            />
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
              >Save</button>
            </div>
          )}
        </div>
      </section>

      {/* System Instruction (Company Analysis) */}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <button
            type="button"
            onClick={() => setSystemInstructionExpanded((v) => !v)}
            className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors text-left px-4"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            <span>System Instruction</span>
            <ChevronDown
              size={16}
              className={`text-white/60 shrink-0 transition-transform ${systemInstructionExpanded ? "rotate-180" : ""}`}
            />
          </button>
          {systemInstructionExpanded && (
            <div className="px-4 pb-4 pt-4 border-t border-white/6">
              <p style={{ fontSize: 12 }} className="text-white/50 mb-2">
                Used for Company Analysis API. Applied to Gemini 2.5 Flash JSON output format.
              </p>
              <textarea
                value={systemInstructionEdit}
                onChange={(e) => setSystemInstructionEdit(e.target.value)}
                placeholder={DEFAULT_COMPANY_ANALYSIS_SYSTEM_INSTRUCTION}
                className="w-full min-h-[180px] px-3 py-2 rounded-[8px] border border-white/15 bg-white/5 text-white placeholder-white/40 resize-y font-mono"
                style={{ fontSize: 12, lineHeight: 1.5 }}
              />
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveSystemInstruction}
                    className="px-4 py-2 rounded-[8px] bg-[#618EFF]/20 hover:bg-[#618EFF]/30 text-[#618EFF] border border-[#618EFF]/40 text-sm font-medium"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSystemInstruction}
                    className="px-4 py-2 rounded-[8px] bg-white/10 hover:bg-white/15 text-white/80 border border-white/15 text-sm"
                  >
                    Restore Default
                  </button>
                </div>
                {systemInstructionSaved && (
                  <span style={{ fontSize: 12 }} className="text-emerald-400">
                    Saved.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* News Sources */}
      {false && (<section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <div className="flex items-center justify-between px-4 h-[72px]">
            <button
              type="button"
              onClick={() => setSourcesExpanded((v) => !v)}
              className="flex items-center gap-2 text-white hover:opacity-90 transition-opacity text-left flex-1 min-w-0"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              News Sources
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
              Refresh
            </button>
          </div>
          {sourcesExpanded && (
          <div className="border-t border-white/6 px-4 pb-4 pt-4 overflow-hidden min-w-0">
            <div className="text-white/40 mb-2" style={{ fontSize: 12, fontWeight: 600 }}>
              Custom RSS
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mb-3 min-w-0">
              <input
                type="text"
                placeholder="Name"
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
                      {status === "ok" ? <><CheckCircle2 size={12} />Connected</> : <><XCircle size={12} />Failed</>}
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
                      title={isCustom ? "Remove" : "Deselect"}
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

      {/* API Settings */}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <button
            type="button"
            onClick={() => setApiExpanded((v) => !v)}
            className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors text-left px-4"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            <span>API Settings</span>
            <ChevronDown
              size={16}
              className={`text-white/60 transition-transform shrink-0 ${apiExpanded ? "rotate-180" : ""}`}
            />
          </button>
          {apiExpanded && (
          <div className="border-t border-white/6 divide-y divide-white/6 px-4 pb-4 pt-4">
          {[
            { key: "gemini" as const, label: "Gemini" },
            { key: "anthropic" as const, label: "Claude" },
            { key: "gpt" as const, label: "ChatGPT" },
            { key: "dataGoKr" as const, label: "Data.go.kr (Finance)" },
            { key: "finnhub" as const, label: "Finnhub" },
            { key: "yahoo" as const, label: "Yahoo Finance" },
          ].map(({ key, label }) => {
            const errMsg = apiStatus.apiErrorMessages?.[key];
            const isError = apiStatus[key] === "error";
            const isCheckable = key !== "yahoo";
            const isThisChecking = checkingApiKey === key;
            return (
              <div key={key} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <span style={{ fontSize: 14 }} className="text-white/90 flex-1 min-w-0">{label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`flex items-center gap-1.5 ${apiStatus[key] === "ok" ? "text-emerald-400" : "text-red-400"}`} style={{ fontSize: 13 }}>
                      {isThisChecking ? (
                        "Connecting"
                      ) : apiStatus[key] === "ok" ? (
                        <>
                          <CheckCircle2 size={14} />
                          Connected
                        </>
                      ) : (
                        <>
                          <XCircle size={14} />
                          {apiStatus[key] === "nokey" ? "Key not set" : "Failed"}
                        </>
                      )}
                    </span>
                    {isCheckable && (
                      <button
                        type="button"
                        onClick={() => handleCheckSingleApi(key)}
                        disabled={!!checkingApiKey}
                        className="p-1.5 rounded-[6px] text-white/50 hover:text-white/80 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Check connection"
                      >
                        <RefreshCw size={14} className={isThisChecking ? "animate-spin" : ""} />
                      </button>
                    )}
                  </div>
                </div>
                {isError && errMsg && (
                  <p style={{ fontSize: 11 }} className="text-amber-400/90 mt-1.5 break-words" title={errMsg}>
                    {errMsg.length > 80 ? errMsg.slice(0, 80) + "..." : errMsg}
                  </p>
                )}
              </div>
            );
          })}
          </div>
          )}
        </div>
      </section>

      {/* Data Backup */}
      <section className="mb-4">
        <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
          <button
            type="button"
            onClick={() => setBackupExpanded((v) => !v)}
            className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors text-left px-4"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            <span>Data Backup</span>
            <ChevronDown
              size={16}
              className={`text-white/60 transition-transform shrink-0 ${backupExpanded ? "rotate-180" : ""}`}
            />
          </button>
          {backupExpanded && (
          <div className="px-4 pb-4 pt-4 border-t border-white/6 space-y-2">
            {firebase.isEnabled && (
              <>
                <button
                  type="button"
                  onClick={handleRefreshFromCloud}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-white/10 bg-white/5 text-white/70 hover:bg-white/8 transition-colors"
            style={{ fontSize: 14 }}
          >
            <RefreshCw size={16} className={backupLoading ? "animate-spin" : ""} />
                  Load from Cloud
                </button>
                <button type="button" onClick={handleSyncToCloud} disabled={backupLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-white/10 bg-white/5 text-white/70 hover:text-white/90 hover:bg-white/8 transition-colors disabled:opacity-50"
                  style={{ fontSize: 14 }}>
                  <Cloud size={16} />
                  Upload to Cloud
                </button>
              </>
            )}
            {sessions.length > 0 && (
              <button type="button" onClick={handleClearAllClick}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-white/10 bg-white/5 text-white/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                style={{ fontSize: 14 }}>
                <Trash2 size={16} />
                Delete All Reports
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu((v) => !v)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border border-white/10 bg-white/5 text-white/70 hover:bg-white/8 transition-colors"
              style={{ fontSize: 14 }}
            >
              <Download size={16} />
              Full Backup (ZIP) Download
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
                    onClick={handleBackupToLocal}
                    disabled={backupLoading}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left border-t border-white/6 first:border-t-0 disabled:opacity-50"
                    style={{ fontSize: 14 }}
                  >
                    <Download size={18} className="text-white/60" />
                    <span className="text-white/90">
                      {backupLoading ? "Backing up?" : "Save to Local"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleBackupToGoogleDrive}
                    disabled={backupLoading}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left border-t border-white/6 disabled:opacity-50"
                    style={{ fontSize: 14 }}
                  >
                    <Cloud size={18} className="text-white/60" />
                    <span className="text-white/90">
                      {backupLoading ? "Backing up?" : "Upload to Google Drive"}
                    </span>
                  </button>
                </div>
              </>
            )}
            </div>
            <p style={{ fontSize: 11 }} className="text-white/40 mt-2">
              Backs up Reports, Insights, Company Analysis, and Settings to a ZIP file.
            </p>
          </div>
          )}
        </div>
      </section>

      {/* Login */}
      <section className="mb-4">
        <Link
          to="/settings/login"
          className="block bg-white/5 border border-white/8 rounded-[10px] overflow-hidden"
        >
          <div className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors px-4">
            <span style={{ fontSize: 14, fontWeight: 600 }}>Login</span>
            <ChevronRight size={20} className="text-white/40 shrink-0" />
          </div>
        </Link>
      </section>

      {/* Admin */}
      {false && (
<section className="mb-4">
        <Link
          to="/settings/admin"
          className="block bg-white/5 border border-white/8 rounded-[10px] overflow-hidden"
        >
          <div className="w-full h-[72px] flex items-center justify-between gap-2 text-white hover:bg-white/5 transition-colors px-4">
            <span style={{ fontSize: 14, fontWeight: 600 }}>Admin</span>
            <ChevronRight size={20} className="text-white/40 shrink-0" />
          </div>
        </Link>
      </section>
)}


      {/* TradingView lightweight-charts attribution */}
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
