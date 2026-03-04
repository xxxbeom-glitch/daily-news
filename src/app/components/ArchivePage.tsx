import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, BookmarkX } from "lucide-react";
import { useArchive } from "../context/ArchiveContext";
import { saveArchiveState, loadArchiveState } from "../utils/persistState";
import type { ArchiveSession } from "../data/newsSources";
import { MarketSummaryView } from "./MarketSummaryView";

const CONFIRM_MS = 2500;

export function ArchivePage() {
  const { sessions, deleteSession } = useArchive();
  const [isInternational, setIsInternational] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 모바일: 나갔다 오면 화면 초기화 방지 - 저장된 상태 복원
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    const saved = loadArchiveState();
    if (!saved) return;
    setIsInternational(saved.isInternational);
    if (saved.selectedSessionId) setSelectedSessionId(saved.selectedSessionId);
  }, []);

  // 상태 변경 시 sessionStorage에 저장
  useEffect(() => {
    saveArchiveState({ isInternational, selectedSessionId });
  }, [isInternational, selectedSessionId]);

  const filteredSessions = useMemo(
    () =>
      sessions
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
  }, [isInternational, filteredIds]);

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
    <div className="flex flex-col min-h-full px-4 pt-5 pb-6">
      {/* 한 줄: 좌측 AI요약 아티클 드롭다운 | 우측 해외/국내 탭 */}
      <div className="flex items-stretch gap-[36px] mb-4">
        <div ref={dropdownRef} className="relative flex-1 min-w-0">
          <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-[10px] border border-white/10 bg-white/5 text-left"
            style={{ fontSize: 12 }}
          >
            <span className="text-white/90 truncate">
              {selectedSession
                ? selectedSession.title
                : filteredSessions.length === 0
                  ? (isInternational ? "저장된 해외 시황이 없습니다" : "저장된 국내 시황이 없습니다")
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
        <div className="flex shrink-0 rounded-[10px] border border-white/10 bg-white/5 px-[6px] py-2">
          <button
            type="button"
            onClick={() => setIsInternational(true)}
            className={`px-[6px] py-0 transition-colors ${isInternational ? "text-white font-medium" : "text-white/35 hover:text-white/50"}`}
            style={{ fontSize: 12 }}
          >
            미국
          </button>
          <button
            type="button"
            onClick={() => setIsInternational(false)}
            className={`px-[6px] py-0 transition-colors ${!isInternational ? "text-white font-medium" : "text-white/35 hover:text-white/50"}`}
            style={{ fontSize: 12 }}
          >
            한국
          </button>
        </div>
      </div>

      {/* 시황 요약 단일 뷰 */}
      {selectedSession?.marketSummary && Array.isArray(selectedSession.marketSummary?.indices) ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <MarketSummaryView
            key={selectedSession.id}
            data={selectedSession.marketSummary}
            aiModel={selectedSession.aiModel ?? "gemini"}
          />
        </div>
      ) : selectedSession ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <p style={{ fontSize: 14 }} className="text-white/50 text-center">
            이전 형식으로 저장된 아카이브입니다.<br />
            시황 요약을 확인할 수 없습니다.
          </p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <p style={{ fontSize: 14 }} className="text-white/40 text-center">
            {isInternational ? "저장된 해외 시황이 없습니다." : "저장된 국내 시황이 없습니다."}
            <br />
            뉴스 검색에서 시황을 생성해 주세요.
          </p>
        </div>
      ) : null}
    </div>
  );
}
