import { useState, useEffect } from "react";
import { fetchDashboardData, type DashboardItem } from "../utils/fetchMarketData";

function DashboardCard({ item }: { item: DashboardItem }) {
  return (
    <div className="rounded-[10px] border border-white/10 bg-white/5 px-4 py-3">
      <div style={{ fontSize: 12 }} className="text-white/60 mb-1">
        {item.name}
      </div>
      <div className="flex items-baseline gap-[6px]">
        <span style={{ fontSize: 15, fontWeight: 600 }} className="text-white">
          {item.value}
        </span>
        <span
          style={{ fontSize: 13 }}
          className={item.isUp ? "text-emerald-400" : "text-red-400"}
        >
          {item.change}
        </span>
      </div>
    </div>
  );
}

export function MarketDashboardPage() {
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardData()
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "데이터 로드 실패");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col min-h-full px-4 pt-5 pb-6">
        <h1 className="text-white font-semibold mb-4" style={{ fontSize: 16 }}>
          오늘의 시장
        </h1>
        <p className="text-white/50">데이터 로딩 중…</p>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="flex flex-col min-h-full px-4 pt-5 pb-6">
        <h1 className="text-white font-semibold mb-4" style={{ fontSize: 16 }}>
          오늘의 시장
        </h1>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full px-4 pt-5 pb-6">
      <h1 className="text-white font-semibold mb-4" style={{ fontSize: 16 }}>
        오늘의 시장
      </h1>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item, i) => (
          <DashboardCard key={`${item.name}-${i}`} item={item} />
        ))}
      </div>
      {items.length === 0 && (
        <p className="text-white/50 text-sm mt-4">표시할 데이터가 없습니다.</p>
      )}
    </div>
  );
}
