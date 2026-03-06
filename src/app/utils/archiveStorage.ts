/**
 * 아카이브 localStorage 저장 유틸
 * - base64 이미지 제거하여 용량 초과 방지
 */

import type { ArchiveSession } from "../data/newsSources";

export const ARCHIVES_STORAGE_KEY = "newsbrief_archives";

/** localStorage 용량 제한 회피: base64 data 제거, url/name만 유지 */
export function sanitizeSessionsForLocalStorage(sessions: ArchiveSession[]): ArchiveSession[] {
  return sessions.map((s) => {
    if (!s.uploadedImages?.length) return s;
    const sanitized = s.uploadedImages.map((img) =>
      img.url ? { url: img.url, name: img.name } : { name: img.name }
    );
    return { ...s, uploadedImages: sanitized };
  });
}
