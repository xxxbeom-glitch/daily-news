/**
 * 관리자 설정 (설정 > 관리자)
 */
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { useAdminSettings } from "../context/AdminSettingsContext";
import {
  setAdminHideMarket,
  setAdminShowNewsTab,
  setAdminModelId,
  setAdminMovers,
  setAdminSchedule,
  setAdminTestRunAt,
  GEMINI_MODELS,
  OPENAI_MODELS,
  type AdminSchedule,
} from "../utils/adminSettings";

const sectionClass = "bg-white/5 border border-white/10 rounded-[10px] p-4 mb-4";
const labelClass = "text-white/80 text-sm mb-2 block";
const inputClass =
  "w-full px-3 py-2 rounded-[8px] border border-white/15 bg-white/5 text-white text-sm placeholder-white/30";

export function AdminPage() {
  const location = useLocation();
  const isUnderSettings = location.pathname.startsWith("/settings/");
  const { refresh, hideMarket, showNewsTab, modelId, schedule, movers } = useAdminSettings();
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [modelSelect, setModelSelect] = useState<string | null>(() => modelId);
  const [moversEdit, setMoversEdit] = useState<string>("");
  const [scheduleEdit, setScheduleEdit] = useState<AdminSchedule>({ usHour: 8, usMinute: 30, krHour: 16, krMinute: 30 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setScheduleEdit(schedule);
  }, [schedule]);

  useEffect(() => {
    setModelSelect(modelId);
  }, [modelId]);

  useEffect(() => {
    setMoversEdit(
      Object.entries(movers)
        .map(([k, v]) => `${k}:${v}`)
        .join("\n")
    );
  }, [movers]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleModelSelect = (id: string | null) => {
    setModelSelect(id);
    setDropdownOpen(null);
  };

  const handleModelSave = () => {
    setAdminModelId(modelSelect);
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleTestRun(1)}
            className="px-4 py-2 rounded-[8px] bg-white/10 hover:bg-white/15 text-white text-sm"
          >
            1분 후
          </button>
          <button
            type="button"
            onClick={() => handleTestRun(3)}
            className="px-4 py-2 rounded-[8px] bg-white/10 hover:bg-white/15 text-white text-sm"
          >
            3분 후
          </button>
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

      {/* 4. 모델 선택 */}
      <section className={sectionClass}>
        <h3 className={labelClass}>AI 엔진 모델</h3>
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => (o === "model" ? null : "model"))}
              className="w-full flex items-center justify-between px-3 py-2 rounded-[8px] border border-white/15 bg-white/5 text-white text-sm"
            >
              <span>{modelSelect ?? "기본 설정 사용"}</span>
              <ChevronDown size={16} className={`transition-transform shrink-0 ${dropdownOpen === "model" ? "rotate-180" : ""}`} />
            </button>
            {dropdownOpen === "model" && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-[200px] overflow-y-auto rounded-[8px] border border-white/15 bg-[#12121a] shadow-xl z-20">
                <button
                  type="button"
                  onClick={() => handleModelSelect(null)}
                  className="w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10"
                >
                  기본 설정 사용
                </button>
                <div className="border-t border-white/10 py-1">
                  <div className="px-3 py-1 text-white/50 text-xs">Gemini</div>
                  {GEMINI_MODELS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleModelSelect(id)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-white/10 ${modelSelect === id ? "text-white font-medium" : "text-white/90"}`}
                    >
                      {id}
                    </button>
                  ))}
                </div>
                <div className="border-t border-white/10 py-1">
                  <div className="px-3 py-1 text-white/50 text-xs">OpenAI</div>
                  {OPENAI_MODELS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleModelSelect(id)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-white/10 ${modelSelect === id ? "text-white font-medium" : "text-white/90"}`}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleModelSave}
            className="shrink-0 px-4 py-2 rounded-[8px] bg-[#618EFF]/20 hover:bg-[#618EFF]/30 text-[#618EFF] border border-[#618EFF]/40 text-sm font-medium transition-colors"
          >
            저장
          </button>
        </div>
      </section>

      {/* 5. M7·반도체 종목 */}
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

      {/* 6. 자동생성 시간 */}
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
