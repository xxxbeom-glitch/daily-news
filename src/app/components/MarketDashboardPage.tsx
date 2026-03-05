import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { createChart, CandlestickSeries } from "lightweight-charts";
import {
  fetchDashboardData,
  fetchChartData,
  CAROUSEL_GROUPS,
  CAROUSEL_TITLES,
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
  }, [data]);

  return <div ref={containerRef} className="w-full" style={{ height: 80 }} />;
}

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
    <div className="rounded-[10px] border border-white/10 bg-white/5 px-4 py-3 w-full">
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
      <div className="min-h-[80px] mt-[26px] pointer-events-none">
        {chartData.length > 0 ? (
          <CandlestickChart data={chartData} />
        ) : (
          <div className="h-[80px] flex items-center justify-center text-white/30 text-xs">로딩 중…</div>
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
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
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
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const cached = loadDashboardCache();
    if (cached?.data?.length) {
      setItems(cached.data);
      setLastUpdated(cached.fetchedAt);
      setLoading(false);
      if (shouldRefreshDashboard()) {
        loadData(false);
      }
    } else {
      loadData(false);
    }
  }, [loadData]);

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    loadData(true);
  };

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
      <div className="flex flex-col" style={{ gap: 26 }}>
        {CAROUSEL_GROUPS.map((symbols, gIdx) => {
          const groupItems = symbols
            .map((s) => itemMap.get(s))
            .filter((i): i is DashboardItem => i != null);
          if (groupItems.length === 0) return null;
          const title = CAROUSEL_TITLES[gIdx] ?? "";
          return (
            <div key={gIdx} className="flex flex-col min-w-0">
              <div className="text-white font-semibold mb-2" style={{ fontSize: 16 }}>
                {title}
              </div>
              <div
                className={`flex items-start gap-3 overflow-x-auto scrollbar-hide scroll-smooth -mx-4 ${groupItems.length >= 3 ? "pl-0 pr-4" : "px-4"}`}
                style={{ scrollSnapType: "x proximity" }}
              >
                {groupItems.map((item) => (
                  <div
                    key={item.symbol}
                    className="flex-shrink-0 flex"
                    style={{ scrollSnapAlign: "start", width: "calc(50vw - 42px)", minWidth: "calc(50vw - 42px)" }}
                  >
                    <DashboardCard item={item} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {items.length === 0 && (
        <p className="text-white/50 text-sm mt-4">표시할 데이터가 없습니다.</p>
      )}
      <div className="mt-6 mb-8 space-y-1">
        <p style={{ fontSize: 11, fontWeight: 400, opacity: 0.5 }} className="text-white">
          출처: Yahoo Finance
        </p>
        <div className="flex items-center gap-2">
          {lastUpdated != null && (
            <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.5 }} className="text-white">
              Updated: {formatUpdated(lastUpdated)}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            title="새로고침"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
}
