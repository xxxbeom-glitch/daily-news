import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { ArchiveSession } from "../data/newsSources";
import { useFirebase } from "./FirebaseContext";
import { ARCHIVES_STORAGE_KEY, sanitizeSessionsForLocalStorage } from "../utils/archiveStorage";

interface ArchiveContextValue {
  sessions: ArchiveSession[];
  addSession: (session: ArchiveSession) => void;
  updateSession: (id: string, patch: Partial<ArchiveSession>) => void;
  deleteSession: (id: string) => void;
  clearAllSessions: () => void;
}

const ArchiveContext = createContext<ArchiveContextValue | null>(null);

function normalizeSessionTitle(title: string): string {
  return title.replace(/\s*·\s*(한국 뉴스|해외 시황|글로벌 마켓 데일리|유튜브 시황|한국 시장 뉴스|해외 시황 요약|한국경제 헤드라인)\s*$/, " · 리포트");
}

function loadSessions(): ArchiveSession[] {
  try {
    const raw = localStorage.getItem(ARCHIVES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ArchiveSession[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s) => ({
      ...s,
      title: normalizeSessionTitle(s.title ?? ""),
    }));
  } catch {
    return [];
  }
}

export function ArchiveProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ArchiveSession[]>(loadSessions);
  const { syncAddSession, syncDeleteSession } = useFirebase();

  useEffect(() => {
    const toSave = sanitizeSessionsForLocalStorage(sessions);
    try {
      localStorage.setItem(ARCHIVES_STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      try {
        localStorage.setItem(ARCHIVES_STORAGE_KEY, JSON.stringify(toSave.map((s) => ({ ...s, uploadedImages: undefined }))));
      } catch {
        console.warn("[Archive] localStorage 용량 초과, 저장 생략");
      }
    }
  }, [sessions]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<ArchiveSession[]>;
      if (ev.detail === undefined || !Array.isArray(ev.detail)) return;
      setSessions(ev.detail.map((s) => ({ ...s, title: normalizeSessionTitle(s.title ?? "") })));
    };
    window.addEventListener("newsbrief_sessions_loaded", handler);
    return () => window.removeEventListener("newsbrief_sessions_loaded", handler);
  }, []);

  const addSession = useCallback(
    (session: ArchiveSession) => {
      setSessions((prev) => [session, ...prev]);
      syncAddSession(session);
    },
    [syncAddSession]
  );

  const updateSession = useCallback(
    (id: string, patch: Partial<ArchiveSession>) => {
      setSessions((prev) => {
        const session = prev.find((s) => s.id === id);
        if (!session) return prev;
        const updated = { ...session, ...patch };
        syncAddSession(updated);
        return prev.map((s) => (s.id === id ? updated : s));
      });
    },
    [syncAddSession]
  );

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      syncDeleteSession(id);
    },
    [syncDeleteSession]
  );

  const clearAllSessions = useCallback(() => {
    setSessions([]);
  }, []);

  return (
    <ArchiveContext.Provider value={{ sessions, addSession, updateSession, deleteSession, clearAllSessions }}>
      {children}
    </ArchiveContext.Provider>
  );
}

export function useArchive() {
  const ctx = useContext(ArchiveContext);
  if (!ctx) throw new Error("useArchive must be used within ArchiveProvider");
  return ctx;
}
