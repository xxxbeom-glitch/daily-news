import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Paperclip, X, Clipboard } from "lucide-react";
import { generateMarketSummaryFromUploadedData, generateGlobalMarketDailyFromPdf } from "../utils/aiSummary";
import { getSelectedModel, getSelectedModelId, saveArchiveState } from "../utils/persistState";
import { useArchive } from "../context/ArchiveContext";
import { fetchArticleContent } from "../utils/articleReader";
import { extractTextFromPdf } from "../utils/pdfExtract";
import {
  isCloudinaryEnabled,
  uploadBase64ToCloudinary,
  uploadPdfToCloudinary,
  fetchUrlToBase64,
} from "../utils/cloudinaryUpload";
type CountryTab = "kr" | "us";

/** 모바일에서 파일종류 '전체'로 열리도록 */* 사용 (이미지/PDF는 handleFileChange에서 검증) */
const ACCEPT_FILES = "*/*";
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const PDF_TYPE = "application/pdf";
/** 이미지 개수 제한 없음 (AI 요약 시간은 사용자 수용) */
const IMAGE_QUALITY = 0.7;
const IMAGE_MAX_WIDTH = 1200;

/** data=base64(로컬), url=Cloudinary URL */
type UploadedImage = { data?: string; mimeType?: string; name?: string; url?: string };

interface UploadedPdf {
  name: string;
  text: string;
  /** Cloudinary URL (설정 시) */
  url?: string;
}

function isDuplicateImage(images: UploadedImage[], newData: string): boolean {
  return images.some((img) => img.data === newData);
}

/** 이미지를 70% 품질 JPEG로 압축 (API 용량 절감) */
function compressImage(file: File): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > IMAGE_MAX_WIDTH) {
        height = (height * IMAGE_MAX_WIDTH) / width;
        width = IMAGE_MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.includes(",") ? result.split(",")[1] : result;
            resolve({ data: base64 ?? "", mimeType: "image/jpeg", name: file.name });
          };
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        IMAGE_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

interface UploadPageProps {
  onClose?: () => void;
  initialEditSessionId?: string;
}

export function UploadPage({ onClose, initialEditSessionId }: UploadPageProps = {}) {
  const { sessions, addSession, updateSession } = useArchive();
  const location = useLocation();
  const navigate = useNavigate();
  const editSessionId = initialEditSessionId ?? (location.state as { editSessionId?: string } | null)?.editSessionId;

  const goBack = useCallback(() => {
    if (onClose) onClose();
    else navigate("/", { replace: true });
  }, [onClose, navigate]);
  const [tab, setTab] = useState<CountryTab>("kr");
  const [urlChips, setUrlChips] = useState<string[]>([]);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [pdfs, setPdfs] = useState<UploadedPdf[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState<1 | 2 | 3>(1);
  const [progressPercent, setProgressPercent] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const PROGRESS_LABELS: Record<1 | 2 | 3, string> = {
    1: "업로드",
    2: "AI 요약",
    3: "리포트 작성",
  };

  useEffect(() => {
    if (!editSessionId) return;
    const session = sessions.find((s) => s.id === editSessionId);
    if (session?.uploadedImages?.length) {
      setImages(session.uploadedImages);
      setTab("kr");
    }
  }, [editSessionId, sessions]);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removePdf = useCallback((index: number) => {
    setPdfs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addUrlChip = useCallback(() => {
    const v = urlInputValue.trim();
    if (!v) return;
    const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      new URL(url);
      setUrlChips((prev) => (prev.includes(url) ? prev : [...prev, url]));
      setUrlInputValue("");
      setError(null);
    } catch {
      setError("유효하지 않은 URL입니다.");
    }
  }, [urlInputValue]);

  const removeUrlChip = useCallback((url: string) => {
    setUrlChips((prev) => prev.filter((u) => u !== url));
  }, []);

  const handlePasteFromClipboardUrl = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        const url = /^https?:\/\//i.test(text.trim()) ? text.trim() : `https://${text.trim()}`;
        try {
          new URL(url);
          setUrlChips((prev) => (prev.includes(url) ? prev : [...prev, url]));
          setError(null);
        } catch {
          setError("유효하지 않은 URL입니다.");
        }
      }
    } catch {
      setError("클립보드 접근에 실패했습니다.");
    }
  }, []);

  const addImageIfNotDuplicate = useCallback(
    (img: UploadedImage) => {
      setImages((prev) => {
        if (isDuplicateImage(prev, img.data ?? "")) return prev;
        setError(null);
        return [...prev, img];
      });
    },
    []
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      setError(null);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type === PDF_TYPE || file.name?.toLowerCase().endsWith(".pdf")) {
          try {
            const text = await extractTextFromPdf(file);
            if (text.trim()) {
              let url: string | undefined;
              if (isCloudinaryEnabled()) {
                try {
                  url = await uploadPdfToCloudinary(file);
                } catch {
                  /* Cloudinary 실패 시 url 없이 진행 */
                }
              }
              setPdfs((prev) => {
                const next = [...prev, { name: file.name, text: text.trim(), url }];
                return next.slice(-2);
              });
            } else {
              setError(`'${file.name}': 텍스트를 추출할 수 없습니다.`);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : `PDF 처리 실패: ${file.name}`);
          }
        } else if (IMAGE_TYPES.includes(file.type)) {
          try {
            const compressed = await compressImage(file);
            addImageIfNotDuplicate(compressed);
          } catch (err) {
            setError(err instanceof Error ? err.message : "이미지 압축 실패");
          }
        }
      }
      e.target.value = "";
    },
    [addImageIfNotDuplicate]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) {
              compressImage(file)
                .then((compressed) => addImageIfNotDuplicate(compressed))
                .catch((err) => setError(err instanceof Error ? err.message : "이미지 압축 실패"));
            }
            return;
          }
        }
      }
      const text = e.clipboardData?.getData("text");
      if (text?.trim() && tab === "kr") {
        const trimmed = text.trim();
        if (/^https?:\/\//i.test(trimmed) || /^[a-z0-9-]+\.(com|kr|org|net)/i.test(trimmed)) {
          e.preventDefault();
          const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
          try {
            new URL(url);
            setUrlChips((prev) => (prev.includes(url) ? prev : [...prev, url]));
            setError(null);
          } catch {}
        }
      }
    },
    [addImageIfNotDuplicate, tab]
  );

  const handleAnalyze = useCallback(async () => {
    if (tab === "kr") {
      const hasImages = images.length > 0;
      const hasText = inputValue.trim().length > 0;
      const hasUrls = urlChips.length > 0;
      if (!hasImages && !hasText && !hasUrls) {
        setError("이미지·기사 링크·텍스트 중 하나 이상을 입력하세요.");
        return;
      }

      setError(null);
      setSuccessMessage(null);
      setLoading(true);
      setProgressStep(1);
      setProgressPercent(5);

      let finalText = inputValue.trim();
      const urlsFromText = finalText.match(/\bhttps?:\/\/[^\s]+/g) ?? [];
      const allUrls = [...new Set([...urlChips, ...urlsFromText.map((u) => u.trim())])];
      if (allUrls.length > 0) {
        const contents: string[] = [];
        for (let i = 0; i < allUrls.length; i++) {
          try {
            setProgressPercent(5 + Math.round(((i + 1) / allUrls.length) * 15));
            const { title, textContent } = await fetchArticleContent(allUrls[i]);
            const part = [title ? `[제목] ${title}` : "", textContent ?? ""].filter(Boolean).join("\n\n");
            if (part) contents.push(part);
          } catch {
            contents.push(`[URL] ${allUrls[i]}`);
          }
        }
        if (contents.length > 0) {
          const urlText = contents.join("\n\n---\n\n");
          finalText = finalText ? `${urlText}\n\n---\n\n${finalText}` : urlText;
        }
      }
      setProgressStep(2);
      setProgressPercent(20);

      try {
        const model = getSelectedModel();
        const modelId = getSelectedModelId();
        const imagesSlice = hasImages ? images : [];
        const imagesToSend =
          imagesSlice.length > 0
            ? await Promise.all(
                imagesSlice.map(async (img) => {
                  if (img.data) return { data: img.data, mimeType: img.mimeType ?? "image/jpeg" };
                  if (img.url) return fetchUrlToBase64(img.url);
                  throw new Error("이미지 데이터 없음");
                })
              )
            : undefined;
        setProgressStep(2);
        setProgressPercent(50);
        const data = await generateMarketSummaryFromUploadedData(
          { text: finalText || "", images: imagesToSend },
          { model, modelId }
        );
        setProgressStep(3);
        setProgressPercent(90);
        let uploadedImagesForSave: { url?: string; data?: string; mimeType?: string; name?: string }[] | undefined;
        if (hasImages && imagesSlice.length > 0) {
          if (isCloudinaryEnabled()) {
            uploadedImagesForSave = await Promise.all(
              imagesSlice.map(async (img) => {
                if (img.url) return { url: img.url, name: img.name };
                if (img.data)
                  return { url: await uploadBase64ToCloudinary(img.data, img.mimeType ?? "image/jpeg"), name: img.name };
                throw new Error("이미지 데이터 없음");
              })
            );
          } else {
            uploadedImagesForSave = imagesSlice;
          }
        }
        const now = new Date();
        const title =
          `${now.getMonth() + 1}월 ${now.getDate()}일 ` +
          (now.getHours() < 12 ? "오전" : "오후") +
          ` ${String(now.getHours() % 12 || 12).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} · 리포트`;
        if (editSessionId) {
          updateSession(editSessionId, {
            marketSummary: data,
            uploadedImages: uploadedImagesForSave,
          });
          setSuccessMessage("완료");
          setInputValue("");
          setUrlChips([]);
          setUrlInputValue("");
          setImages([]);
          goBack();
        } else {
          const newId = `session-${Date.now()}-kr`;
          addSession({
            id: newId,
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
            uploadedImages: uploadedImagesForSave,
          });
          saveArchiveState({ isInternational: false, selectedSessionId: newId });
          setSuccessMessage("완료");
          setInputValue("");
          setUrlChips([]);
          setUrlInputValue("");
          setImages([]);
          goBack();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "분석 실패";
        const detail = e instanceof Error && e.stack ? `${msg}\n${e.stack}` : msg;
        setError(detail);
        setProgressStep(1);
        setProgressPercent(0);
      } finally {
        setLoading(false);
      }
    } else {
      if (pdfs.length === 0) {
        setError("PDF 파일을 첨부하세요.");
        return;
      }

      setError(null);
      setSuccessMessage(null);
      setLoading(true);
      setProgressStep(1);
      setProgressPercent(10);

      try {
        const model = getSelectedModel();
        const modelId = getSelectedModelId();
        setProgressStep(2);
        setProgressPercent(20);
        const combinedText = pdfs
          .map((p, i) => `[PDF ${i + 1}] ${p.name}\n\n${p.text}`)
          .join("\n\n---\n\n");
        const data = await generateGlobalMarketDailyFromPdf(combinedText, { model, modelId });

        setProgressStep(3);
        setProgressPercent(90);
        const now = new Date();
        const title =
          `${now.getMonth() + 1}월 ${now.getDate()}일 ` +
          (now.getHours() < 12 ? "오전" : "오후") +
          ` ${String(now.getHours() % 12 || 12).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} · 리포트`;
        const newId = `session-${Date.now()}-gmd`;
        const articles = pdfs.map((p, i) => ({
          id: `test2-${Date.now()}-${i}`,
          title: p.name,
          source: "글로벌 마켓 데일리",
          sourceId: "test2",
          publishedAt: now.toISOString(),
          url: p.url ?? "",
          summary: "",
          aiModel: model,
          category: "Economy" as const,
          isInternational: true,
        }));

        addSession({
          id: newId,
          title,
          createdAt: now.toISOString(),
          isInternational: true,
          sources: ["test2"],
          articles,
          marketSummary: data,
          aiModel: model,
        });
        saveArchiveState({ isInternational: true, selectedSessionId: newId });
        setSuccessMessage("완료");
        setPdfs([]);
        goBack();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "분석 실패";
        const detail = err instanceof Error && err.stack ? `${msg}\n${err.stack}` : msg;
        setError(detail);
        setProgressStep(1);
        setProgressPercent(0);
      } finally {
        setLoading(false);
      }
    }
  }, [tab, inputValue, urlChips, images, pdfs, addSession, updateSession, editSessionId, goBack]);

  const canSubmit =
    (tab === "kr" && (inputValue.trim().length > 0 || images.length > 0 || urlChips.length > 0)) ||
    (tab === "us" && pdfs.length > 0);

  const handleCancel = useCallback(() => {
    goBack();
  }, [goBack]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden px-4 pt-5 pb-[120px]" onPaste={handlePaste}>
        <div className="rounded-[12px] border border-white/15 bg-white/5 overflow-hidden">
          {tab === "kr" && urlChips.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 border-b border-white/10">
              {urlChips.map((url) => (
                <div
                  key={url}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/10 px-2 py-1 shrink-0"
                >
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/90 truncate max-w-[180px] hover:underline text-xs"
                  >
                    {url}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeUrlChip(url)}
                    disabled={loading}
                    className="p-0.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    title="제거"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {(images.length > 0 || pdfs.length > 0) && (
            <div className="flex flex-wrap gap-2 p-3 border-b border-white/10">
              {images.length > 0 && (
                <span className="w-full text-white/40 text-xs mb-1">
                  이미지 {images.length}장
                </span>
              )}
              {images.map((img, i) => (
                <div key={`img-${i}`} className="relative">
                  <img
                    src={img.url ?? (img.data ? `data:${img.mimeType ?? "image/jpeg"};base64,${img.data}` : "")}
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
              {pdfs.map((p, i) => (
                <div
                  key={`pdf-${i}`}
                  className="flex items-center gap-2 px-3 py-2 rounded border border-white/10 bg-white/5"
                >
                  <span className="text-white/80 text-xs truncate max-w-[120px]">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => removePdf(i)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {tab === "kr" && (
            <div className="flex items-stretch gap-2 px-4 py-3 border-b border-white/10">
              <div className="flex-1 min-w-0 flex items-center gap-1.5 rounded-[10px] border border-white/10 bg-white/5 px-3 py-1 h-10 overflow-hidden">
                <input
                  type="text"
                  value={urlInputValue}
                  onChange={(e) => setUrlInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addUrlChip()}
                  placeholder={urlChips.length === 0 ? "기사 링크 입력 (Enter 또는 붙여넣기)" : ""}
                  className="flex-1 min-w-[120px] bg-transparent text-white placeholder-white/40 outline-none py-0 text-sm"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={handlePasteFromClipboardUrl}
                  className="p-1 rounded-[6px] text-white/50 hover:text-white/90 hover:bg-white/5 transition-colors shrink-0"
                  title="클립보드 붙여넣기"
                  disabled={loading}
                >
                  <Clipboard size={16} />
                </button>
              </div>
              <button
                type="button"
                onClick={addUrlChip}
                disabled={loading || !urlInputValue.trim()}
                className="shrink-0 h-10 px-3 rounded-[10px] border border-white/10 bg-white/5 text-white/80 hover:bg-white/8 disabled:opacity-50 transition-colors text-sm"
              >
                추가
              </button>
            </div>
          )}
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={tab === "kr" ? "추가 텍스트 입력 (선택)" : "이미지·PDF는 위 버튼으로 첨부"}
            rows={5}
            className="w-full px-4 py-3 bg-transparent text-white placeholder:text-white/40 text-sm resize-y min-h-[120px] border-0 focus:outline-none focus:ring-0"
          />
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-white/10 bg-white/[0.02]">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-white/50 hover:text-white/80 hover:bg-white/5 rounded-lg transition-colors"
                title="이미지·PDF 첨부"
              >
                <Paperclip size={18} />
              </button>
            </div>
            <div className="flex shrink-0 h-10 rounded-[10px] border border-white/10 bg-white/5 overflow-hidden">
              <button
                type="button"
                onClick={() => setTab("kr")}
                className={`flex-1 min-w-[52px] h-full flex items-center justify-center transition-colors border-r border-white/10 ${
                  tab === "kr" ? "text-white" : "opacity-40"
                }`}
                style={{ fontSize: 12 }}
              >
                한국
              </button>
              <button
                type="button"
                onClick={() => setTab("us")}
                className={`flex-1 min-w-[52px] h-full flex items-center justify-center transition-colors ${
                  tab === "us" ? "text-white" : "opacity-40"
                }`}
                style={{ fontSize: 12 }}
              >
                미국
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_FILES}
            onChange={handleFileChange}
            multiple
            className="hidden"
          />
        </div>

        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#0a0a0f]/95 backdrop-blur-md border-t border-white/6 px-4 pt-3 pb-5 z-10">
          {editSessionId ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 py-3.5 rounded-[10px] font-semibold border border-white/15 bg-white/5 text-white/80 hover:bg-white/8 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{ fontSize: 15, fontWeight: 500 }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!canSubmit || loading}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[10px] font-semibold transition-all ${
                  !canSubmit || loading ? "bg-white/5 text-white/30 cursor-not-allowed" : "bg-[#618EFF] text-white shadow-xl shadow-[#2C3D6B]/40"
                }`}
                style={{ fontSize: 15, fontWeight: 500 }}
              >
                {loading
                  ? `${PROGRESS_LABELS[progressStep]} 중 (${progressPercent}%)`
                  : "수정완료"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!canSubmit || loading}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-[10px] font-semibold transition-all ${
                !canSubmit || loading ? "bg-white/5 text-white/30 cursor-not-allowed" : "bg-[#618EFF] text-white shadow-xl shadow-[#2C3D6B]/40"
              }`}
              style={{ fontSize: 15, fontWeight: 500 }}
            >
              {loading
                ? `${PROGRESS_LABELS[progressStep]} 중 (${progressPercent}%)`
                : "리포트 작성"}
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-red-400 text-sm font-medium mb-1">오류</p>
            <pre className="text-red-300/90 text-xs whitespace-pre-wrap break-words font-mono">{error}</pre>
          </div>
        )}
        {successMessage && <p className="text-[#618EFF] text-sm mt-4">{successMessage}</p>}
      </div>
    </div>
  );
}
