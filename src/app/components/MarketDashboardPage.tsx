import { useState, useEffect, useRef } from "react";
import { createChart, CandlestickSeries } from "lightweight-charts";
import {
  fetchDashboardData,
  fetchChartData,
  type DashboardItem,
  type ChartDataPoint,
} from "../utils/fetchMarketData";

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
      height: 70,
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

  return <div ref={containerRef} className="w-full" style={{ height: 70 }} />;
}

function DashboardCard({ item }: { item: DashboardItem }) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchChartData(item.symbol).then((data) => {
      if (!cancelled) setChartData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [item.symbol]);

  return (
    <div className="rounded-[10px] border border-white/10 bg-white/5 px-4 py-3">
      <div style={{ fontSize: 12 }} className="text-white/60 mb-1">
        {item.name}
      </div>
      <div className="flex items-baseline gap-[6px] mb-2">
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
      <div className="min-h-[70px]">
        {chartData.length > 0 ? (
          <CandlestickChart data={chartData} />
        ) : (
          <div className="h-[70px] flex items-center justify-center text-white/30 text-xs">로딩 중…</div>
        )}
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
          <DashboardCard key={`${item.symbol}-${item.name}-${i}`} item={item} />
        ))}
      </div>
      {items.length === 0 && (
        <p className="text-white/50 text-sm mt-4">표시할 데이터가 없습니다.</p>
      )}
    </div>
  );
}
