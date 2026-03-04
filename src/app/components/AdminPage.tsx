/**
 * 관리자 설정 (설정 > 관리자)
 */
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAdminSettings } from "../context/AdminSettingsContext";
import {
  setAdminHideMarket,
  setAdminShowNewsTab,
  setAdminMovers,
  setAdminSchedule,
  setAdminTestRunAt,
  type AdminSchedule,
} from "../utils/adminSettings";

const sectionClass = "bg-white/5 border border-white/10 rounded-[10px] p-4 mb-4";
const labelClass = "text-white/80 text-sm mb-2 block";
const inputClass =
  "w-full px-3 py-2 rounded-[8px] border border-white/15 bg-white/5 text-white text-sm placeholder-white/30";

export function AdminPage() {
  const location = useLocation();
  const isUnderSettings = location.pathname.startsWith("/settings/");
  const { refresh, hideMarket, showNewsTab, schedule, movers, testRunAt } = useAdminSettings();
  const [countdownSec, setCountdownSec] = useState<number>(0);
  const [moversEdit, setMoversEdit] = useState<string>("");
  const [scheduleEdit, setScheduleEdit] = useState<AdminSchedule>({ usHour: 8, usMinute: 30, krHour: 16, krMinute: 30 });

  useEffect(() => {
    setScheduleEdit(schedule);
  }, [schedule]);

  useEffect(() => {
    if (testRunAt == null || testRunAt <= Date.now()) {
      setCountdownSec(0);
      return;
    }
    const tick = () => {
      const remain = Math.max(0, Math.ceil((testRunAt - Date.now()) / 1000));
      setCountdownSec(remain);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [testRunAt]);

  useEffect(() => {
    setMoversEdit(
      Object.entries(movers)
        .map(([k, v]) => `${k}:${v}`)
        .join("\n")
    );
  }, [movers]);

  const applyRefresh = () => {
    refresh();
  };

  const handleHideMarket = (v: boolean) => {
    setAdminHideMarket(v);
    applyRefresh();
  };

  const handleShowNewsTab = (v: boolean) => {
    setAdminShowNewsTab(v);
    applyRefresh();
  };

  const handleTestRun = (minutes: number) => {
    setAdminTestRunAt(Date.now() + minutes * 60 * 1000);
    applyRefresh();
  };

  const handleScheduleSave = () => {
    setAdminSchedule(scheduleEdit);
    applyRefresh();
  };

  const handleMoversSave = () => {
    const map: Record<string, string> = {};
    const lines = moversEdit.trim().split(/\n/).filter(Boolean);
    for (const line of lines) {
      const m = line.trim().match(/^([A-Za-z0-9.]+)\s*[:=]\s*(.+)$/);
      if (m) map[m[1].toUpperCase()] = m[2].trim();
    }
    if (Object.keys(map).length > 0) {
      setAdminMovers(map);
      applyRefresh();
    }
  };

  return (
    <div className="px-4 py-6">
      {isUnderSettings && (
        <Link
          to="/settings"
          className="flex items-center gap-1 text-white/70 hover:text-white mb-4"
          style={{ fontSize: 14 }}
        >
          <ChevronLeft size={18} />
          설정
        </Link>
      )}
      <h1 className="text-white font-bold mb-4" style={{ fontSize: 18 }}>
        관리자
      </h1>

      {/* 1. 오늘의시황 숨김 */}
      <section className={sectionClass}>
        <h3 className={labelClass}>오늘의 시황 데이터 숨김</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleHideMarket(!hideMarket)}
            className={`px-4 py-2 rounded-[8px] text-sm font-medium transition-colors ${
              hideMarket ? "bg-amber-500/25 text-amber-400 border border-amber-500/40" : "bg-white/10 text-white/70 border border-white/15"
            }`}
          >
            {hideMarket ? "숨김" : "표시"}
          </button>
          <span className="text-white/50 text-sm">{hideMarket ? "전체 시황이 숨김 처리됩니다" : "시황이 표시됩니다"}</span>
        </div>
      </section>

      {/* 2. 자동생성 테스트 */}
      <section className={sectionClass}>
        <h3 className={labelClass}>오늘의 시황 자동생성 테스트</h3>
        <p className="text-white/50 text-xs mb-3">1분/3분 후 미국·한국 시황 파이프라인을 실행합니다.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleTestRun(1)}
            disabled={testRunAt != null}
            className={`px-4 py-2 rounded-[8px] text-sm font-medium transition-colors ${
              testRunAt != null
                ? "bg-[#618EFF]/30 text-[#618EFF] border border-[#618EFF]/50 cursor-default"
                : "bg-white/10 hover:bg-white/15 text-white border border-white/15"
            }`}
          >
            1분 후
          </button>
          <button
            type="button"
            onClick={() => handleTestRun(3)}
            disabled={testRunAt != null}
            className={`px-4 py-2 rounded-[8px] text-sm font-medium transition-colors ${
              testRunAt != null
                ? "bg-[#618EFF]/30 text-[#618EFF] border border-[#618EFF]/50 cursor-default"
                : "bg-white/10 hover:bg-white/15 text-white border border-white/15"
            }`}
          >
            3분 후
          </button>
          {testRunAt != null && countdownSec > 0 && (
            <span className="text-[#618EFF] text-sm font-medium tabular-nums">
              {Math.floor(countdownSec / 60)}:{String(countdownSec % 60).padStart(2, "0")}
            </span>
          )}
        </div>
      </section>

      {/* 3. 오늘의 뉴스 보이기 */}
      <section className={sectionClass}>
        <h3 className={labelClass}>오늘의 뉴스 탭 표시</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleShowNewsTab(!showNewsTab)}
            className={`px-4 py-2 rounded-[8px] text-sm font-medium transition-colors ${
              showNewsTab ? "bg-white/10 text-white/70 border border-white/15" : "bg-amber-500/25 text-amber-400 border border-amber-500/40"
            }`}
          >
            {showNewsTab ? "숨기기" : "보이기"}
          </button>
          <span className="text-white/50 text-sm">{showNewsTab ? "탭이 표시됩니다" : "탭이 숨겨집니다"}</span>
        </div>
      </section>

      {/* 4. M7·반도체 종목 */}
      <section className={sectionClass}>
        <h3 className={labelClass}>M7 및 반도체주 등락율 종목</h3>
        <p className="text-white/50 text-xs mb-2">형식: TICKER:기업명 (한 줄에 하나)</p>
        <textarea
          value={moversEdit}
          onChange={(e) => setMoversEdit(e.target.value)}
          placeholder={"NVDA:엔비디아\nAAPL:애플"}
          className={`${inputClass} min-h-[120px] resize-y`}
          rows={6}
        />
        <button
          type="button"
          onClick={handleMoversSave}
          className="mt-2 px-4 py-2 rounded-[8px] bg-white/10 hover:bg-white/15 text-white text-sm"
        >
          저장
        </button>
      </section>

      {/* 5. 자동생성 시간 */}
      <section className={sectionClass}>
        <h3 className={labelClass}>자동 생성 시간 (KST)</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-white/60 text-xs block mb-1">미국 (시)</label>
            <input
              type="number"
              min={0}
              max={23}
              value={scheduleEdit.usHour}
              onChange={(e) => setScheduleEdit((s) => ({ ...s, usHour: parseInt(e.target.value, 10) || 0 }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-white/60 text-xs block mb-1">미국 (분)</label>
            <input
              type="number"
              min={0}
              max={59}
              value={scheduleEdit.usMinute}
              onChange={(e) => setScheduleEdit((s) => ({ ...s, usMinute: parseInt(e.target.value, 10) || 0 }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-white/60 text-xs block mb-1">한국 (시)</label>
            <input
              type="number"
              min={0}
              max={23}
              value={scheduleEdit.krHour}
              onChange={(e) => setScheduleEdit((s) => ({ ...s, krHour: parseInt(e.target.value, 10) || 0 }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-white/60 text-xs block mb-1">한국 (분)</label>
            <input
              type="number"
              min={0}
              max={59}
              value={scheduleEdit.krMinute}
              onChange={(e) => setScheduleEdit((s) => ({ ...s, krMinute: parseInt(e.target.value, 10) || 0 }))}
              className={inputClass}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleScheduleSave}
          className="px-4 py-2 rounded-[8px] bg-white/10 hover:bg-white/15 text-white text-sm"
        >
          저장
        </button>
      </section>
    </div>
  );
}
