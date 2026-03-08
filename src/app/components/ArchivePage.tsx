import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { loadInsightArchives } from "../utils/insightArchiveStorage";
import { InsightReportView } from "./InsightReportView";
import type { InsightArchiveItem } from "../data/insightReport";

export function ArchivePage() {
  const [items, setItems] = useState<InsightArchiveItem[]>([]);
  const [selected, setSelected] = useState<InsightArchiveItem | null>(null);

  useEffect(() => {
    setItems(loadInsightArchives());
  }, []);

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex items-center gap-2 px-2 py-3 border-b border-white/8 shrink-0">
        <Link
          to="/settings"
          className="p-2 rounded-[8px] text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="설정으로 돌아가기"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 style={{ fontSize: 18, fontWeight: 700 }} className="text-white">
          아카이빙
        </h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {items.length === 0 ? (
          <div className="py-12 text-center text-white/50" style={{ fontSize: 14 }}>
            아카이브된 인사이트가 없습니다.
          </div>
        ) : selected ? (
          <div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mb-3 text-[#618EFF] hover:underline"
              style={{ fontSize: 13 }}
            >
              목록으로
            </button>
            <InsightReportView
              data={selected.report}
              title={selected.title}
              source={selected.source}
              dateStr={new Date(selected.createdAt).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                weekday: "short",
              })}
              aiModel={selected.aiModel}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className="w-full text-left rounded-[10px] border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/8 transition-colors"
              >
                <div style={{ fontSize: 14, fontWeight: 600 }} className="text-white/95 truncate">
                  {item.title || item.url}
                </div>
                <div style={{ fontSize: 12 }} className="text-white/40 mt-1">
                  {item.source && `${item.source} · `}
                  {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
