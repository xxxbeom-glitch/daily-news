import { useState } from "react";
import { searchYouTubeMarketVideos, type YouTubeMarketVideo } from "../utils/youtubeService";
import { generateMarketSummaryFromVideo } from "../utils/aiSummary";
import { getSelectedModel } from "../utils/persistState";
import { MarketSummaryView } from "./MarketSummaryView";

export function TestPage() {
  const [videos, setVideos] = useState<YouTubeMarketVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<YouTubeMarketVideo | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<Parameters<typeof MarketSummaryView>[0]["data"] | null>(null);
  const [selectedModel, setSelectedModel] = useState<"gemini" | "gpt">("gemini");

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    setSummaryData(null);
    try {
      const list = await searchYouTubeMarketVideos();
      setVideos(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "검색 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (video: YouTubeMarketVideo) => {
    setSelected(video);
    setSummaryLoading(true);
    setSummaryData(null);
    try {
      const model = getSelectedModel();
      setSelectedModel(model);
      const data = await generateMarketSummaryFromVideo(video.title, video.description, {
        model,
      });
      setSummaryData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "요약 생성 실패");
    } finally {
      setSummaryLoading(false);
    }
  };

  const internalLink = `${typeof window !== "undefined" ? window.location.origin : ""}/test`;

  return (
    <div className="flex flex-col min-h-full px-4 pt-5 pb-6">
      <div className="mb-4 p-3 rounded-[10px] bg-white/5 border border-white/10">
        <p className="text-white/50 text-xs mb-1">내부 링크</p>
        <a
          href={internalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#618EFF] hover:text-[#8BABFF] break-all"
          style={{ fontSize: 13 }}
        >
          {internalLink}
        </a>
      </div>
      <h2 className="text-white font-bold mb-4" style={{ fontSize: 18 }}>
        유튜브 시황 검색
      </h2>

      <button
        type="button"
        onClick={handleSearch}
        disabled={loading}
        className="w-full py-3 rounded-[10px] bg-[#618EFF]/20 border border-[#618EFF]/40 text-[#618EFF] font-semibold disabled:opacity-60"
        style={{ fontSize: 15 }}
      >
        {loading ? "검색 중…" : "시황 영상 검색"}
      </button>

      {error && (
        <p className="mt-3 text-red-400 text-sm">{error}</p>
      )}

      {videos.length > 0 && !selected && (
        <div className="mt-4 space-y-3">
          <p className="text-white/60 text-sm">영상을 선택하면 AI 요약이 생성됩니다.</p>
          {videos.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => handleSelect(v)}
              className="w-full flex gap-3 p-3 rounded-[10px] border border-white/10 bg-white/5 hover:bg-white/8 text-left"
            >
              {v.thumbnailUrl && (
                <img
                  src={v.thumbnailUrl}
                  alt=""
                  className="w-24 h-14 object-cover rounded shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate" style={{ fontSize: 14 }}>
                  {v.title}
                </p>
                <p className="text-white/50 text-xs mt-0.5">{v.channelTitle}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setSummaryData(null);
            }}
            className="mb-3 text-white/60 hover:text-white/90 text-sm"
          >
            ← 목록으로
          </button>
          <div className="flex gap-3 p-3 rounded-[10px] border border-white/10 bg-white/5">
            {selected.thumbnailUrl && (
              <img
                src={selected.thumbnailUrl}
                alt=""
                className="w-24 h-14 object-cover rounded shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium" style={{ fontSize: 14 }}>
                {selected.title}
              </p>
              <p className="text-white/50 text-xs mt-0.5">{selected.channelTitle}</p>
            </div>
          </div>

          {summaryLoading && (
            <p className="mt-4 text-white/60 text-sm">AI 요약 생성 중…</p>
          )}

          {summaryData && !summaryLoading && (
            <div className="mt-4 overflow-y-auto max-h-[60vh]">
              <MarketSummaryView
                data={summaryData}
                aiModel={selectedModel}
                articles={[]}
              />
            </div>
          )}
        </div>
      )}

      {!loading && videos.length === 0 && !selected && (
        <p className="mt-6 text-white/40 text-center" style={{ fontSize: 14 }}>
          검색을 눌러 매일경제TV [간밤 미국은], 채널K 글로벌 체크인 뉴욕의 당일 시황 영상을 불러오세요.
        </p>
      )}
    </div>
  );
}
