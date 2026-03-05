/**
 * 자유 구성 유튜브 시황 요약 표시
 * - AI가 만든 요약 전체 표시. **굵게** 지원
 */
import type { FlexibleVideoSummary } from "../utils/aiSummary";

function renderWithBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function FlexibleSummaryView({ data }: { data: FlexibleVideoSummary }) {
  const { content } = data;
  if (!content?.trim()) {
    return <p className="text-white/50 text-sm">요약 내용이 없습니다.</p>;
  }

  return (
    <div className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">
      {renderWithBold(content)}
    </div>
  );
}
