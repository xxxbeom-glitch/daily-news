/**
 * Firebase 연동 Provider
 * - Anonymous Auth 후 Firestore 데이터 로드 → localStorage 반영
 * - uid 제공, 저장 함수 노출
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { initFirebase, isFirebaseEnabled } from "../../lib/firebase";
import {
  loadSettings,
  loadAdmin,
  loadMeta,
  loadSessions,
  saveSettings as saveSettingsToDb,
  saveAdmin as saveAdminToDb,
  saveMeta as saveMetaToDb,
  addSessionToFirestore,
  deleteSessionFromFirestore,
  loadInsightArchivesFromFirestore,
  addInsightArchiveToFirestore,
  deleteInsightArchiveFromFirestore,
} from "../../lib/firebaseDb";
import type { ArchiveSession } from "../data/newsSources";
import {
  setSelectedSources,
  setInterestMemoryDomestic,
  setInterestMemoryInternational,
  setSelectedModel,
  setSelectedModelId,
  saveArchiveState,
  saveSearchState,
  loadArchiveState,
  loadSearchState,
  type SelectedSourcesState,
  type PersistedArchiveState,
  type PersistedSearchState,
} from "../utils/persistState";
import {
  setAdminHideMarket,
  setAdminShowNewsTab,
  setAdminMovers,
  setAdminSchedule,
  setAdminTestRunAt,
  setAdminTestExpectedReadyAt,
  getAdminSchedule,
  DEFAULT_MOVERS,
} from "../utils/adminSettings";
import { ARCHIVES_STORAGE_KEY, sanitizeSessionsForLocalStorage } from "../utils/archiveStorage";
import { INSIGHT_ARCHIVES_KEY } from "../utils/insightArchiveStorage";
import type { InsightArchiveItem } from "../data/insightReport";

interface FirebaseContextValue {
  uid: string | null;
  user: User | null;
  isReady: boolean;
  isEnabled: boolean;
  refreshSessionsFromCloud: () => Promise<void>;
  /** 로컬 세션 전체를 Firestore에 업로드 (수동 동기화) */
  syncAllSessionsToCloud: (sessions: ArchiveSession[]) => Promise<{ ok: boolean; message: string }>;
  refreshInsightArchivesFromCloud: () => Promise<void>;
  syncAddInsightArchive: (item: InsightArchiveItem) => Promise<void>;
  syncDeleteInsightArchive: (itemId: string) => Promise<void>;
  syncAllInsightArchivesToCloud: (items: InsightArchiveItem[]) => Promise<{ ok: boolean; message: string }>;
  syncSettings: (state: {
    selectedSources?: SelectedSourcesState;
    interestMemoryDomestic?: string;
    interestMemoryInternational?: string;
    selectedModel?: "gemini" | "gpt" | "claude";
    selectedModelId?: string;
  }) => Promise<void>;
  syncAdmin: () => Promise<void>;
  syncMeta: (archiveState: PersistedArchiveState, searchState: PersistedSearchState | null) => Promise<void>;
  syncAddSession: (session: ArchiveSession) => Promise<void>;
  syncDeleteSession: (sessionId: string) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const enabled = isFirebaseEnabled();
  const loadCompleteRef = useRef(false);
  const pendingSessionsRef = useRef<ArchiveSession[]>([]);

  useEffect(() => {
    if (!enabled) {
      setIsReady(true);
      return;
    }
    const fb = initFirebase();
    if (!fb) {
      setIsReady(true);
      return;
    }
    setIsReady(true);
    const unsub = onAuthStateChanged(fb.auth, async (authUser: User | null) => {
      setUser(authUser);
      if (!authUser) {
        const { signInAnonymously } = await import("firebase/auth");
        try {
          const cred = await signInAnonymously(fb.auth);
          setUid(cred.user.uid);
        } catch {
          /* auth 실패해도 앱은 이미 표시됨 */
        }
        return;
      }
      setUid(authUser.uid);
    });
    return () => unsub();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !uid) return;
    let cancelled = false;
    (async () => {
      try {
        const [settings, admin, meta, sessions, insightArchives] = await Promise.all([
          loadSettings(uid),
          loadAdmin(uid),
          loadMeta(uid),
          loadSessions(uid),
          loadInsightArchivesFromFirestore(uid),
        ]);
        if (cancelled) return;
        if (settings) {
          const src = settings.selectedSources;
          const normalized = Array.isArray(src?.sources) ? { sources: src.sources } : { sources: [] };
          setSelectedSources(normalized);
          setInterestMemoryDomestic(settings.interestMemoryDomestic || "");
          setInterestMemoryInternational(settings.interestMemoryInternational || "");
          if (settings.selectedModel) setSelectedModel(settings.selectedModel);
          if (settings.selectedModelId) {
            setSelectedModelId(settings.selectedModelId);
          } else if (settings.selectedModel) {
            const defaultId =
              settings.selectedModel === "gpt" ? "gpt-4o-mini" :
              settings.selectedModel === "claude" ? "claude-opus-4-6" : "gemini-2.5-flash";
            setSelectedModelId(defaultId);
          }
        }
        if (admin) {
          setAdminHideMarket(admin.hideMarket);
          setAdminShowNewsTab(admin.showNewsTab);
          setAdminMovers(admin.movers && Object.keys(admin.movers).length > 0 ? admin.movers : DEFAULT_MOVERS);
          setAdminSchedule(admin.schedule || getAdminSchedule());
          setAdminTestRunAt(admin.testRunAt);
          setAdminTestExpectedReadyAt(admin.testExpectedReadyAt);
        }
        if (meta) {
          if (meta.archiveState) saveArchiveState(meta.archiveState);
          if (meta.searchState) saveSearchState(meta.searchState as unknown as PersistedSearchState);
        }
        if (sessions && sessions.length > 0) {
          try {
            const toSave = sanitizeSessionsForLocalStorage(sessions);
            localStorage.setItem(ARCHIVES_STORAGE_KEY, JSON.stringify(toSave));
            window.dispatchEvent(new CustomEvent("newsbrief_sessions_loaded", { detail: sessions }));
          } catch {}
        }
        if (insightArchives && insightArchives.length > 0) {
          try {
            localStorage.setItem(INSIGHT_ARCHIVES_KEY, JSON.stringify(insightArchives));
            window.dispatchEvent(new CustomEvent("newsbrief_insight_archives_loaded", { detail: insightArchives }));
          } catch {}
        }
      } finally {
        if (!cancelled) loadCompleteRef.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, [uid, enabled]);

  const syncSettings = useCallback(
    async (state: {
      selectedSources?: SelectedSourcesState;
      interestMemoryDomestic?: string;
      interestMemoryInternational?: string;
      selectedModel?: "gemini" | "gpt" | "claude";
      selectedModelId?: string;
    }) => {
      if (!uid) return;
      const {
        getSelectedSources,
        getInterestMemoryDomestic,
        getInterestMemoryInternational,
        getSelectedModel,
        getSelectedModelId,
      } = await import("../utils/persistState");
      await saveSettingsToDb(uid, {
        selectedSources: state.selectedSources ?? getSelectedSources(),
        interestMemoryDomestic: state.interestMemoryDomestic ?? getInterestMemoryDomestic(),
        interestMemoryInternational: state.interestMemoryInternational ?? getInterestMemoryInternational(),
        selectedModel: state.selectedModel ?? getSelectedModel(),
        selectedModelId: state.selectedModelId ?? getSelectedModelId(),
      });
    },
    [uid]
  );

  const syncAdmin = useCallback(async () => {
    if (!uid) return;
    const {
      getAdminHideMarket,
      getAdminShowNewsTab,
      getAdminMovers,
      getAdminSchedule,
      getAdminTestRunAt,
      getAdminTestExpectedReadyAt,
    } = await import("../utils/adminSettings");
    await saveAdminToDb(uid, {
      hideMarket: getAdminHideMarket(),
      showNewsTab: getAdminShowNewsTab(),
      movers: getAdminMovers(),
      schedule: getAdminSchedule(),
      testRunAt: getAdminTestRunAt(),
      testExpectedReadyAt: getAdminTestExpectedReadyAt(),
    });
  }, [uid]);

  const syncMeta = useCallback(
    async (archiveState: PersistedArchiveState, searchState: PersistedSearchState | null) => {
      if (!uid) return;
      await saveMetaToDb(uid, { archiveState, searchState });
    },
    [uid]
  );

  const refreshSessionsFromCloud = useCallback(async () => {
    if (!uid) return;
    try {
      const sessions = await loadSessions(uid);
      try {
        const toSave = sanitizeSessionsForLocalStorage(sessions);
        localStorage.setItem(ARCHIVES_STORAGE_KEY, JSON.stringify(toSave));
        window.dispatchEvent(new CustomEvent("newsbrief_sessions_loaded", { detail: sessions }));
      } catch {}
    } catch (e) {
      console.error("[Firebase] refreshSessions 실패", e);
    }
  }, [uid]);

  const refreshInsightArchivesFromCloud = useCallback(async () => {
    if (!uid) return;
    try {
      const items = await loadInsightArchivesFromFirestore(uid);
      try {
        localStorage.setItem(INSIGHT_ARCHIVES_KEY, JSON.stringify(items));
        window.dispatchEvent(new CustomEvent("newsbrief_insight_archives_loaded", { detail: items }));
      } catch {}
    } catch (e) {
      console.error("[Firebase] refreshInsightArchives 실패", e);
    }
  }, [uid]);

  const syncAddInsightArchive = useCallback(
    async (item: InsightArchiveItem) => {
      if (!uid) return;
      try {
        await addInsightArchiveToFirestore(uid, item);
      } catch (e) {
        console.error("[Firebase] addInsightArchive 실패", e);
      }
    },
    [uid]
  );

  const syncDeleteInsightArchive = useCallback(
    async (itemId: string) => {
      if (!uid) return;
      try {
        await deleteInsightArchiveFromFirestore(uid, itemId);
      } catch (e) {
        console.warn("[Firebase] deleteInsightArchive 실패", e);
      }
    },
    [uid]
  );

  const syncAllInsightArchivesToCloud = useCallback(
    async (items: InsightArchiveItem[]): Promise<{ ok: boolean; message: string }> => {
      if (!uid) {
        return { ok: false, message: "로그인되지 않았습니다." };
      }
      if (items.length === 0) {
        return { ok: true, message: "동기화할 인사이트 칩이 없습니다." };
      }
      let success = 0;
      let lastError: string | null = null;
      for (const item of items) {
        try {
          await addInsightArchiveToFirestore(uid, item);
          success++;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          console.error("[Firebase] syncInsightArchive 실패", item.id, e);
        }
      }
      if (success === items.length) {
        return { ok: true, message: `${items.length}건 동기화 완료` };
      }
      if (success > 0) {
        return { ok: false, message: `${success}/${items.length}건만 성공. ${lastError ?? ""}` };
      }
      return { ok: false, message: lastError ?? "동기화 실패" };
    },
    [uid]
  );

  const syncAddSession = useCallback(
    async (session: ArchiveSession) => {
      if (!uid) {
        pendingSessionsRef.current.push(session);
        return;
      }
      try {
        await addSessionToFirestore(uid, session);
      } catch (e) {
        console.error("[Firebase] addSession 실패 (Firestore 규칙·네트워크 확인)", e);
      }
    },
    [uid]
  );

  useEffect(() => {
    if (!enabled || !uid || pendingSessionsRef.current.length === 0) return;
    const pending = pendingSessionsRef.current.splice(0);
    (async () => {
      for (const session of pending) {
        try {
          await addSessionToFirestore(uid, session);
        } catch (e) {
          console.error("[Firebase] addSession (pending) 실패", e);
        }
      }
    })();
  }, [uid, enabled]);

  const syncDeleteSession = useCallback(
    async (sessionId: string) => {
      if (!uid) return;
      try {
        await deleteSessionFromFirestore(uid, sessionId);
      } catch (e) {
        console.warn("[Firebase] deleteSession failed", e);
      }
    },
    [uid]
  );

  const syncAllSessionsToCloud = useCallback(
    async (sessions: ArchiveSession[]): Promise<{ ok: boolean; message: string }> => {
      if (!uid) {
        return { ok: false, message: "로그인되지 않았습니다. (익명 인증 대기 중이거나 실패)" };
      }
      if (sessions.length === 0) {
        return { ok: true, message: "동기화할 리포트가 없습니다." };
      }
      let success = 0;
      let lastError: string | null = null;
      for (const session of sessions) {
        try {
          await addSessionToFirestore(uid, session);
          success++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          lastError = msg;
          console.error("[Firebase] syncAllSessionsToCloud 실패", session.id, e);
        }
      }
      if (success === sessions.length) {
        return { ok: true, message: `${sessions.length}건 동기화 완료` };
      }
      if (success > 0) {
        return { ok: false, message: `${success}/${sessions.length}건만 성공. 마지막 오류: ${lastError ?? "알 수 없음"}` };
      }
      return { ok: false, message: lastError ?? "동기화 실패 (Firestore 규칙·네트워크·도메인 승인 확인)" };
    },
    [uid]
  );

  useEffect(() => {
    if (!enabled || !uid) return;
    let settingsTimer: ReturnType<typeof setTimeout>;
    let adminTimer: ReturnType<typeof setTimeout>;
    let metaTimer: ReturnType<typeof setTimeout>;
    const debounceMs = 800;
    const onSettings = () => {
      clearTimeout(settingsTimer);
      settingsTimer = setTimeout(() => {
        if (!loadCompleteRef.current) return;
        syncSettings({});
      }, debounceMs);
    };
    const onAdmin = () => {
      clearTimeout(adminTimer);
      adminTimer = setTimeout(() => {
        if (!loadCompleteRef.current) return;
        syncAdmin();
      }, debounceMs);
    };
    const onMeta = () => {
      clearTimeout(metaTimer);
      metaTimer = setTimeout(() => {
        if (!loadCompleteRef.current) return;
        const as = loadArchiveState();
        const ss = loadSearchState();
        syncMeta(as ?? { isInternational: true, selectedSessionId: null }, ss);
      }, debounceMs);
    };
    window.addEventListener("newsbrief_settings_changed", onSettings);
    window.addEventListener("newsbrief_admin_changed", onAdmin);
    window.addEventListener("newsbrief_meta_changed", onMeta);
    return () => {
      window.removeEventListener("newsbrief_settings_changed", onSettings);
      window.removeEventListener("newsbrief_admin_changed", onAdmin);
      window.removeEventListener("newsbrief_meta_changed", onMeta);
      clearTimeout(settingsTimer);
      clearTimeout(adminTimer);
      clearTimeout(metaTimer);
    };
  }, [enabled, uid, syncSettings, syncAdmin, syncMeta]);

  const value: FirebaseContextValue = {
    uid,
    user,
    isReady,
    isEnabled: enabled,
    refreshSessionsFromCloud,
    refreshInsightArchivesFromCloud,
    syncAddInsightArchive,
    syncDeleteInsightArchive,
    syncAllInsightArchivesToCloud,
    syncSettings,
    syncAdmin,
    syncMeta,
    syncAddSession,
    syncDeleteSession,
    syncAllSessionsToCloud,
  };

  return (
    <FirebaseContext.Provider value={value}>
      {enabled && !isReady ? (
        <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0f] text-white/60 text-sm">
          데이터 불러오는 중…
        </div>
      ) : null}
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const ctx = useContext(FirebaseContext);
  const noop = async () => {};
  const noopSync = async () => ({ ok: false, message: "Firebase 미활성화" });
  return ctx ?? {
    uid: null,
    user: null,
    isReady: true,
    isEnabled: false,
    refreshSessionsFromCloud: noop,
    refreshInsightArchivesFromCloud: noop,
    syncAddInsightArchive: noop,
    syncDeleteInsightArchive: noop,
    syncAllInsightArchivesToCloud: noopSync,
    syncSettings: noop,
    syncAdmin: noop,
    syncMeta: noop,
    syncAddSession: noop,
    syncDeleteSession: noop,
    syncAllSessionsToCloud: noopSync,
  };
}
