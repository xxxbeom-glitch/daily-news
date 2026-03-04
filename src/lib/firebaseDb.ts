/**
 * Firestore 데이터 저장/로드
 * users/{uid}/settings, users/{uid}/admin, users/{uid}/sessions/{sessionId}
 */

import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import type { ArchiveSession } from "../app/data/newsSources";
import type { AdminSchedule } from "../app/utils/adminSettings";

export interface FirestoreSettings {
  selectedSources: { domestic: string[]; international: string[] };
  interestMemoryDomestic: string;
  interestMemoryInternational: string;
  selectedModel: "gemini" | "gpt";
}

export interface FirestoreAdmin {
  hideMarket: boolean;
  showNewsTab: boolean;
  movers: Record<string, string>;
  schedule: AdminSchedule;
  testRunAt: number | null;
  testExpectedReadyAt: number | null;
}

export interface FirestoreMeta {
  archiveState: { isInternational: boolean; selectedSessionId: string | null };
  searchState: unknown; // PersistedSearchState | null
}

/** 설정 로드 */
export async function loadSettings(uid: string): Promise<FirestoreSettings | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const ref = doc(db, "users", uid, "data", "settings");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as FirestoreSettings;
}

/** 설정 저장 */
export async function saveSettings(uid: string, data: FirestoreSettings): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const ref = doc(db, "users", uid, "data", "settings");
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

/** 관리자 설정 로드 */
export async function loadAdmin(uid: string): Promise<FirestoreAdmin | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const ref = doc(db, "users", uid, "data", "admin");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as FirestoreAdmin;
}

/** 관리자 설정 저장 */
export async function saveAdmin(uid: string, data: FirestoreAdmin): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const ref = doc(db, "users", uid, "data", "admin");
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

/** 메타(아카이브/검색 상태) 로드 */
export async function loadMeta(uid: string): Promise<FirestoreMeta | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const ref = doc(db, "users", uid, "data", "meta");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as FirestoreMeta;
}

/** 메타 저장 */
export async function saveMeta(uid: string, data: FirestoreMeta): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const ref = doc(db, "users", uid, "data", "meta");
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

/** 시황 세션 전체 로드 */
export async function loadSessions(uid: string): Promise<ArchiveSession[]> {
  const db = getFirebaseDb();
  if (!db) return [];
  const col = collection(db, "users", uid, "sessions");
  const snap = await getDocs(col);
  return snap.docs
    .map((d) => ({ ...d.data(), id: d.id } as ArchiveSession))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

/** 시황 세션 추가 (session.id를 문서 ID로 사용) */
export async function addSessionToFirestore(uid: string, session: ArchiveSession): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const ref = doc(db, "users", uid, "sessions", session.id);
  const { id, ...data } = session;
  await setDoc(ref, { ...data, createdAt: session.createdAt, addedAt: serverTimestamp() }, { merge: true });
}

/** 시황 세션 삭제 */
export async function deleteSessionFromFirestore(uid: string, sessionId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const ref = doc(db, "users", uid, "sessions", sessionId);
  await deleteDoc(ref);
}
