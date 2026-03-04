import React from "react";
import type {
  MarketSummaryData,
  IndexData,
  IssueItem,
  EarningsItem,
} from "../data/marketSummary";

function BlockTitle({ emoji, children }: { emoji?: string; children: React.ReactNode }) {
  return (
    <div className="pt-[22px] pb-0 first:pt-[22px] first:pb-0 border-t border-dashed border-white/10 first:border-t-0">
      <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.4 }} className="text-white">
        {emoji && <span className="mr-2">{emoji}</span>}
        {children}
      </span>
    </div>
  );
}

export function MarketSummaryView({
  data,
  aiModel,
}: {
  data: MarketSummaryData;
  aiModel: "gemini" | "gpt";
}) {
  const isInternational = data.regionLabel.includes("해외");

  const header = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-dashed border-white/10">
      <div>
        <div style={{ fontSize: 14, lineHeight: 1.4 }}>
          {data.date}
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>{data.regionLabel}</div>
      </div>
      <span
        className={`rounded-[10px] border px-2 py-0.5 ${
          aiModel === "gemini"
            ? "bg-[#618EFF]/20 border-[#618EFF]/30 text-[#618EFF]"
            : "bg-[#2C3D6B]/50 border-[#2C3D6B]/60 text-[#8BABFF]"
        }`}
        style={{ fontSize: 14, lineHeight: 1.4 }}
      >
        {aiModel === "gemini" ? "Gemini" : "ChatGPT"}
      </span>
    </div>
  );

  const lineStyle = { lineHeight: 1.4 as const };

  if (isInternational) {
    return (
      <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
        {header}
        <div className="px-5 py-0 pb-6">
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

          <BlockTitle emoji="📋">주요 이슈 정리</BlockTitle>
          <div className="mt-[14px] space-y-[9px]">
            {data.keyIssues.slice(0, isInternational ? 10 : 12).map((item: IssueItem, i: number) => (
              <div key={i}>
                <div style={{ fontSize: 14, fontWeight: 500, ...lineStyle }} className="text-white/95">
                  {item.title}
                </div>
                <div style={{ fontSize: 14, ...lineStyle }} className="text-white/60 mt-[2px]">
                  {item.body}
                </div>
              </div>
            ))}
          </div>
          {data.keyIssuesSources.length > 0 && (
            <div style={{ fontSize: 13, ...lineStyle }} className="text-white/40 mt-[16px] mb-[22px]">
              출처: {data.keyIssuesSources.map((s) => s.outlet).join(", ")}
            </div>
          )}

          <BlockTitle emoji="📈">{data.stockMoversLabel}</BlockTitle>
          <div className="mt-[14px] space-y-[9px]">
            <div style={{ fontSize: 14, fontWeight: 600, ...lineStyle }} className="text-white">상승</div>
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
            <div style={{ fontSize: 14, fontWeight: 600, ...lineStyle }} className="text-white mt-[18px]">하락</div>
            {data.moversDown.map((m, i) => (
              <div key={i}>
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

          {data.geopoliticalLabel && data.geopoliticalIssues && data.geopoliticalIssues.length > 0 && (
            <>
              <BlockTitle emoji="🌍">{data.geopoliticalLabel}</BlockTitle>
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

          {/* 해외 시황: 실적발표 영역 항상 표시 */}
          <>
            <BlockTitle emoji="💰">실적발표 이슈</BlockTitle>
            <div className="mt-[14px]">
              {data.earningsPast && data.earningsPast.length > 0 ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, ...lineStyle }} className="text-white">간밤 실적 결과</div>
                  <div className="space-y-[9px] mt-[9px]">
                    {data.earningsPast.map((e: EarningsItem, i: number) => (
                      <div key={i}>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span style={{ fontSize: 14, fontWeight: 500, ...lineStyle }} className="text-white/90">{e.company}</span>
                          <span style={{ fontSize: 14 }} className="text-white/40">({e.ticker})</span>
                          {e.changeRate && (
                            <span style={{ fontSize: 14 }} className={e.changeRate.startsWith("+") ? "text-emerald-400" : "text-red-400"}>
                              {e.changeRate}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 14, ...lineStyle }} className="text-white/55 mt-[2px]">{e.result}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 14 }} className="text-white/50">뉴스에서 실적 발표 결과를 찾지 못했습니다.</div>
              )}
              {data.earningsUpcoming && data.earningsUpcoming.length > 0 ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, ...lineStyle }} className="text-white mt-[18px]">예정 발표 일정</div>
                  <div className="space-y-[4px] mt-[9px]" style={lineStyle}>
                    {data.earningsUpcoming.map((s, i) => (
                      <div key={i} style={{ fontSize: 14 }} className="text-white/55">• {s}</div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 14 }} className="text-white/50 mt-[12px]">예정된 실적발표가 없습니다.</div>
              )}
            </div>
            {data.earningsSources && data.earningsSources.length > 0 && (
              <div style={{ fontSize: 13, ...lineStyle }} className="text-white/40 mt-[16px] mb-[22px]">
                출처: {data.earningsSources.map((s) => s.outlet).join(", ")}
              </div>
            )}
          </>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/8 rounded-[10px] overflow-hidden">
      {header}
      <div className="px-5 py-0">
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

        <BlockTitle emoji="📋">주요 이슈 정리</BlockTitle>
        <div className="mt-[14px] space-y-[9px]">
          {data.keyIssues.slice(0, isInternational ? 10 : 12).map((item: IssueItem, i: number) => (
            <div key={i}>
              <div style={{ fontSize: 14, fontWeight: 500, ...lineStyle }} className="text-white/95">
                {item.title}
              </div>
              <div style={{ fontSize: 14, ...lineStyle }} className="text-white/60 mt-[2px]">
                {item.body}
              </div>
            </div>
          ))}
        </div>
        {data.keyIssuesSources.length > 0 && (
          <div style={{ fontSize: 13, ...lineStyle }} className="text-white/40 mt-[16px] mb-[22px]">
            출처: {data.keyIssuesSources.map((s) => s.outlet).join(", ")}
          </div>
        )}

        {data.geopoliticalLabel && data.geopoliticalIssues && data.geopoliticalIssues.length > 0 && (
          <>
            <BlockTitle emoji="🌍">{data.geopoliticalLabel}</BlockTitle>
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

        {data.earningsPast && data.earningsPast.length > 0 && (
          <>
            <BlockTitle emoji="💰">실적발표 이슈</BlockTitle>
            <div className="mt-[14px]">
              <div style={{ fontSize: 14, fontWeight: 600, ...lineStyle }} className="text-white">간밤 실적 결과</div>
              <div className="space-y-[9px] mt-[9px]">
                {data.earningsPast.map((e: EarningsItem, i: number) => (
                  <div key={i}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span style={{ fontSize: 14, fontWeight: 500, ...lineStyle }} className="text-white/90">{e.company}</span>
                      <span style={{ fontSize: 14 }} className="text-white/40">({e.ticker})</span>
                      {e.changeRate && (
                        <span style={{ fontSize: 14 }} className={e.changeRate.startsWith("+") ? "text-emerald-400" : "text-red-400"}>
                          {e.changeRate}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, ...lineStyle }} className="text-white/55 mt-[2px]">{e.result}</div>
                  </div>
                ))}
              </div>
            </div>
            {data.earningsUpcoming && data.earningsUpcoming.length > 0 && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, ...lineStyle }} className="text-white mt-[18px]">예정 발표 일정</div>
                <div className="space-y-[4px] mt-[9px]" style={lineStyle}>
                  {data.earningsUpcoming.map((s, i) => (
                    <div key={i} style={{ fontSize: 14 }} className="text-white/55">• {s}</div>
                  ))}
                </div>
              </>
            )}
            {data.earningsSources && data.earningsSources.length > 0 && (
              <div style={{ fontSize: 13, ...lineStyle }} className="text-white/40 mt-[16px] mb-[22px]">
                출처: {data.earningsSources.map((s) => s.outlet).join(", ")}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
