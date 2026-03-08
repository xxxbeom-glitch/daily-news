/**
 * 인사이트 칩 리포트 데이터 구조
 */

export interface InsightReportData {
  /** [기사 요약] 팩트 중심 3행 불렛포인트 */
  articleSummary: string[];
  /** [핵심 포인트] 시장/기업 가치 영향 분석 (1~2줄) */
  keyPoints: string;
  /** [투자 의견] 점수 1~10 */
  score: number;
  /** [투자 의견] 신호: 좋음 | 나쁨 | 중립 */
  signal: "좋음" | "나쁨" | "중립";
  /** [투자 의견] 전략: 매수/매도 판단, 이유, 대응 방법 */
  strategy: string;
}

export interface InsightArchiveItem {
  id: string;
  url: string;
  title?: string;
  source?: string;
  createdAt: string;
  report: InsightReportData;
  aiModel: "gemini" | "gpt" | "claude";
}
