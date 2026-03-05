import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { fetchDashboardData, type DashboardItem } from "../utils/fetchMarketData";

const SAMPLE_DATA = [
  { day: "D-4", value: 100 },
  { day: "D-3", value: 102 },
  { day: "D-2", value: 98 },
  { day: "D-1", value: 105 },
  { day: "D", value: 103 },
];

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

      <div className="mt-8 pt-6 border-t border-dashed border-white/10">
        <div style={{ fontSize: 14, fontWeight: 700 }} className="text-white/90 mb-4">
          그래프 타입 예시
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-[10px] border border-white/10 bg-white/5 p-3">
            <div style={{ fontSize: 11 }} className="text-white/50 mb-2">
              Line (라인)
            </div>
            <div style={{ height: 80 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={SAMPLE_DATA}>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                  <Line type="monotone" dataKey="value" stroke="#618EFF" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-[10px] border border-white/10 bg-white/5 p-3">
            <div style={{ fontSize: 11 }} className="text-white/50 mb-2">
              Area (영역)
            </div>
            <div style={{ height: 80 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={SAMPLE_DATA}>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                  <Area type="monotone" dataKey="value" stroke="#34d399" fill="#34d399" fillOpacity={0.3} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-[10px] border border-white/10 bg-white/5 p-3">
            <div style={{ fontSize: 11 }} className="text-white/50 mb-2">
              Bar (막대)
            </div>
            <div style={{ height: 80 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SAMPLE_DATA} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={[0, "dataMax + 10"]} />
                  <Bar dataKey="value" fill="#618EFF" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-[10px] border border-white/10 bg-white/5 p-3">
            <div style={{ fontSize: 11 }} className="text-white/50 mb-2">
              Line + Area
            </div>
            <div style={{ height: 80 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={SAMPLE_DATA}>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                  <Area type="monotone" dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.2} strokeWidth={2} />
                  <Line type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
