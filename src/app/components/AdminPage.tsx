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
  setAdminTestExpectedReadyAt,
  type AdminSchedule,
} from "../utils/adminSettings";
import { getAppLog, clearAppLog } from "../utils/appLogger";

const sectionClass = "bg-white/5 border border-white/10 rounded-[10px] p-4 mb-4";
const labelClass = "text-white/80 text-sm mb-2 block";
const inputClass =
  "w-full px-3 py-2 rounded-[8px] border border-white/15 bg-white/5 text-white text-sm placeholder-white/30";

export function AdminPage() {
  const location = useLocation();
  const isUnderSettings = location.pathname.startsWith("/settings/");
  const { refresh, hideMarket, showNewsTab, schedule, movers, testRunAt, testExpectedReadyAt } = useAdminSettings();
  const [countdownSec, setCountdownSec] = useState<number>(0);
  const [moversEdit, setMoversEdit] = useState<string>("");
  const [scheduleEdit, setScheduleEdit] = useState<AdminSchedule>({ usHour: 8, usMinute: 30, krHour: 16, krMinute: 30 });
  const [logPreview, setLogPreview] = useState<string>(() => getAppLog());

  useEffect(() => {
    setScheduleEdit(schedule);
  }, [schedule]);

  useEffect(() => {
    const target = testExpectedReadyAt ?? testRunAt;
    if (target == null || target <= Date.now()) {
      setCountdownSec(0);
      if (testExpectedReadyAt != null && testExpectedReadyAt <= Date.now()) {
        setAdminTestExpectedReadyAt(null);
        refresh();
      }
      return;
    }
    const tick = () => {
      const remain = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setCountdownSec(remain);
      if (remain <= 0 && testExpectedReadyAt != null) {
        setAdminTestExpectedReadyAt(null);
        refresh();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [testRunAt, testExpectedReadyAt, refresh]);

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
    setAdminTestRunAt(Date.now()); // 즉시 실행 트리거
    setAdminTestExpectedReadyAt(Date.now() + minutes * 60 * 1000); // 결과 예상 시각 (타이머용)
    applyRefresh();
  };

  const handleScheduleSave = () => {
    setAdminSchedule(scheduleEdit);
    applyRefresh();
  };

  const refreshLogPreview = () => {
    setLogPreview(getAppLog());
  };

  const handleExportLog = () => {
    const raw = getAppLog();
    if (!raw.trim()) return;
    const blob = new Blob([raw], { type: "application/jsonl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `newsbrief-log-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLog = () => {
    clearAppLog();
    refreshLogPreview();
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
        <p className="text-white/50 text-xs mb-3">누르는 즉시 생성 시작. 1분/3분 후 결과 확인 가능.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleTestRun(1)}
            disabled={testRunAt != null || testExpectedReadyAt != null}
            className={`px-4 py-2 rounded-[8px] text-sm font-medium transition-colors ${
              testRunAt != null || testExpectedReadyAt != null
                ? "bg-[#618EFF]/30 text-[#618EFF] border border-[#618EFF]/50 cursor-default"
                : "bg-white/10 hover:bg-white/15 text-white border border-white/15"
            }`}
          >
            1분
          </button>
          <button
            type="button"
            onClick={() => handleTestRun(3)}
            disabled={testRunAt != null || testExpectedReadyAt != null}
            className={`px-4 py-2 rounded-[8px] text-sm font-medium transition-colors ${
              testRunAt != null || testExpectedReadyAt != null
                ? "bg-[#618EFF]/30 text-[#618EFF] border border-[#618EFF]/50 cursor-default"
                : "bg-white/10 hover:bg-white/15 text-white border border-white/15"
            }`}
          >
            3분
          </button>
          {(testRunAt != null || testExpectedReadyAt != null) && countdownSec > 0 && (
            <span className="text-[#618EFF] text-sm font-medium tabular-nums">
              {Math.floor(countdownSec / 60)}:{String(countdownSec % 60).padStart(2, "0")}
            </span>
          )}
        </div>
      </section>

      {/* 3. 오늘의 뉴스 보이기 - 숨김 */}
      {false && (
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
      )}

      {/* 4. M7·반도체 종목 - 숨김 */}
      {false && (
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
      )}

      {/* 5. 앱 로그 저장소 - 숨김 */}
      {false && (
      <section className={sectionClass}>
        <h3 className={labelClass}>앱 로그 데이터 저장소</h3>
        <p className="text-white/50 text-xs mb-2">앱 내 이벤트 기록 (AI 파싱용 JSONL)</p>
        <textarea
          readOnly
          value={logPreview}
          className={`${inputClass} min-h-[80px] resize-y font-mono text-xs`}
          rows={6}
          style={{ fontSize: 11 }}
        />
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => { refreshLogPreview(); applyRefresh(); }}
            className="px-4 py-2 rounded-[8px] bg-white/10 hover:bg-white/15 text-white text-sm"
          >
            새로고침
          </button>
          <button
            type="button"
            onClick={handleExportLog}
            disabled={!logPreview.trim()}
            className="px-4 py-2 rounded-[8px] bg-white/10 hover:bg-white/15 text-white text-sm disabled:opacity-50"
          >
            내보내기 (.jsonl)
          </button>
          <button
            type="button"
            onClick={handleClearLog}
            className="px-4 py-2 rounded-[8px] bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm"
          >
            초기화
          </button>
        </div>
      </section>
      )}

      {/* 6. 자동생성 시간 - 숨김 */}
      {false && (
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
      )}
    </div>
  );
}
