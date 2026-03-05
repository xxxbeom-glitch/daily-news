import { useState, useCallback, useRef } from "react";
import { Paperclip } from "lucide-react";
import { generateMarketSummaryFromUploadedData, generateGlobalMarketDailyFromPdf } from "../utils/aiSummary";
import { getSelectedModel } from "../utils/persistState";
import { useArchive } from "../context/ArchiveContext";
import { fetchArticleContent } from "../utils/articleReader";
import { extractTextFromPdf } from "../utils/pdfExtract";

type CountryTab = "kr" | "us";

const ACCEPT_IMAGE = "image/png,image/jpeg,image/gif,image/webp";
const ACCEPT_PDF = "application/pdf,.pdf";
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const PDF_TYPE = "application/pdf";

interface UploadedImage {
  data: string;
  mimeType: string;
  name?: string;
}

function isDuplicateImage(images: UploadedImage[], newData: string): boolean {
  return images.some((img) => img.data === newData);
}

export function TestPage2() {
  const { addSession } = useArchive();
  const [tab, setTab] = useState<CountryTab>("kr");
  const [inputValue, setInputValue] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addImageIfNotDuplicate = useCallback((img: UploadedImage) => {
    setImages((prev) => {
      if (isDuplicateImage(prev, img.data)) return prev;
      return [...prev, img];
    });
  }, []);

  const processImageFile = useCallback((file: File): Promise<UploadedImage | string | null> => {
    return new Promise((resolve) => {
      if (IMAGE_TYPES.includes(file.type)) {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.includes(",") ? result.split(",")[1] : result;
          if (base64) {
            resolve({ data: base64, mimeType: file.type, name: file.name });
          } else {
            resolve(null);
          }
        };
        reader.readAsDataURL(file);
      } else {
        resolve(`이미지만 업로드 가능합니다. (PNG, JPEG, GIF, WebP)`);
      }
    });
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      setError(null);

      if (tab === "kr") {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const result = await processImageFile(file);
          if (result && typeof result === "object") {
            addImageIfNotDuplicate(result);
          } else if (typeof result === "string") {
            setError(result);
          }
        }
      } else {
        const pdfFiles = Array.from(files)
          .filter((f) => f.type === PDF_TYPE || f.name?.toLowerCase().endsWith(".pdf"))
          .slice(0, 2);
        if (pdfFiles.length === 0) {
          setError("PDF 파일만 업로드할 수 있습니다.");
          e.target.value = "";
          return;
        }
        setLoading(true);
        try {
          const textParts: string[] = [];
          for (let i = 0; i < pdfFiles.length; i++) {
            const text = await extractTextFromPdf(pdfFiles[i]);
            if (text.trim()) {
              textParts.push(`[PDF ${i + 1}] ${pdfFiles[i].name}\n\n${text.trim()}`);
            }
          }
          const combinedText = textParts.join("\n\n---\n\n");
          if (!combinedText.trim()) {
            setError("PDF에서 텍스트를 추출할 수 없습니다.");
            e.target.value = "";
            return;
          }
          const model = getSelectedModel();
          const data = await generateGlobalMarketDailyFromPdf(combinedText, {
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
            sources: ["test2"],
            articles: pdfFiles.map((f, i) => ({
              id: `test2-${Date.now()}-${i}`,
              title: f.name,
              source: "글로벌 마켓 데일리",
              sourceId: "test2",
              publishedAt: now.toISOString(),
              url: "",
              summary: "",
              aiModel: model,
              category: "Economy" as const,
              isInternational: true,
            })),
            marketSummary: data,
            aiModel: model,
          });
          setSuccessMessage("모닝뉴스에 저장되었습니다.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "분석 실패");
        } finally {
          setLoading(false);
        }
      }
      e.target.value = "";
    },
    [tab, processImageFile, addImageIfNotDuplicate, addSession]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (tab !== "kr") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            processImageFile(file).then((result) => {
              if (result && typeof result === "object") {
                addImageIfNotDuplicate(result);
              }
            });
          }
          break;
        }
      }
    },
    [tab, processImageFile, addImageIfNotDuplicate]
  );

  const handleAnalyzeKr = useCallback(async () => {
    const hasImages = images.length > 0;
    const hasText = inputValue.trim().length > 0;
    if (!hasImages && !hasText) {
      setError("이미지를 첨부하거나 텍스트를 입력하세요.");
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    let finalText = inputValue.trim();
    const urlMatches = finalText.match(/\bhttps?:\/\/[^\s]+/g);
    if (urlMatches?.length) {
      const contents: string[] = [];
      for (const url of urlMatches) {
        try {
          const { title, textContent } = await fetchArticleContent(url.trim());
          const part = [title ? `[제목] ${title}` : "", textContent ?? ""].filter(Boolean).join("\n\n");
          if (part) contents.push(part);
        } catch {
          contents.push(`[URL] ${url}`);
        }
      }
      if (contents.length > 0) {
        finalText = contents.join("\n\n---\n\n");
      }
    }

    try {
      const model = getSelectedModel();
      const data = await generateMarketSummaryFromUploadedData(
        { text: finalText || "", images: hasImages ? images : undefined },
        { model, modelId: undefined }
      );
      const now = new Date();
      const title =
        `${now.getMonth() + 1}월 ${now.getDate()}일 ` +
        (now.getHours() < 12 ? "오전" : "오후") +
        ` ${String(now.getHours() % 12 || 12).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} · 한국 뉴스`;
      addSession({
        id: `session-${Date.now()}-kr`,
        title,
        createdAt: now.toISOString(),
        isInternational: false,
        sources: ["test2"],
        articles: [
          {
            id: `test2-${Date.now()}`,
            title: finalText ? "데이터 직접 입력" : "이미지 분석",
            source: "한국 뉴스",
            sourceId: "test2",
            publishedAt: now.toISOString(),
            url: "",
            summary: "",
            aiModel: model,
            category: "Economy",
            isInternational: false,
          },
        ],
        marketSummary: data,
        aiModel: model,
      });
      setSuccessMessage("모닝뉴스에 저장되었습니다.");
      setInputValue("");
      setImages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 실패");
    } finally {
      setLoading(false);
    }
  }, [inputValue, images, addSession]);

  const canSubmitKr = (inputValue.trim().length > 0 || images.length > 0) && !loading;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 pt-5 pb-[120px]" onPaste={handlePaste}>
        <h1 className="text-white font-semibold mb-4" style={{ fontSize: 16 }}>
          데이터 업로드
        </h1>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setTab("kr")}
            className={`flex-1 py-2.5 rounded-[10px] text-sm font-medium transition-colors ${
              tab === "kr" ? "bg-[#618EFF] text-white" : "bg-white/10 text-white/60 hover:bg-white/15"
            }`}
          >
            한국
          </button>
          <button
            type="button"
            onClick={() => setTab("us")}
            className={`flex-1 py-2.5 rounded-[10px] text-sm font-medium transition-colors ${
              tab === "us" ? "bg-[#618EFF] text-white" : "bg-white/10 text-white/60 hover:bg-white/15"
            }`}
          >
            미국
          </button>
        </div>

        {tab === "kr" ? (
          <div className="rounded-[12px] border border-white/15 bg-white/5 overflow-hidden">
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 border-b border-white/10">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    <img
                      src={`data:${img.mimeType};base64,${img.data}`}
                      alt=""
                      className="w-16 h-16 object-cover rounded border border-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500/90 text-white text-[10px] leading-none hover:bg-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="이미지 첨부(Ctrl+V) 또는 기사 링크·텍스트 입력"
              rows={5}
              className="w-full px-4 py-3 bg-transparent text-white placeholder:text-white/40 text-sm resize-y min-h-[120px] border-0 focus:outline-none focus:ring-0"
            />
            <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 bg-white/[0.02]">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-white/50 hover:text-white/80 hover:bg-white/5 rounded-lg transition-colors"
                title="이미지 첨부"
              >
                <Paperclip size={18} />
              </button>
              <span className="text-white/30 text-xs">이미지만 첨부 (한국 뉴스)</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_IMAGE}
              onChange={handleFileChange}
              multiple
              className="hidden"
            />
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#0a0a0f]/95 backdrop-blur-md border-t border-white/6 px-4 pt-3 pb-5 z-10">
              <button
                type="button"
                onClick={handleAnalyzeKr}
                disabled={!canSubmitKr}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-[10px] font-semibold transition-all ${
                  !canSubmitKr ? "bg-white/5 text-white/30 cursor-not-allowed" : "bg-[#618EFF] text-white shadow-xl shadow-[#2C3D6B]/40"
                }`}
                style={{ fontSize: 15, fontWeight: 500 }}
              >
                {loading ? "분석 중…" : "분석 후 모닝뉴스에 저장"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              onClick={() => !loading && fileInputRef.current?.click()}
              className="rounded-[12px] border-2 border-dashed border-white/20 bg-white/5 py-12 px-4 text-center cursor-pointer hover:bg-white/[0.07] hover:border-white/30 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_PDF}
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              {loading ? (
                <p className="text-white/70 text-sm">PDF 분석 중…</p>
              ) : (
                <>
                  <p className="text-white/80 text-sm font-medium">PDF 파일 선택</p>
                  <p className="text-white/40 text-xs mt-1">Global Market Daily·Insight, 최대 2개 (미국 시황)</p>
                </>
              )}
            </div>
          </>
        )}

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        {successMessage && <p className="text-[#618EFF] text-sm mt-4">{successMessage}</p>}
      </div>

      {tab === "us" && (
        <div className="h-0" aria-hidden />
      )}
    </div>
  );
}
