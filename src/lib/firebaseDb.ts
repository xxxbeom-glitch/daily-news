/**
 * Firestore 데이터 저장/로드
 * users/{uid}/settings, users/{uid}/admin, users/{uid}/sessions/{sessionId}
 */

import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import type { ArchiveSession } from "../app/data/newsSources";
import type { AdminSchedule } from "../app/utils/adminSettings";

export interface FirestoreSettings {
  selectedSources: { sources: string[] };
  interestMemoryDomestic: string;
  interestMemoryInternational: string;
  selectedModel: "gemini" | "gpt" | "claude";
  selectedModelId?: string;
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

/** 설정 로드 (구 domestic/international 형식 → sources로 마이그레이션) */
export async function loadSettings(uid: string): Promise<FirestoreSettings | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const ref = doc(db, "users", uid, "data", "settings");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const raw = snap.data() as FirestoreSettings & { domestic?: string[]; international?: string[] };
  if (Array.isArray(raw.domestic) && Array.isArray(raw.international) && !Array.isArray(raw.selectedSources?.sources)) {
    return { ...raw, selectedSources: { sources: [...raw.domestic, ...raw.international] } };
  }
  return raw as FirestoreSettings;
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

/** Firestore 저장용: undefined 제거 (Firestore는 undefined 미지원) */
function sanitizeForFirestore(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = sanitizeForFirestore(v);
  }
  return out;
}

/** Firestore 문서 크기 제한 (1MB, 여유 두고 950KB 사용) */
const FIRESTORE_DOC_SIZE_LIMIT = 950 * 1024;

/** 시황 세션 추가 (session.id를 문서 ID로 사용). 1MB 초과 시 uploadedImages 제외 후 저장 */
export async function addSessionToFirestore(uid: string, session: ArchiveSession): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore가 초기화되지 않았습니다.");
  const ref = doc(db, "users", uid, "sessions", session.id);

  const buildPayload = (omitImages: boolean) => {
    const { id, uploadedImages, ...rest } = session;
    const data = omitImages ? rest : { ...rest, uploadedImages };
    const sanitized = sanitizeForFirestore(data) as Record<string, unknown>;
    return { ...sanitized, createdAt: session.createdAt, addedAt: serverTimestamp() };
  };

  const payloadForSizeCheck = (omitImages: boolean) => {
    const { id, uploadedImages, ...rest } = session;
    const data = omitImages ? rest : { ...rest, uploadedImages };
    const sanitized = sanitizeForFirestore(data) as Record<string, unknown>;
    return { ...sanitized, createdAt: session.createdAt, addedAt: "_" };
  };

  let payload = buildPayload(false);
  const size = new Blob([JSON.stringify(payloadForSizeCheck(false))]).size;
  if (size > FIRESTORE_DOC_SIZE_LIMIT && session.uploadedImages?.length) {
    payload = buildPayload(true);
  }

  await setDoc(ref, payload, { merge: true });
}

/** 시황 세션 삭제 */
export async function deleteSessionFromFirestore(uid: string, sessionId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const ref = doc(db, "users", uid, "sessions", sessionId);
  await deleteDoc(ref);
}
