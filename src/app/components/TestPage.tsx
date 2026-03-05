import { useState, useEffect } from "react";
import { searchYouTubeMarketVideos, type YouTubeMarketVideo } from "../utils/youtubeService";
import {
  generateFlexibleVideoSummaryFromVideos,
  flexibleToMarketSummary,
  type FlexibleVideoSummary,
} from "../utils/aiSummary";
import { getSelectedModel } from "../utils/persistState";
import { FlexibleSummaryView } from "./FlexibleSummaryView";
import { useArchive } from "../context/ArchiveContext";
import type { Article } from "../data/newsSources";

function formatUploadDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const kr = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const m = kr.getUTCMonth() + 1;
    const day = kr.getUTCDate();
    const h = kr.getUTCHours();
    const min = kr.getUTCMinutes();
    return `${m}월 ${day}일 ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export function TestPage() {
  const { addSession } = useArchive();
  const [videos, setVideos] = useState<YouTubeMarketVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<FlexibleVideoSummary | null>(null);
  const [selectedModel, setSelectedModel] = useState<"gemini" | "gpt">("gemini");

  useEffect(() => {
    let cancelled = false;
    searchYouTubeMarketVideos()
      .then((list) => {
        if (!cancelled) setVideos(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "검색 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAiSummarize = async () => {
    const selected = videos.filter((v) => selectedIds.has(v.id));
    if (selected.length === 0) {
      setError("영상을 선택해주세요.");
      return;
    }
    setSummaryLoading(true);
    setError(null);
    setSummaryData(null);
    try {
      const model = getSelectedModel();
      setSelectedModel(model);
      const data = await generateFlexibleVideoSummaryFromVideos(
        selected.map((v) => ({ title: v.title, description: v.description })),
        { model }
      );
      setSummaryData(data);

      const now = new Date();
      const title =
        `${now.getMonth() + 1}월 ${now.getDate()}일 ` +
        (now.getHours() < 12 ? "오전" : "오후") +
        ` ${String(now.getHours() % 12 || 12).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} · 유튜브 시황`;

      const marketData = flexibleToMarketSummary(data);

      const articlesForSession: Article[] = selected.map((v, i) => ({
        id: `yt-${v.id}-${i}`,
        title: v.title,
        source: v.channelTitle,
        sourceId: "youtube",
        publishedAt: v.publishedAt,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        summary: "",
        aiModel: model,
        category: "Economy",
        isInternational: true,
      }));

      addSession({
        id: `session-${Date.now()}-yt`,
        title,
        createdAt: now.toISOString(),
        isInternational: true,
        sources: ["youtube"],
        articles: articlesForSession,
        marketSummary: marketData,
        aiModel: model,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "요약 생성 실패");
    } finally {
      setSummaryLoading(false);
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 pt-5 pb-[100px]">
        {loading && (
          <p className="text-white/50 text-sm">영상 불러오는 중…</p>
        )}

        {error && !loading && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        {!loading && videos.length > 0 && !summaryData && (
          <div className="space-y-3">
            <p className="text-white/60 text-sm">
              원하는 영상을 선택한 뒤 하단 AI요약하기 버튼을 눌러주세요.
            </p>
            {videos.map((v) => (
              <label
                key={v.id}
                className="flex gap-3 p-3 rounded-[10px] border border-white/10 bg-white/5 hover:bg-white/8 cursor-pointer items-start"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(v.id)}
                  onChange={() => toggleSelect(v.id)}
                  className="mt-1.5 shrink-0 accent-[#618EFF]"
                />
                {v.thumbnailUrl && (
                  <img
                    src={v.thumbnailUrl}
                    alt=""
                    className="w-24 h-14 object-cover rounded shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium line-clamp-2" style={{ fontSize: 14 }}>
                    {v.title}
                  </p>
                  <p className="text-white/50 text-xs mt-0.5">{v.channelTitle}</p>
                  {v.publishedAt && (
                    <p className="text-white/40 text-xs mt-1">{formatUploadDate(v.publishedAt)}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        {summaryData && !summaryLoading && (
          <div className="space-y-4">
            <p className="text-[#618EFF] text-sm font-medium">
              오늘의 시황(미국시황)에 추가되었습니다.
            </p>
            <div className="overflow-y-auto max-h-[60vh]">
              <FlexibleSummaryView data={summaryData} />
            </div>
            <button
              type="button"
              onClick={() => {
                setSummaryData(null);
                setSelectedIds(new Set());
              }}
              className="text-white/60 hover:text-white/90 text-sm"
            >
              목록으로 돌아가기
            </button>
          </div>
        )}

        {summaryLoading && (
          <p className="mt-4 text-white/60 text-sm">AI 시황 요약 생성 중…</p>
        )}

        {!loading && videos.length === 0 && !summaryData && (
          <p className="mt-6 text-white/40 text-center" style={{ fontSize: 14 }}>
            당일 시황 영상이 없습니다. 매일경제TV [간밤 미국은], 채널K 글로벌 체크인 뉴욕을 확인해주세요.
          </p>
        )}
      </div>

      {!loading && videos.length > 0 && !summaryData && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#0a0a0f]/95 backdrop-blur-md border-t border-white/6 px-4 pt-3 pb-5 z-10">
          <button
            type="button"
            onClick={handleAiSummarize}
            disabled={selectedCount === 0 || summaryLoading}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-[10px] font-semibold transition-all ${
              selectedCount === 0 || summaryLoading
                ? "bg-white/5 text-white/30 cursor-not-allowed"
                : "bg-[#618EFF] text-white shadow-xl shadow-[#2C3D6B]/40"
            }`}
            style={{ fontSize: 15, fontWeight: 500 }}
          >
            {summaryLoading ? (
              "AI 시황 요약 생성 중…"
            ) : (
              <>
                AI요약하기
                {selectedCount > 0 && (
                  <span className="opacity-90">({selectedCount}개 선택)</span>
                )}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
