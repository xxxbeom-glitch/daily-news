/**
 * 인사이트 칩 리포트 뷰 - 기존 리포트 카드 UI 스타일 계승, 3단계 구조
 */

import React from "react";
import type { InsightReportData } from "../data/insightReport";

const lineStyle = { lineHeight: 1.5 as const };

function BlockTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-[26px] pt-[26px] pb-0 first:mt-0 first:pt-0 first:pb-0 border-t border-white/8 first:border-t-0">
      <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5 }} className="text-white">
        {children}
      </span>
    </div>
  );
}

export function InsightReportView({
  data,
  title,
  source,
  dateStr,
  aiModel,
}: {
  data: InsightReportData;
  title?: string;
  source?: string;
  dateStr?: string;
  aiModel?: "gemini" | "gpt" | "claude";
}) {
  const bulletSize = 3;
  const bulletStyle = {
    width: bulletSize,
    height: bulletSize,
    borderRadius: "50%",
    flexShrink: 0,
    marginTop: 10,
  } as const;

  const signalColor =
    data.signal === "좋음" ? "text-emerald-400" : data.signal === "나쁨" ? "text-red-400" : "text-white/70";

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white/5 border border-white/8 rounded-[10px] mt-0 mb-6 mx-0">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="px-[17px] pt-[20px] pb-[20px] border-b border-white/8">
          <div style={{ fontSize: 11, lineHeight: 1.5 }} className="text-white/90">
            {dateStr ?? new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5 }} className="text-white">
            {title ?? "인사이트 리포트"}
          </div>
          {(source || aiModel) && (
            <div style={{ fontSize: 11, lineHeight: 1.5 }} className="text-white/40 mt-[6px]">
              {[source, aiModel === "gemini" ? "Gemini AI" : aiModel === "claude" ? "Claude" : aiModel === "gpt" ? "ChatGPT" : ""]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>

        <div className="px-5 pt-6 pb-6">
          <BlockTitle>[기사 요약]</BlockTitle>
          <div className="mt-[14px] space-y-[10px]">
            {(data.articleSummary.length > 0 ? data.articleSummary : ["(요약 없음)"]).map((item, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span style={bulletStyle} className="bg-white/50 block shrink-0" />
                <div style={{ fontSize: 14, lineHeight: 1.6, fontWeight: 500 }} className="text-white/90 whitespace-pre-line">
                  {item}
                </div>
              </div>
            ))}
          </div>

          <BlockTitle>[핵심 포인트]</BlockTitle>
          <div style={{ fontSize: 14, lineHeight: 1.6 }} className="text-white/80 mt-[14px]">
            {data.keyPoints || "(분석 없음)"}
          </div>

          <BlockTitle>[투자 의견]</BlockTitle>
          <div className="mt-[14px] space-y-[12px]">
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontSize: 14, fontWeight: 600 }} className="text-white/90">
                점수:
              </span>
              <span style={{ fontSize: 14 }} className="text-white">
                {data.score}/10
              </span>
              <span style={{ fontSize: 14, fontWeight: 600 }} className="text-white/90">
                신호:
              </span>
              <span style={{ fontSize: 14 }} className={signalColor}>
                {data.signal}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }} className="text-white/70 mb-2">
                전략
              </div>
              <div style={{ fontSize: 14, ...lineStyle }} className="text-white/90 whitespace-pre-line">
                {data.strategy || "(전략 없음)"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
