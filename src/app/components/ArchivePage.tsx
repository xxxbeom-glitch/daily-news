import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, BookmarkX } from "lucide-react";
import { useArchive } from "../context/ArchiveContext";
import { useFirebase } from "../context/FirebaseContext";
import { useAdminSettings } from "../context/AdminSettingsContext";
import { saveArchiveState, loadArchiveState } from "../utils/persistState";
import type { ArchiveSession } from "../data/newsSources";
import { MarketSummaryView } from "./MarketSummaryView";

const CONFIRM_MS = 2500;

export function ArchivePage() {
  const { sessions, deleteSession } = useArchive();
  const { refreshSessionsFromCloud, isEnabled: isFirebaseEnabled } = useFirebase();
  const { hideMarket } = useAdminSettings();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isInternational, setIsInternational] = useState(() => loadArchiveState()?.isInternational ?? true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    const saved = loadArchiveState();
    if (saved) {
      if (typeof saved.isInternational === "boolean") setIsInternational(saved.isInternational);
      if (saved.selectedSessionId) setSelectedSessionId(saved.selectedSessionId);
    }
  }, []);

  useEffect(() => {
    saveArchiveState({ isInternational, selectedSessionId });
  }, [isInternational, selectedSessionId]);

  const filteredSessions = useMemo(
    () =>
      [...sessions]
        .filter((s) => s.isInternational === isInternational)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [sessions, isInternational]
  );

  const selectedSession = filteredSessions.find((s) => s.id === selectedSessionId)
    ?? filteredSessions[0] ?? null;

  // 탭 변경 시 해당 영역의 첫 세션 자동 선택 (최초 1회 또는 탭/리스트 변경 시에만)
  const filteredIds = filteredSessions.map((s) => s.id).join(",");
  useEffect(() => {
    if (filteredSessions.length > 0) {
      const first = filteredSessions[0];
      setSelectedSessionId((prev) => {
        if (prev && filteredSessions.some((s) => s.id === prev)) return prev;
        return first.id;
      });
    } else {
      setSelectedSessionId(null);
    }
  }, [filteredIds]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 리포트 페이지 진입 시 클라우드에서 최신 세션 불러오기 (PC에서 만든 리포트가 모바일에서 보이도록)
  useEffect(() => {
    if (!isFirebaseEnabled) return;
    refreshSessionsFromCloud();
  }, [isFirebaseEnabled, refreshSessionsFromCloud]);

  const handleDeleteClick = (e: React.MouseEvent, session: ArchiveSession) => {
    e.stopPropagation();
    if (confirmDeleteId === session.id) {
      deleteSession(session.id);
      setConfirmDeleteId(null);
      if (selectedSessionId === session.id) {
        const rest = filteredSessions.filter((s) => s.id !== session.id);
        setSelectedSessionId(rest[0]?.id ?? null);
      }
    } else {
      setConfirmDeleteId(session.id);
      setTimeout(() => setConfirmDeleteId(null), CONFIRM_MS);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-4 pt-5 pb-6">
      <div className="flex items-stretch gap-0 mb-4 shrink-0">
        {/* AI요약 아티클 드롭다운 */}
        <div ref={dropdownRef} className="relative flex-1 min-w-0 flex">
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 h-10 rounded-l-[10px] rounded-r-none border border-white/10 border-r-0 bg-white/5 text-left"
            style={{ fontSize: 12 }}
          >
            <span className="text-white/90 truncate">
              {selectedSession
                ? selectedSession.title
                : filteredSessions.length === 0
                  ? "저장된 리포트가 없습니다"
                  : "시황 요약 선택"}
            </span>
            <ChevronDown
              size={18}
              className={`text-white/40 flex-shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {dropdownOpen && filteredSessions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 max-h-[280px] overflow-y-auto rounded-[10px] border border-white/10 bg-[#12121a] shadow-xl z-20">
              {filteredSessions.map((s) => (
                <div
                key={s.id}
                role="button"
                tabIndex={0}
                className={`flex items-center justify-between gap-2 px-4 py-3 cursor-pointer border-b border-white/6 last:border-b-0 hover:bg-white/5 ${
                  selectedSessionId === s.id ? "bg-white/8" : ""
                }`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  setSelectedSessionId(s.id);
                  setDropdownOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedSessionId(s.id);
                    setDropdownOpen(false);
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 12 }} className="text-white/90 truncate">
                    {s.title}
                  </div>
                  <div style={{ fontSize: 12 }} className="text-white/40 mt-0.5">
                    {new Date(s.createdAt).toLocaleString("ko-KR")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDeleteClick(e, s)}
                  className={`flex-shrink-0 flex items-center gap-1 rounded-[6px] border px-2 py-1 transition-all ${
                    confirmDeleteId === s.id
                      ? "bg-red-500/25 text-red-400 border-red-500/30"
                      : "bg-white/5 border-white/10 text-white/50 hover:text-white/70"
                  }`}
                  style={{ fontSize: 12 }}
                >
                  <BookmarkX size={12} />
                  {confirmDeleteId === s.id ? "삭제?" : "삭제"}
                </button>
              </div>
            ))}
          </div>
        )}
        </div>

        {/* 국가 탭 - 드롭다운과 동일 스타일, active: text-white, inactive: opacity-40 */}
        <div className="flex shrink-0 h-10 rounded-r-[10px] rounded-l-none border border-white/10 border-l-0 bg-white/5 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsInternational(false)}
            className={`flex-1 min-w-[52px] h-full flex items-center justify-center transition-colors border-r border-white/10 ${
              !isInternational ? "text-white" : "opacity-40"
            }`}
            style={{ fontSize: 12 }}
          >
            한국
          </button>
          <button
            type="button"
            onClick={() => setIsInternational(true)}
            className={`flex-1 min-w-[52px] h-full flex items-center justify-center transition-colors ${
              isInternational ? "text-white" : "opacity-40"
            }`}
            style={{ fontSize: 12 }}
          >
            미국
          </button>
        </div>
      </div>

      {/* 시황 요약 단일 뷰 - 현재 화면 높이 내에서만 스크롤 */}
      {hideMarket && selectedSession ? (
        <div className="flex-1 min-h-0 flex items-center justify-center py-12 overflow-hidden">
          <p style={{ fontSize: 14 }} className="text-white/50 text-center">
            모닝뉴스가 숨김 처리되어 있습니다.
          </p>
        </div>
      ) : selectedSession?.marketSummary && (Array.isArray(selectedSession.marketSummary?.indices) && selectedSession.marketSummary.indices.length > 0
          || Array.isArray(selectedSession.marketSummary?.sectorEtf) && selectedSession.marketSummary.sectorEtf.length > 0
          || Array.isArray(selectedSession.marketSummary?.currencies) && (selectedSession.marketSummary.currencies?.length ?? 0) > 0
          || Array.isArray(selectedSession.marketSummary?.commodities) && (selectedSession.marketSummary.commodities?.length ?? 0) > 0
          || (selectedSession.marketSummary?.keyIssues?.length ?? 0) > 0) ? (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <MarketSummaryView
            key={selectedSession.id}
            data={selectedSession.marketSummary}
            aiModel={selectedSession.aiModel ?? "gemini"}
            articles={selectedSession.articles}
            displayDate={
              (selectedSession.marketSummary?.regionLabel?.includes?.("한국경제") ||
                selectedSession.marketSummary?.regionLabel?.includes?.("글로벌 마켓")) &&
              selectedSession.createdAt
                ? (() => {
                    const d = new Date(selectedSession.createdAt);
                    const w = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
                    return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")} (${w})`;
                  })()
                : undefined
            }
          />
        </div>
      ) : selectedSession ? (
        <div className="flex-1 min-h-0 flex items-center justify-center py-12 overflow-hidden">
          <p style={{ fontSize: 14 }} className="text-white/50 text-center">
            이전 형식으로 저장된 아카이브입니다.<br />
            시황 요약을 확인할 수 없습니다.
          </p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center py-12 overflow-hidden">
          <p style={{ fontSize: 14 }} className="text-white/40 text-center">
            저장된 리포트가 없습니다.
          </p>
        </div>
      ) : null}
    </div>
  );
}
