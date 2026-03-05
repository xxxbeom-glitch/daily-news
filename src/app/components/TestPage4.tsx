import { useState, useCallback, useRef } from "react";
import { generateGlobalMarketDailyFromPdf } from "../utils/aiSummary";
import { getSelectedModel } from "../utils/persistState";
import { useArchive } from "../context/ArchiveContext";
import { extractTextFromPdf } from "../utils/pdfExtract";

export function TestPage4() {
  const { addSession } = useArchive();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;

      const file = files[0];
      if (file.type !== "application/pdf" && !file.name?.toLowerCase().endsWith(".pdf")) {
        setError("PDF 파일만 업로드할 수 있습니다.");
        e.target.value = "";
        return;
      }

      setError(null);
      setSuccessMessage(null);
      setLoading(true);

      try {
        const text = await extractTextFromPdf(file);
        if (!text.trim()) {
          setError("PDF에서 텍스트를 추출할 수 없습니다. (이미지 기반 PDF일 수 있음)");
          e.target.value = "";
          return;
        }

        const model = getSelectedModel();
        const data = await generateGlobalMarketDailyFromPdf(text, {
          model,
          modelId: undefined,
        });

        const now = new Date();
        const title =
          `${now.getMonth() + 1}월 ${now.getDate()}일 ` +
          (now.getHours() < 12 ? "오전" : "오후") +
          ` ${String(now.getHours() % 12 || 12).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} · 글로벌 마켓 데일리`;

        addSession({
          id: `session-${Date.now()}-gmd`,
          title,
          createdAt: now.toISOString(),
          isInternational: true,
          sources: ["test4"],
          articles: [
            {
              id: `test4-${Date.now()}`,
              title: file.name,
              source: "글로벌 마켓 데일리",
              sourceId: "test4",
              publishedAt: now.toISOString(),
              url: "",
              summary: "",
              aiModel: model,
              category: "Economy",
              isInternational: true,
            },
          ],
          marketSummary: data,
          aiModel: model,
        });

        setSuccessMessage("모닝뉴스에 저장되었습니다.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "분석 실패");
      } finally {
        setLoading(false);
        e.target.value = "";
      }
    },
    [addSession]
  );

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 pt-5 pb-6">
        <h1 className="text-white font-semibold mb-4" style={{ fontSize: 16 }}>
          테스트4 (Global Market Daily PDF)
        </h1>
        <p className="text-white/60 text-sm mb-4">
          글로벌 마켓 데일리 PDF만 업로드하세요. News Brief를 추출하여 모닝뉴스에 저장합니다.
        </p>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="rounded-[12px] border-2 border-dashed border-white/20 bg-white/5 py-12 px-4 text-center cursor-pointer hover:bg-white/[0.07] hover:border-white/30 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          {loading ? (
            <p className="text-white/70 text-sm">PDF 분석 중…</p>
          ) : (
            <>
              <p className="text-white/80 text-sm font-medium">PDF 파일을 선택하거나 놓아두세요</p>
              <p className="text-white/40 text-xs mt-1">Global Market Daily 형식 (키움증권 등)</p>
            </>
          )}
        </div>

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        {successMessage && <p className="text-[#618EFF] text-sm mt-4">{successMessage}</p>}
      </div>
    </div>
  );
}
