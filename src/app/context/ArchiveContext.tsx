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

const STORAGE_KEY = "newsbrief_archives";

interface ArchiveContextValue {
  sessions: ArchiveSession[];
  addSession: (session: ArchiveSession) => void;
  deleteSession: (id: string) => void;
  clearAllSessions: () => void;
}

const ArchiveContext = createContext<ArchiveContextValue | null>(null);

function loadSessions(): ArchiveSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ArchiveSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function ArchiveProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ArchiveSession[]>(loadSessions);
  const { syncAddSession, syncDeleteSession } = useFirebase();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  const addSession = useCallback(
    (session: ArchiveSession) => {
      setSessions((prev) => [session, ...prev]);
      syncAddSession(session);
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
    <ArchiveContext.Provider value={{ sessions, addSession, deleteSession, clearAllSessions }}>
      {children}
    </ArchiveContext.Provider>
  );
}

export function useArchive() {
  const ctx = useContext(ArchiveContext);
  if (!ctx) throw new Error("useArchive must be used within ArchiveProvider");
  return ctx;
}
