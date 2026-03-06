/**
 * 시황 자동 생성 스케줄러
 * 미국 8:30 / 한국 16:30 (KST) - 휴장일 제외
 */

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useArchive } from "./ArchiveContext";
import { runMarketSummaryPipeline } from "../utils/runMarketSummaryPipeline";
import { appLog } from "../utils/appLogger";
import { getSelectedSources } from "../utils/persistState";
import { domesticSources, internationalSources } from "../data/newsSources";
import { shouldSkipUsSummary, isKrMarketHoliday } from "../utils/marketHolidays";
import { getAdminSchedule, getAdminTestRunAt, setAdminTestRunAt } from "../utils/adminSettings";

const RAN_US_KEY = "newsbrief_ran_us";
const RAN_KR_KEY = "newsbrief_ran_kr";

function toDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getRanKey(kind: "us" | "kr"): string {
  try {
    return localStorage.getItem(kind === "us" ? RAN_US_KEY : RAN_KR_KEY) ?? "";
  } catch {
    return "";
  }
}

function setRanKey(kind: "us" | "kr"): void {
  try {
    localStorage.setItem(kind === "us" ? RAN_US_KEY : RAN_KR_KEY, toDateKey());
  } catch {}
}

function isInWindow(hour: number, minute: number, windowMin = 7): boolean {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const targetMin = hour * 60 + minute;
  return nowMin >= targetMin - windowMin && nowMin <= targetMin + windowMin;
}

function getSchedule() {
  return getAdminSchedule();
}

const MarketScheduleContext = createContext<{ isRunning: boolean } | null>(null);

export function MarketScheduleProvider({ children }: { children: ReactNode }) {
  const { addSession } = useArchive();
  const runningRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function checkAndRun() {
      if (runningRef.current) return;
      const now = Date.now();
      const testRunAt = getAdminTestRunAt();
      if (testRunAt != null && now >= testRunAt) {
        setAdminTestRunAt(null);
        window.dispatchEvent(new CustomEvent("admin_settings_changed"));
        runningRef.current = true;
        Promise.all([
          runMarketSummaryPipeline(true, { addSession }),
          runMarketSummaryPipeline(false, { addSession }),
        ]).catch((e) => {
          appLog("scheduler_error", { msg: String(e) });
        }).finally(() => { runningRef.current = false; });
        return;
      }
      const today = toDateKey();
      const selectedSources = getSelectedSources();
      const selectedSet = new Set(selectedSources.sources);
      const hasIntl = internationalSources.some((s) => selectedSet.has(s.id));
      const hasDomestic = domesticSources.some((s) => selectedSet.has(s.id));
      const canRunOverseas = hasIntl || hasDomestic;

      const sched = getSchedule();
      if (canRunOverseas && isInWindow(sched.usHour, sched.usMinute) && getRanKey("us") !== today && !shouldSkipUsSummary()) {
        runningRef.current = true;
        setRanKey("us");
        runMarketSummaryPipeline(true, { addSession })
          .catch((e) => { appLog("scheduler_error", { msg: String(e), intl: true }); })
          .finally(() => {
            runningRef.current = false;
          });
        return;
      }
      if (hasDomestic && isInWindow(sched.krHour, sched.krMinute) && getRanKey("kr") !== today && !isKrMarketHoliday()) {
        runningRef.current = true;
        setRanKey("kr");
        runMarketSummaryPipeline(false, { addSession })
          .catch((e) => { appLog("scheduler_error", { msg: String(e), intl: false }); })
          .finally(() => {
            runningRef.current = false;
          });
      }
    }

    checkAndRun();
    const onSettingsChange = () => checkAndRun();
    window.addEventListener("admin_settings_changed", onSettingsChange);
    const schedule = () => {
      if (document.hidden) return;
      checkAndRun();
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (!intervalRef.current) {
        intervalRef.current = setInterval(schedule, 10000);
      }
    };
    if (!document.hidden) intervalRef.current = setInterval(schedule, 10000);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("admin_settings_changed", onSettingsChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [addSession]);

  return (
    <MarketScheduleContext.Provider value={{ isRunning: false }}>
      {children}
    </MarketScheduleContext.Provider>
  );
}

export function useMarketSchedule() {
  const ctx = useContext(MarketScheduleContext);
  return ctx ?? { isRunning: false };
}
