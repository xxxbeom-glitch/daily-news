/**
 * 인사이트 칩: URL 기사 → 스크래핑 → AI 분석 (Gemini 3 Flash 기본)
 */

import { scrapeArticleFromUrl } from "./scrapeArticle";
import type { InsightReportData } from "../data/insightReport";
import { generateInsightReportFromArticle } from "./aiSummary";

export interface InsightAnalysisInput {
  url: string;
}

export interface InsightAnalysisResult {
  url: string;
  title: string;
  source?: string;
  publishedAt?: string;
  report: InsightReportData;
  ok: boolean;
  error?: string;
}

/**
 * URL → 스크래핑 → AI 분석 파이프라인
 */
export async function runInsightAnalysis(
  input: InsightAnalysisInput,
  opts?: { modelId?: string }
): Promise<InsightAnalysisResult> {
  const scraped = await scrapeArticleFromUrl(input.url);
  if (!scraped.ok) {
    return {
      url: input.url,
      title: scraped.title,
      source: scraped.source,
      publishedAt: scraped.publishedAt,
      report: {
        articleSummary: [],
        keyPoints: "",
        score: 0,
        signal: "중립",
        strategy: "",
      },
      ok: false,
      error: scraped.error,
    };
  }

  try {
    const report = await generateInsightReportFromArticle(
      {
        title: scraped.title,
        body: scraped.body,
      },
      opts
    );
    return {
      url: scraped.url,
      title: scraped.title,
      source: scraped.source,
      publishedAt: scraped.publishedAt,
      report,
      ok: true,
    };
  } catch (e) {
    return {
      url: scraped.url,
      title: scraped.title,
      source: scraped.source,
      publishedAt: scraped.publishedAt,
      report: {
        articleSummary: [],
        keyPoints: "",
        score: 0,
        signal: "중립",
        strategy: "",
      },
      ok: false,
      error: e instanceof Error ? e.message : "분석 실패",
    };
  }
}
