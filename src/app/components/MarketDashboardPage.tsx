import { useState, useEffect, useRef, useCallback } from "react";
import { createChart, CandlestickSeries } from "lightweight-charts";
import {
  fetchDashboardData,
  fetchChartData,
  CAROUSEL_GROUPS,
  type DashboardItem,
  type ChartDataPoint,
} from "../utils/fetchMarketData";
import { loadDashboardCache, saveDashboardCache, shouldRefreshDashboard, loadChartCache, saveChartCache, getDashboardFetchedAt } from "../utils/marketDashboardCache";

function formatUpdated(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}. ${m}. ${day} ${h}:${min}`;
}

function CandlestickChart({ data, height = 40 }: { data: ChartDataPoint[]; height?: number }) {
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
      height,
      layout: {
        background: { color: "transparent" },
        textColor: "#94a3b8",
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: { visible: false, borderVisible: false },
      timeScale: { visible: false, borderVisible: false, rightOffset: 0 },
      handleScroll: false,
      handleScale: false,
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      lastValueVisible: false,
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
      const barCount = 12;
      const from = Math.max(0, candleData.length - barCount);
      const to = candleData.length - 1;
      chart.timeScale().setVisibleLogicalRange({ from, to });
    }
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [data, height]);

  return <div ref={containerRef} className="w-full shrink-0" style={{ height }} />;
}

const CARD_HEIGHT = 64;
const CHART_HEIGHT = 56;

function DashboardCard({ item }: { item: DashboardItem }) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>(() => loadChartCache(item.symbol) ?? []);

  useEffect(() => {
    const cached = loadChartCache(item.symbol);
    if (cached?.length) {
      setChartData(cached);
      return;
    }
    let cancelled = false;
    fetchChartData(item.symbol).then((data) => {
      if (!cancelled) {
        setChartData(data);
        if (data.length > 0) saveChartCache(item.symbol, data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [item.symbol]);

  return (
    <div
      className="flex items-center gap-4 w-full rounded-[8px] border border-white/10 bg-white/5 px-3 pointer-events-none overflow-hidden"
      style={{ height: CARD_HEIGHT }}
    >
      <div className="flex flex-col justify-center min-w-0 shrink-0" style={{ width: "45%" }}>
        <div style={{ fontSize: 13, fontWeight: 600 }} className="text-white truncate">
          {item.name}
        </div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span style={{ fontSize: 14, fontWeight: 500 }} className="text-white/90">
            {item.value}
          </span>
          <span
            style={{ fontSize: 12 }}
            className={item.isUp ? "text-emerald-400" : "text-red-400"}
          >
            {item.change}
          </span>
        </div>
      </div>
      <div className="flex-1 min-w-0 h-full flex items-center" style={{ width: "55%" }}>
        {chartData.length > 0 ? (
          <CandlestickChart data={chartData} height={CHART_HEIGHT} />
        ) : (
          <div className="w-full flex items-center justify-center text-white/25 text-xs" style={{ height: CHART_HEIGHT }}>
            …
          </div>
        )}
      </div>
    </div>
  );
}

export function MarketDashboardPage() {
  const [items, setItems] = useState<DashboardItem[]>(() => {
    const cached = loadDashboardCache();
    return cached?.data ?? [];
  });
  const [lastUpdated, setLastUpdated] = useState<number | null>(() => getDashboardFetchedAt());
  const [loading, setLoading] = useState(() => shouldRefreshDashboard() && items.length === 0);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchDashboardData();
      setItems(data);
      setError(null);
      saveDashboardCache(data);
      setLastUpdated(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = loadDashboardCache();
    if (cached?.data?.length) {
      setItems(cached.data);
      setLastUpdated(cached.fetchedAt);
      setLoading(false);
      if (shouldRefreshDashboard()) {
        loadData();
      }
    } else {
      loadData();
    }
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (shouldRefreshDashboard()) loadData();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  const itemMap = new Map(items.map((i) => [i.symbol, i]));

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col min-h-full px-4 pt-5 pb-6">
        <p className="text-white/50">데이터 로딩 중…</p>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="flex flex-col min-h-full px-4 pt-5 pb-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full px-4 pt-5 pb-16">
      <div className="flex items-center justify-between gap-2 mb-4 shrink-0">
        <div className="min-w-0">
          {lastUpdated != null && (
            <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.5 }} className="text-white truncate">
              Updated: {formatUpdated(lastUpdated)}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.5 }} className="text-white shrink-0">
          출처: Yahoo Finance
        </span>
      </div>
      <div className="flex flex-col w-full overflow-y-auto" style={{ gap: 16 }}>
        {CAROUSEL_GROUPS.map((symbols, gIdx) => {
          const groupItems = symbols
            .map((s) => itemMap.get(s))
            .filter((i): i is DashboardItem => i != null);
          if (groupItems.length === 0) return null;
          return (
            <div key={gIdx} className="flex flex-col w-full" style={{ gap: 12 }}>
              {groupItems.map((item) => (
                <div key={item.symbol} className="w-full">
                  <DashboardCard item={item} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {items.length === 0 && (
        <p className="text-white/50 text-sm mt-4">표시할 데이터가 없습니다.</p>
      )}
    </div>
  );
}
