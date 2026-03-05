import { useState, useEffect } from "react";
import { fetchDashboardData, DASHBOARD_SYMBOLS, type DashboardItem } from "../utils/fetchMarketData";

const SECTION_LABELS: Record<keyof typeof DASHBOARD_SYMBOLS, string> = {
  usIndices: "미국 지수",
  commodities: "원자재",
  krIndices: "한국 지수",
  fx: "환율",
  etfs: "ETF",
  usStocks: "미국 종목",
  krStocks: "한국 종목",
};

function DashboardSection({ title, items }: { title: string; items: DashboardItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6">
      <div style={{ fontSize: 14, fontWeight: 700 }} className="text-white/90 mb-2">
        {title}
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-baseline gap-[6px]">
            <span style={{ fontSize: 13 }} className="text-white/80 text-left">
              {item.name}
            </span>
            <span
              style={{ fontSize: 13 }}
              className={`text-left ${item.isUp ? "text-emerald-400" : "text-red-400"}`}
            >
              {item.value} {item.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketDashboardPage() {
  const [data, setData] = useState<Record<keyof typeof DASHBOARD_SYMBOLS, DashboardItem[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "데이터 로드 실패"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col min-h-full px-4 pt-5 pb-6">
        <h1 className="text-white font-semibold mb-4" style={{ fontSize: 16 }}>
          오늘의 시장
        </h1>
        <p className="text-white/50">데이터 로딩 중…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-full px-4 pt-5 pb-6">
        <h1 className="text-white font-semibold mb-4" style={{ fontSize: 16 }}>
          오늘의 시장
        </h1>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const sections = Object.keys(DASHBOARD_SYMBOLS) as (keyof typeof DASHBOARD_SYMBOLS)[];

  return (
    <div className="flex flex-col min-h-full px-4 pt-5 pb-6">
      <h1 className="text-white font-semibold mb-4" style={{ fontSize: 16 }}>
        오늘의 시장
      </h1>
      <div>
        {sections.map((key) => (
          <DashboardSection
            key={key}
            title={SECTION_LABELS[key]}
            items={data[key] ?? []}
          />
        ))}
      </div>
    </div>
  );
}
