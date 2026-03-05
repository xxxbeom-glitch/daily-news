import { useState, useCallback, useRef } from "react";
import { Paperclip } from "lucide-react";
import { generateMarketSummaryFromUploadedData } from "../utils/aiSummary";
import { getSelectedModel } from "../utils/persistState";
import { useArchive } from "../context/ArchiveContext";
import { fetchArticleContent } from "../utils/articleReader";
import { extractTextFromPdf } from "../utils/pdfExtract";

const ACCEPT_FILE = "image/png,image/jpeg,image/gif,image/webp,application/pdf,.pdf,.xlsx,.xls";
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

  const processFile = useCallback((file: File): Promise<UploadedImage | string | null> => {
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
        resolve(`지원 형식: 이미지(PNG, JPEG, GIF, WebP), PDF. '${file.name}'은 현재 미지원.`);
      }
    });
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      setError(null);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type === PDF_TYPE || file.name?.toLowerCase().endsWith(".pdf")) {
          setLoading(true);
          try {
            const text = await extractTextFromPdf(file);
            if (text.trim()) {
              setInputValue((prev) => (prev ? `${prev}\n\n---\n\n[PDF] ${file.name}\n\n${text}` : `[PDF] ${file.name}\n\n${text}`));
            } else {
              setError(`'${file.name}': 텍스트를 추출할 수 없습니다. (이미지 기반 PDF일 수 있음)`);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : `PDF 처리 실패: ${file.name}`);
          } finally {
            setLoading(false);
          }
        } else {
          const result = await processFile(file);
          if (result && typeof result === "object") {
            addImageIfNotDuplicate(result);
          } else if (typeof result === "string") {
            setError(result);
          }
        }
      }
      e.target.value = "";
    },
    [processFile, addImageIfNotDuplicate]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            processFile(file).then((result) => {
              if (result && typeof result === "object") {
                addImageIfNotDuplicate(result);
              }
            });
          }
          break;
        }
      }
    },
    [processFile, addImageIfNotDuplicate]
  );

  const handleAnalyze = useCallback(async () => {
    const text = inputValue.trim();
    const hasText = text.length > 0;
    const hasImages = images.length > 0;
    if (!hasText && !hasImages) {
      setError("텍스트, 기사 링크 또는 이미지를 입력해주세요.");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    let finalText = text;
    const urlMatches = text.match(/\bhttps?:\/\/[^\s]+/g);
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
        { text: finalText, images: images.length > 0 ? images : undefined },
        { model, modelId: undefined }
      );

      const now = new Date();
      const title =
        `${now.getMonth() + 1}월 ${now.getDate()}일 ` +
        (now.getHours() < 12 ? "오전" : "오후") +
        ` ${String(now.getHours() % 12 || 12).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} · 테스트2`;

      addSession({
        id: `session-${Date.now()}-test2`,
        title,
        createdAt: now.toISOString(),
        isInternational: true,
        sources: ["test2"],
        articles: [
          {
            id: `test2-${Date.now()}`,
            title: finalText ? "데이터 직접 입력" : "이미지 분석",
            source: "테스트2",
            sourceId: "test2",
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
      setInputValue("");
      setImages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 실패");
    } finally {
      setLoading(false);
    }
  }, [inputValue, images, addSession]);

  const canSubmit = (inputValue.trim().length > 0 || images.length > 0) && !loading;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 pt-5 pb-[120px]" onPaste={handlePaste}>
        <h1 className="text-white font-semibold mb-4" style={{ fontSize: 16 }}>
          테스트2 (데이터 직접 입력 및 검증)
        </h1>

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
            placeholder="기사 링크, 텍스트, 이미지(Ctrl+V), PDF 첨부 가능"
            rows={5}
            className="w-full px-4 py-3 bg-transparent text-white placeholder:text-white/40 text-sm resize-y min-h-[120px] border-0 focus:outline-none focus:ring-0"
          />
          <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 bg-white/[0.02]">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-white/50 hover:text-white/80 hover:bg-white/5 rounded-lg transition-colors"
              title="첨부파일"
            >
              <Paperclip size={18} />
            </button>
            <span className="text-white/30 text-xs">이미지(Ctrl+V) · PDF 첨부</span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_FILE}
          onChange={handleFileChange}
          multiple
          className="hidden"
        />

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        {successMessage && <p className="text-[#618EFF] text-sm mt-3">{successMessage}</p>}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#0a0a0f]/95 backdrop-blur-md border-t border-white/6 px-4 pt-3 pb-5 z-10">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!canSubmit}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-[10px] font-semibold transition-all ${
            !canSubmit ? "bg-white/5 text-white/30 cursor-not-allowed" : "bg-[#618EFF] text-white shadow-xl shadow-[#2C3D6B]/40"
          }`}
          style={{ fontSize: 15, fontWeight: 500 }}
        >
          {loading ? "데이터 분석 중…" : "데이터 분석 및 시황 저장"}
        </button>
      </div>
    </div>
  );
}
