/**
 * 앱 이벤트 로그 - AI 파싱용 구조화 저장소
 * 형식: t=epochMs, e=event, c=context (JSON Lines)
 */
const LOG_KEY = "newsbrief_app_log";
const MAX_LINES = 800;
const MAX_BYTES = 200000;

function getLogLines(): string[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    return raw.split("\n").filter((s) => s.trim().length > 0);
  } catch {
    return [];
  }
}

function trimLog(lines: string[]): string[] {
  if (lines.length <= MAX_LINES) return lines;
  return lines.slice(-MAX_LINES);
}

function trimByBytes(text: string): string {
  if (text.length <= MAX_BYTES) return text;
  const lines = text.split("\n");
  let acc = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    const next = lines[i] + (acc ? "\n" + acc : "");
    if (next.length > MAX_BYTES) break;
    acc = next;
  }
  return acc;
}

function append(line: string): void {
  try {
    const lines = getLogLines();
    lines.push(line);
    const trimmed = trimLog(lines);
    const text = trimByBytes(trimmed.join("\n"));
    localStorage.setItem(LOG_KEY, text);
  } catch {
    try {
      localStorage.setItem(LOG_KEY, line);
    } catch {
      /* ignore */
    }
  }
}

/** 이벤트 로그 기록 (AI 파싱용) */
export function appLog(event: string, context?: Record<string, unknown>): void {
  const payload = {
    t: Date.now(),
    e: event,
    ...(context ? { c: context } : {}),
  };
  try {
    append(JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

/** 저장된 로그 전체 조회 */
export function getAppLog(): string {
  try {
    return localStorage.getItem(LOG_KEY) ?? "";
  } catch {
    return "";
  }
}

/** 로그 초기화 */
export function clearAppLog(): void {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    /* ignore */
  }
}
