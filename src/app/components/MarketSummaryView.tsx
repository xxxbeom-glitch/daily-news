import React, { useRef, useState, useEffect } from "react";
import { Maximize2, Pencil } from "lucide-react";
import type {
  MarketSummaryData,
  IndexData,
  IssueItem,
} from "../data/marketSummary";
import type { Article } from "../data/newsSources";

function FullscreenLayer({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 w-full h-full bg-[#0a0a0f] overflow-y-auto"
      role="dialog"
      aria-label="전체 펼쳐보기"
    >
      <div
        className="h-14 shrink-0 cursor-pointer"
        onClick={onClose}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onClose()}
        aria-label="닫기"
      />
      <div ref={contentRef} className="min-h-full py-0 px-4 pb-6">
        {children}
      </div>
    </div>
  );
}

function formatDisplayDate(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})\s*(?:\(?([일월화수목금토])[요일]*\)?)?/);
  if (match) {
    const [, y, m, d, w] = match;
    const weekShort = w ?? ["일", "월", "화", "수", "목", "금", "토"][new Date(parseInt(y!), parseInt(m!) - 1, parseInt(d!)).getDay()];
    return `${y}. ${m.padStart(2, "0")}. ${d.padStart(2, "0")} (${weekShort})`;
  }
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, y, m, d] = iso;
    const weekShort = ["일", "월", "화", "수", "목", "금", "토"][new Date(parseInt(y!), parseInt(m!) - 1, parseInt(d!)).getDay()];
    return `${y}. ${m}. ${d} (${weekShort})`;
  }
  return dateStr;
}

function BlockTitle({ emoji, children }: { emoji?: string; children: React.ReactNode }) {
  return (
    <div className="mt-[26px] pt-[26px] pb-0 first:mt-0 first:pt-0 first:pb-0 border-t-2 border-white/50 first:border-t-0">
      <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5 }} className="text-white">
        {emoji && <span className="mr-2">{emoji}</span>}
        {children}
      </span>
    </div>
  );
}

function UsedArticlesSection({ articles }: { articles?: Article[] }) {
  if (!Array.isArray(articles) || articles.length === 0) return null;
  const list = articles.filter((a) => a && typeof a.title === "string");
  if (list.length === 0) return null;

  const bySource = new Map<string, Article[]>();
  for (const a of list) {
    const src = a.source || "(출처 없음)";
    if (!bySource.has(src)) bySource.set(src, []);
    bySource.get(src)!.push(a);
  }

  return (
    <div
      style={{ fontSize: 11 }}
      className="text-gray-400 mt-[26px] pt-[26px] pb-6 border-t-2 border-white/50"
    >
      <div style={{ fontWeight: 600 }} className="text-gray-400 mb-3">
        사용된 기사 ({list.length})
      </div>
      <div className="space-y-4">
        {Array.from(bySource.entries()).map(([source, items]) => (
          <div key={source}>
            <div style={{ fontWeight: 600 }} className="text-gray-400 mb-1.5">
              {source}
            </div>
            <div className="space-y-1">
              {items.map((a, i) => (
                <a
                  key={a.id || i}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-gray-400 hover:text-white/80 hover:underline transition-colors"
                  title={a.title}
                >
                  {a.title}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketSummaryView({
  data: initialData,
  aiModel,
  articles,
  displayDate,
  onEdit,
  showEditButton,
}: {
  data: MarketSummaryData;
  aiModel: "gemini" | "gpt" | "claude";
  articles?: Article[];
  displayDate?: string;
  onEdit?: () => void;
  showEditButton?: boolean;
}) {
  const data = initialData;
  const isHeadlineMode = data.regionLabel.includes("한국경제") || data.regionLabel.includes("글로벌 마켓");
  const isInternational = data.regionLabel.includes("해외") || data.regionLabel.includes("글로벌");
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const dateToShow = displayDate ?? data.date;
  const header = (
      <div className="flex items-center justify-between px-[17px] pt-[20px] pb-[20px] border-b border-white/50">
      <div>
        <div style={{ fontSize: 11, lineHeight: 1.5 }} className="text-white/90">
          {formatDisplayDate(dateToShow)}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5 }}>
          {isHeadlineMode ? data.regionLabel : isInternational ? "해외 시황 요약" : "한국 시장 뉴스"}
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.5 }} className="text-white/40 mt-[6px]">
          Generated by {aiModel === "gemini" ? "Gemini AI" : "ChatGPT"}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {showEditButton && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="p-2 text-white/50 hover:text-white/80 hover:bg-white/5 rounded-lg transition-colors"
            title="수정하기"
          >
            <Pencil size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setFullscreenOpen((prev) => !prev)}
          className="p-2 text-white/50 hover:text-white/80 hover:bg-white/5 rounded-lg transition-colors"
          title={fullscreenOpen ? "원래대로" : "전체 펼쳐보기"}
        >
          <Maximize2 size={18} />
        </button>
      </div>
    </div>
  );

  /** keyIssues: 동일 제목 중복 제거 (제목별로 body 병합), section 유지 */
  const dedupeKeyIssues = (items: IssueItem[]): IssueItem[] => {
    const byKey = new Map<string, { bodies: string[]; section?: string }>();
    for (const item of items) {
      const t = (item.title ?? "").trim() || "(제목 없음)";
      if (!byKey.has(t)) byKey.set(t, { bodies: [], section: item.section });
      const entry = byKey.get(t)!;
      const body = (item.body ?? "").trim();
      if (body) entry.bodies.push(body);
    }
    return Array.from(byKey.entries()).map(([title, { bodies, section }]) => ({
      title,
      body: bodies.join("\n\n"),
      changeRate: undefined,
      section,
    }));
  };

  if (isHeadlineMode) {
    const stripBullet = (text: string) =>
      (text ?? "")
        .split("\n")
        .map((line) => line.replace(/^\s*[-・■]\s*/, "").trim())
        .filter(Boolean)
        .join("\n");
    const isGlobalMarket = data.regionLabel.includes("글로벌 마켓");
    const lineStyle = { lineHeight: 1.5 as const };
    const renderTable = (title: string, items: { name: string; value: string; change: string; isUp: boolean }[]) =>
      items.length > 0 ? (
        <div className="mt-[22px] first:mt-0">
          <div style={{ fontSize: 14, fontWeight: 700 }} className="text-white/90 mb-2">
            {title}
          </div>
          <div className="space-y-1">
            {items.map((idx, i) => (
              <div key={i} className="flex items-baseline gap-[6px]" style={lineStyle}>
                <span style={{ fontSize: 13 }} className="text-white/80 text-left">{idx.name}</span>
                <span style={{ fontSize: 13 }} className={`text-left ${idx.isUp ? "text-emerald-400" : "text-red-400"}`}>
                  {idx.value} {idx.change}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null;
    const bulletSize = 3;
    const bulletStyle = {
      width: bulletSize,
      height: bulletSize,
      borderRadius: "50%",
      flexShrink: 0,
      marginTop: 10,
    } as const;
    const bodyParagraphs = (text: string) => {
      const cleaned = stripBullet(text);
      const byDouble = cleaned.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
      if (byDouble.length > 1) return byDouble;
      return cleaned.split("\n").map((p) => p.trim()).filter(Boolean);
    };
    const items = dedupeKeyIssues(data.keyIssues);
    const headlineContent = (
      <>
        {header}
        <div className="px-5 pt-6 pb-6">
          {isGlobalMarket && (
            <div className="hidden">
              {renderTable("시장지표", data.indices ?? [])}
              {renderTable("주요 섹터ETF", data.sectorEtf ?? [])}
            </div>
          )}
          <div className={isGlobalMarket ? "mt-6" : "mt-0"}>
            {items.map((item, i) => (
              <div
                key={i}
                className={i > 0 ? "pt-[26px] mt-[26px] border-t border-dashed border-white/20" : "mt-6"}
              >
                    <div style={{ fontSize: 16, lineHeight: 1.5 }} className="text-white font-semibold">
                      {(item.title ?? "").replace(/^\s*■\s*/, "")}
                    </div>
                    <div className="mt-[10px] space-y-[10px]">
                      {bodyParagraphs(item.body ?? "").map((para, j) => (
                        <div key={j} className="flex gap-2 items-start">
                          <span style={bulletStyle} className="bg-white/50 block shrink-0" />
                          <div style={{ fontSize: 14, lineHeight: 1.6, fontWeight: 500 }} className="text-white/80 whitespace-pre-line flex-1 font-medium">
                            {para}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </>
    );
    return (
      <>
        {fullscreenOpen && (
          <FullscreenLayer
            onClose={() => setFullscreenOpen(false)}
            children={headlineContent}
          />
        )}
        <div ref={containerRef} className="flex-1 min-h-0 flex flex-col overflow-hidden mt-0 mb-6 mx-0 bg-white/5 border border-white/8 rounded-[10px]">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            {headlineContent}
          </div>
        </div>
      </>
    );
  }

  const lineStyle = { lineHeight: 1.5 as const };
  const totalAssessmentLabel = isInternational ? "📝 오늘의 시황 총평" : "📝 총평";

  const FullscreenOverlay = ({ children }: { children: React.ReactNode }) =>
    fullscreenOpen ? (
      <FullscreenLayer onClose={() => setFullscreenOpen(false)}>
        {children}
      </FullscreenLayer>
    ) : null;

  if (isInternational) {
    const intlContent = (
      <>
        {header}
        <div className="px-5 py-0 pb-6">

          {/* 총평 */}
          <div className="mt-[26px] pt-[26px] pb-0 first:mt-0 first:pt-0 first:pb-0 border-t-2 border-white/50 first:border-t-0">
            <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5 }} className="text-white">{totalAssessmentLabel}</span>
            <div style={{ fontSize: 14, lineHeight: 1.6 }} className="text-white/80 mt-[14px] min-h-[20px]">
              {data.totalAssessment ? data.totalAssessment : data.totalAssessmentError ? "Error" : ""}
            </div>
          </div>

          {/* 대표 지수 */}
          <BlockTitle emoji="📊">대표 지수</BlockTitle>
          <div className="flex flex-col gap-y-[4px] mt-[14px]" style={lineStyle}>
            {data.indices.map((idx: IndexData, i: number) => (
              <div key={i} className="flex items-baseline gap-2">
                <span style={{ fontSize: 14 }} className="text-white">{idx.name}</span>
                <span style={{ fontSize: 14 }} className={idx.isUp ? "text-emerald-400" : "text-red-400"}>
                  {idx.value} {idx.change}
                </span>
                {idx.changeAbs && (
                  <span style={{ fontSize: 14 }} className={idx.isUp ? "text-emerald-400/80" : "text-red-400/80"}>
                    {idx.changeAbs}
                  </span>
                )}
              </div>
            ))}
          </div>
          {data.indicesSources.length > 0 && (
            <div style={{ fontSize: 13, ...lineStyle }} className="text-white/40 mt-[16px] mb-[22px]">
              출처: {data.indicesSources.map((s) => s.outlet).join(", ")}
            </div>
          )}

          {/* 실시간 뉴스 (RSS 1:1 직결) */}
          <BlockTitle emoji="📰">실시간 뉴스</BlockTitle>
          {data.headlineArticles && data.headlineArticles.length > 0 ? (
            <div className="mt-[14px] space-y-[18px]">
              {data.headlineArticles.map((item, i) => (
                <div key={i} className="border-l-2 border-[#618EFF]/30 pl-3">
                  <div className="flex items-center gap-2 mb-[5px]">
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }} className="text-[#618EFF]/90">
                      {item.sourceName}
                    </span>
                    <span style={{ fontSize: 10 }} className="text-white/20">RSS</span>
                  </div>
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 14, fontWeight: 500, ...lineStyle }}
                      className="text-white/95 hover:text-white hover:underline transition-colors block"
                    >
                      {item.title}
                    </a>
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 500, ...lineStyle }} className="text-white/95">
                      {item.title}
                    </div>
                  )}
                  {item.summary && item.summary !== "(본문 미수집)" && (
                    <div style={{ fontSize: 13, ...lineStyle }} className="text-white/50 mt-[6px]">
                      {item.summary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-[14px] px-4 py-3 rounded-[8px] bg-white/5 border border-white/8">
              {(data.noHeadlineArticlesMessage ?? "수집된 RSS 기사가 없습니다.").split("\n").map((line, i) => (
                <div key={i} style={{ fontSize: i === 0 ? 14 : 12, ...lineStyle }} className={i === 0 ? "text-white/50" : "text-white/30 mt-1"}>
                  {line}
                </div>
              ))}
            </div>
          )}

          {/* M7·반도체주 등락 */}
          {(data.moversUp.length > 0 || data.moversDown.length > 0) && (
            <>
              <BlockTitle emoji="📈">{data.stockMoversLabel}</BlockTitle>
              <div className="mt-[14px] space-y-[9px]">
                {data.moversUp.map((m, i) => (
                  <div key={i}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span style={{ fontSize: 14, fontWeight: 500, ...lineStyle }} className="text-white/90">{m.name}</span>
                      <span style={{ fontSize: 14 }} className="text-white/40">({m.ticker})</span>
                      <span style={{ fontSize: 14 }} className={m.isUp ? "text-emerald-400" : "text-red-400"}>{m.changeRate}</span>
                    </div>
                    <div style={{ fontSize: 14, ...lineStyle }} className="text-white/55 mt-[2px]">{m.reason}</div>
                  </div>
                ))}
                {data.moversDown.map((m, i) => (
                  <div key={i} className={i === 0 ? "mt-[18px]" : ""}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span style={{ fontSize: 14, fontWeight: 500, ...lineStyle }} className="text-white/90">{m.name}</span>
                      <span style={{ fontSize: 14 }} className="text-white/40">({m.ticker})</span>
                      <span style={{ fontSize: 14 }} className={m.isUp ? "text-emerald-400" : "text-red-400"}>{m.changeRate}</span>
                    </div>
                    <div style={{ fontSize: 14, ...lineStyle }} className="text-white/55 mt-[2px]">{m.reason}</div>
                  </div>
                ))}
              </div>
              {data.moversSources.length > 0 && (
                <div style={{ fontSize: 13, ...lineStyle }} className="text-white/40 mt-[16px] mb-[22px]">
                  출처: {data.moversSources.map((s) => s.outlet).join(", ")}
                </div>
              )}
            </>
          )}

          {/* 국제 정세 기사 */}
          {data.geopoliticalLabel && data.geopoliticalIssues && data.geopoliticalIssues.length > 0 && (
            <>
              <BlockTitle emoji="🌍">국제 정세 기사</BlockTitle>
              <div className="mt-[14px] space-y-[9px]">
                {data.geopoliticalIssues.slice(0, 7).map((item: IssueItem, i: number) => (
                  <div key={i}>
                    <div style={{ fontSize: 14, fontWeight: 500, ...lineStyle }} className="text-white/90">{item.title}</div>
                    <div style={{ fontSize: 14, ...lineStyle }} className="text-white/58 mt-[2px]">{item.body}</div>
                  </div>
                ))}
              </div>
              {data.geopoliticalSources && data.geopoliticalSources.length > 0 && (
                <div style={{ fontSize: 13, ...lineStyle }} className="text-white/40 mt-[16px] mb-[22px]">
                  출처: {data.geopoliticalSources.map((s) => s.outlet).join(", ")}
                </div>
              )}
            </>
          )}

          {/* 해외 뷰: 헤드라인 섹션이 RSS 기사를 이미 표시하므로 "사용된 기사" 섹션 제거 */}
        </div>
      </>
    );
    return (
      <>
        <FullscreenOverlay>{intlContent}</FullscreenOverlay>
        <div ref={containerRef} className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white/5 border border-white/8 rounded-[10px] mt-0 mb-6 mx-0">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            {intlContent}
          </div>
        </div>
      </>
    );
  }

  // 국내 뉴스
  const domesticContent = (
    <>
      {header}
      <div className="px-5 py-0 pb-6">
        <div className="mt-[26px] pt-[26px] pb-0 first:mt-0 first:pt-0 first:pb-0 border-t-2 border-white/50 first:border-t-0">
          <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5 }} className="text-white">{totalAssessmentLabel}</span>
          <div style={{ fontSize: 14, lineHeight: 1.6 }} className="text-white/80 mt-[14px] min-h-[20px]">
            {data.totalAssessment ? data.totalAssessment : data.totalAssessmentError ? "Error" : ""}
          </div>
        </div>
        <BlockTitle emoji="📊">대표 지수</BlockTitle>
        <div className="flex flex-col gap-y-[4px] mt-[14px]" style={lineStyle}>
          {data.indices.map((idx: IndexData, i: number) => (
            <div key={i} className="flex items-baseline gap-2">
              <span style={{ fontSize: 14 }} className="text-white">{idx.name}</span>
              <span style={{ fontSize: 14 }} className={idx.isUp ? "text-emerald-400" : "text-red-400"}>
                {idx.value} {idx.change}
              </span>
              {idx.changeAbs && (
                <span style={{ fontSize: 14 }} className={idx.isUp ? "text-emerald-400/80" : "text-red-400/80"}>
                  {idx.changeAbs}
                </span>
              )}
            </div>
          ))}
        </div>
        {data.indicesSources.length > 0 && (
          <div style={{ fontSize: 13, ...lineStyle }} className="text-white/40 mt-[16px] mb-[22px]">
            출처: {data.indicesSources.map((s) => s.outlet).join(", ")}
          </div>
        )}

        {/* 실시간 뉴스 (RSS 1:1 직결) */}
        <BlockTitle emoji="📰">실시간 뉴스</BlockTitle>
        {data.headlineArticles && data.headlineArticles.length > 0 ? (
          <div className="mt-[14px] space-y-[18px]">
            {data.headlineArticles.map((item, i) => (
              <div key={i} className="border-l-2 border-[#618EFF]/30 pl-3">
                <div className="flex items-center gap-2 mb-[5px]">
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }} className="text-[#618EFF]/90">
                    {item.sourceName}
                  </span>
                  <span style={{ fontSize: 10 }} className="text-white/20">RSS</span>
                </div>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 500, ...lineStyle }} className="text-white/95 hover:text-white hover:underline transition-colors block">
                    {item.title}
                  </a>
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 500, ...lineStyle }} className="text-white/95">{item.title}</div>
                )}
                {item.summary && item.summary !== "(본문 미수집)" && (
                  <div style={{ fontSize: 13, ...lineStyle }} className="text-white/50 mt-[6px]">{item.summary}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-[14px] px-4 py-3 rounded-[8px] bg-white/5 border border-white/8">
            {(data.noHeadlineArticlesMessage ?? "수집된 RSS 기사가 없습니다.").split("\n").map((line, i) => (
              <div key={i} style={{ fontSize: i === 0 ? 14 : 12, ...lineStyle }} className={i === 0 ? "text-white/50" : "text-white/30 mt-1"}>{line}</div>
            ))}
          </div>
        )}

        {/* 실적발표 이슈 - hidden */}
        <UsedArticlesSection articles={articles} />
      </div>
    </>
  );
  return (
    <>
      <FullscreenOverlay>{domesticContent}</FullscreenOverlay>
      <div ref={containerRef} className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white/5 border border-white/8 rounded-[10px] mt-0 mb-6 mx-0">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {domesticContent}
        </div>
      </div>
    </>
  );
}
