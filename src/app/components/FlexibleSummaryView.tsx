/**
 * 자유 구성 유튜브 시황 요약 표시
 * - 고정 타이틀 없이 AI가 만든 섹션 그대로 표시
 */
import type { FlexibleVideoSummary } from "../utils/aiSummary";

const sectionTitleClass = "text-white/90 font-semibold text-sm mb-1.5";
const sectionBodyClass = "text-white/70 text-sm leading-relaxed whitespace-pre-wrap";

export function FlexibleSummaryView({ data }: { data: FlexibleVideoSummary }) {
  const { sections } = data;
  if (!sections?.length) {
    return <p className="text-white/50 text-sm">요약 내용이 없습니다.</p>;
  }

  return (
    <div className="space-y-5">
      {sections.map((sec, i) => (
        <div key={i} className="pb-4 border-b border-white/8 last:border-0">
          <h3 className={sectionTitleClass}>{sec.title}</h3>
          <p className={sectionBodyClass}>{sec.body}</p>
        </div>
      ))}
    </div>
  );
}
