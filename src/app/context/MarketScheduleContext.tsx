/**
 * 시황 자동 생성 스케줄러
 * 한국 16:30 (KST) - 휴장일 제외
 */

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useArchive } from "./ArchiveContext";
import { runMarketSummaryPipeline } from "../utils/runMarketSummaryPipeline";
import { appLog } from "../utils/appLogger";
import { getSelectedSources } from "../utils/persistState";
import { domesticSources } from "../data/newsSources";
import { isKrMarketHoliday } from "../utils/marketHolidays";
import { getAdminSchedule, getAdminTestRunAt, setAdminTestRunAt } from "../utils/adminSettings";

const RAN_KR_KEY = "newsbrief_ran_kr";

function toDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getRanKeyKr(): string {
  try {
    return localStorage.getItem(RAN_KR_KEY) ?? "";
  } catch {
    return "";
  }
}

function setRanKeyKr(): void {
  try {
    localStorage.setItem(RAN_KR_KEY, toDateKey());
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
        runMarketSummaryPipeline(false, { addSession })
          .catch((e) => { appLog("scheduler_error", { msg: String(e) }); })
          .finally(() => { runningRef.current = false; });
        return;
      }
      const today = toDateKey();
      const selectedSources = getSelectedSources();
      const selectedSet = new Set(selectedSources.sources);
      const hasDomestic = domesticSources.some((s) => selectedSet.has(s.id));

      const sched = getSchedule();
      if (hasDomestic && isInWindow(sched.krHour, sched.krMinute) && getRanKeyKr() !== today && !isKrMarketHoliday()) {
        runningRef.current = true;
        setRanKeyKr();
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
