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
} from "../../lib/firebaseDb";
import type { ArchiveSession } from "../data/newsSources";
import {
  setSelectedSources,
  setInterestMemoryDomestic,
  setInterestMemoryInternational,
  setSelectedModel,
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

const ARCHIVES_KEY = "newsbrief_archives";

interface FirebaseContextValue {
  uid: string | null;
  isReady: boolean;
  isEnabled: boolean;
  syncSettings: (state: {
    selectedSources?: SelectedSourcesState;
    interestMemoryDomestic?: string;
    interestMemoryInternational?: string;
    selectedModel?: "gemini" | "gpt";
  }) => Promise<void>;
  syncAdmin: () => Promise<void>;
  syncMeta: (archiveState: PersistedArchiveState, searchState: PersistedSearchState | null) => Promise<void>;
  syncAddSession: (session: ArchiveSession) => Promise<void>;
  syncDeleteSession: (sessionId: string) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const enabled = isFirebaseEnabled();
  const loadCompleteRef = useRef(false);

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
    const unsub = onAuthStateChanged(fb.auth, async (user: User | null) => {
      if (!user) {
        const { signInAnonymously } = await import("firebase/auth");
        try {
          const cred = await signInAnonymously(fb.auth);
          setUid(cred.user.uid);
        } catch {
          setIsReady(true);
        }
        return;
      }
      setUid(user.uid);
    });
    return () => unsub();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !uid) {
      if (!enabled) setIsReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [settings, admin, meta, sessions] = await Promise.all([
          loadSettings(uid),
          loadAdmin(uid),
          loadMeta(uid),
          loadSessions(uid),
        ]);
        if (cancelled) return;
        if (settings) {
          setSelectedSources(settings.selectedSources);
          setInterestMemoryDomestic(settings.interestMemoryDomestic || "");
          setInterestMemoryInternational(settings.interestMemoryInternational || "");
          if (settings.selectedModel) setSelectedModel(settings.selectedModel);
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
            localStorage.setItem(ARCHIVES_KEY, JSON.stringify(sessions));
          } catch {}
        }
      } finally {
        if (!cancelled) {
          loadCompleteRef.current = true;
          setIsReady(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [uid, enabled]);

  const syncSettings = useCallback(
    async (state: {
      selectedSources?: SelectedSourcesState;
      interestMemoryDomestic?: string;
      interestMemoryInternational?: string;
      selectedModel?: "gemini" | "gpt";
    }) => {
      if (!uid) return;
      const {
        getSelectedSources,
        getInterestMemoryDomestic,
        getInterestMemoryInternational,
        getSelectedModel,
      } = await import("../utils/persistState");
      await saveSettingsToDb(uid, {
        selectedSources: state.selectedSources ?? getSelectedSources(),
        interestMemoryDomestic: state.interestMemoryDomestic ?? getInterestMemoryDomestic(),
        interestMemoryInternational: state.interestMemoryInternational ?? getInterestMemoryInternational(),
        selectedModel: state.selectedModel ?? getSelectedModel(),
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

  const syncAddSession = useCallback(
    async (session: ArchiveSession) => {
      if (!uid) return;
      try {
        await addSessionToFirestore(uid, session);
      } catch (e) {
        console.warn("[Firebase] addSession failed", e);
      }
    },
    [uid]
  );

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
    isReady,
    isEnabled: enabled,
    syncSettings,
    syncAdmin,
    syncMeta,
    syncAddSession,
    syncDeleteSession,
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
  return ctx ?? { uid: null, isReady: true, isEnabled: false, syncSettings: async () => {}, syncAdmin: async () => {}, syncMeta: async () => {}, syncAddSession: async () => {}, syncDeleteSession: async () => {} };
}
