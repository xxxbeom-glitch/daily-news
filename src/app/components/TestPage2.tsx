import { useState, useCallback, useRef } from "react";
import { generateMarketSummaryFromUploadedData } from "../utils/aiSummary";
import { getSelectedModel } from "../utils/persistState";
import { useArchive } from "../context/ArchiveContext";
import { fetchArticleContent } from "../utils/articleReader";
import type { Article } from "../data/newsSources";

const ACCEPT_IMAGE = "image/png,image/jpeg,image/gif,image/webp,.pdf,.xlsx,.xls";
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

interface UploadedImage {
  data: string;
  mimeType: string;
  name?: string;
}

export function TestPage2() {
  const { addSession } = useArchive();
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
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
        resolve(`지원 형식: 이미지(PNG, JPEG, GIF, WebP). '${file.name}'은 현재 미지원.`);
      }
    });
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      for (let i = 0; i < files.length; i++) {
        const result = await processFile(files[i]);
        if (result && typeof result === "object") {
          setImages((prev) => [...prev, result]);
        } else if (typeof result === "string") {
          setError(result);
        }
      }
      e.target.value = "";
    },
    [processFile]
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
                setImages((prev) => [...prev, result]);
              }
            });
          }
          break;
        }
      }
    },
    [processFile]
  );

  const handleUrlFetch = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    setError(null);
    setLoading(true);
    try {
      const { title, textContent } = await fetchArticleContent(url);
      const content = [title ? `[제목] ${title}` : "", textContent ?? ""].filter(Boolean).join("\n\n");
      setTextInput((prev) => (prev ? `${prev}\n\n---\n\n${content}` : content));
      setUrlInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "기사를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [urlInput]);

  const handleAnalyze = useCallback(async () => {
    const hasText = textInput.trim().length > 0;
    const hasImages = images.length > 0;
    if (!hasText && !hasImages) {
      setError("텍스트, URL 또는 이미지를 입력해주세요.");
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const model = getSelectedModel();
      const modelId = undefined;
      const data = await generateMarketSummaryFromUploadedData(
        { text: textInput.trim(), images: images.length > 0 ? images : undefined },
        { model, modelId }
      );

      const now = new Date();
      const title =
        `${now.getMonth() + 1}월 ${now.getDate()}일 ` +
        (now.getHours() < 12 ? "오전" : "오후") +
        ` ${String(now.getHours() % 12 || 12).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} · 테스트2`;

      const articlesForSession: Article[] = [
        {
          id: `test2-${Date.now()}`,
          title: textInput.trim() ? "데이터 직접 입력" : "이미지 분석",
          source: "테스트2",
          sourceId: "test2",
          publishedAt: now.toISOString(),
          url: "",
          summary: "",
          aiModel: model,
          category: "Economy",
          isInternational: true,
        },
      ];

      addSession({
        id: `session-${Date.now()}-test2`,
        title,
        createdAt: now.toISOString(),
        isInternational: true,
        sources: ["test2"],
        articles: articlesForSession,
        marketSummary: data,
        aiModel: model,
      });
      setSuccessMessage("오늘의 시황에 저장되었습니다.");
      setTextInput("");
      setImages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 실패");
    } finally {
      setLoading(false);
    }
  }, [textInput, images, urlInput, addSession]);

  const canSubmit = (textInput.trim().length > 0 || images.length > 0) && !loading;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 pt-5 pb-[120px] space-y-4" onPaste={handlePaste}>
        <h1 className="text-white font-semibold" style={{ fontSize: 16 }}>
          테스트2 (데이터 직접 입력 및 검증)
        </h1>
        <p className="text-white/60 text-sm">
          파일, 이미지, 기사 URL 또는 텍스트를 입력한 뒤 분석 버튼을 누르세요. (Ctrl+V로 이미지 붙여넣기)
        </p>

        <div>
          <label className="block text-white/70 text-sm mb-1">파일 업로드 (이미지)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_IMAGE}
            onChange={handleFileChange}
            multiple
            className="block w-full text-sm text-white/80 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-[#618EFF]/20 file:text-[#618EFF]"
          />
        </div>

        <div>
          <label className="block text-white/70 text-sm mb-1">기사 링크 (URL)</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
              className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleUrlFetch()}
            />
            <button
              type="button"
              onClick={handleUrlFetch}
              disabled={loading || !urlInput.trim()}
              className="px-3 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 disabled:opacity-50"
            >
              불러오기
            </button>
          </div>
        </div>

        <div>
          <label className="block text-white/70 text-sm mb-1">직접 텍스트 입력</label>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="기사 내용, 시황 요약 등을 붙여넣으세요."
            rows={6}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 text-sm resize-y"
          />
        </div>

        {images.length > 0 && (
          <div>
            <span className="text-white/70 text-sm">업로드된 이미지 ({images.length}개)</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {images.map((img, i) => (
                <div key={i} className="relative">
                  <img
                    src={`data:${img.mimeType};base64,${img.data}`}
                    alt=""
                    className="w-20 h-20 object-cover rounded border border-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500/90 text-white text-xs hover:bg-red-500"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {successMessage && <p className="text-[#618EFF] text-sm">{successMessage}</p>}
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
