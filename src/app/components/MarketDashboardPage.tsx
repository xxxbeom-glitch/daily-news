import { useState, useEffect, useRef } from "react";
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
import { createChart, CandlestickSeries } from "lightweight-charts";
import {
  fetchDashboardData,
  fetchVooChartData,
  type DashboardItem,
  type ChartRange,
  type ChartDataPoint,
} from "../utils/fetchMarketData";

const RANGE_BUTTONS: { key: ChartRange; label: string }[] = [
  { key: "1d", label: "일" },
  { key: "5d", label: "주" },
  { key: "1mo", label: "월" },
  { key: "5m", label: "5분" },
  { key: "15m", label: "15분" },
  { key: "1h", label: "1시간" },
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

function CandlestickChart({ data }: { data: ChartDataPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 80,
      layout: {
        background: { color: "transparent" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#f87171",
      borderUpColor: "#34d399",
      borderDownColor: "#f87171",
    });
    const candleData = data
      .filter((d) => d.open != null && d.high != null && d.low != null && d.close != null && d.timestamp != null)
      .map((d) => ({
        time: d.timestamp! as any,
        open: d.open!,
        high: d.high!,
        low: d.low!,
        close: d.close!,
      }));
    if (candleData.length > 0) {
      candleSeries.setData(candleData);
    }
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  return <div ref={containerRef} className="w-full" style={{ height: 80 }} />;
}

function toRechartsData(data: ChartDataPoint[]) {
  return data.map((d, i) => ({
    day: `D-${data.length - 1 - i}`,
    value: d.value,
  }));
}

export function MarketDashboardPage() {
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>("1d");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    fetchVooChartData(chartRange)
      .then((data) => {
        if (!cancelled) setChartData(data);
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chartRange]);

  const rechartsData = toRechartsData(chartData);

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
        <div style={{ fontSize: 14, fontWeight: 700 }} className="text-white/90 mb-2">
          그래프 타입 예시 (VOO)
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {RANGE_BUTTONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setChartRange(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                chartRange === key
                  ? "bg-[#618EFF] text-white"
                  : "bg-white/10 text-white/60 hover:bg-white/15"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {chartLoading && rechartsData.length === 0 ? (
          <p className="text-white/50 text-sm py-4">차트 로딩 중…</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-[10px] border border-white/10 bg-white/5 p-3">
              <div style={{ fontSize: 11 }} className="text-white/50 mb-2">
                Line (라인)
              </div>
              <div style={{ height: 80 }}>
                {rechartsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rechartsData}>
                      <XAxis dataKey="day" hide />
                      <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                      <Line type="monotone" dataKey="value" stroke="#618EFF" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-white/30 text-xs">데이터 없음</div>
                )}
              </div>
            </div>
            <div className="rounded-[10px] border border-white/10 bg-white/5 p-3">
              <div style={{ fontSize: 11 }} className="text-white/50 mb-2">
                Area (영역)
              </div>
              <div style={{ height: 80 }}>
                {rechartsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={rechartsData}>
                      <XAxis dataKey="day" hide />
                      <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                      <Area type="monotone" dataKey="value" stroke="#34d399" fill="#34d399" fillOpacity={0.3} strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-white/30 text-xs">데이터 없음</div>
                )}
              </div>
            </div>
            <div className="rounded-[10px] border border-white/10 bg-white/5 p-3">
              <div style={{ fontSize: 11 }} className="text-white/50 mb-2">
                Bar (막대)
              </div>
              <div style={{ height: 80 }}>
                {rechartsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rechartsData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                      <XAxis dataKey="day" hide />
                      <YAxis hide domain={[0, "dataMax + 10"]} />
                      <Bar dataKey="value" fill="#618EFF" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-white/30 text-xs">데이터 없음</div>
                )}
              </div>
            </div>
            <div className="rounded-[10px] border border-white/10 bg-white/5 p-3">
              <div style={{ fontSize: 11 }} className="text-white/50 mb-2">
                Line + Area
              </div>
              <div style={{ height: 80 }}>
                {rechartsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={rechartsData}>
                      <XAxis dataKey="day" hide />
                      <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                      <Area type="monotone" dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.2} strokeWidth={2} />
                      <Line type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-white/30 text-xs">데이터 없음</div>
                )}
              </div>
            </div>
            <div className="rounded-[10px] border border-white/10 bg-white/5 p-3 col-span-2">
              <div style={{ fontSize: 11 }} className="text-white/50 mb-2">
                Candlestick (캔들)
              </div>
              <div style={{ height: 80 }}>
                {chartData.length > 0 ? (
                  <CandlestickChart data={chartData} />
                ) : (
                  <div className="h-full flex items-center justify-center text-white/30 text-xs">데이터 없음</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
