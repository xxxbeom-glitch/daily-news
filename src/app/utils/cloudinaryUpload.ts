/**
 * Cloudinary 이미지 업로드
 * base64 → Cloudinary 업로드 → URL 반환
 */

const CLOUD_NAME = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string)?.trim();
const UPLOAD_PRESET = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string)?.trim();

export function isCloudinaryEnabled(): boolean {
  return !!(CLOUD_NAME && UPLOAD_PRESET);
}

/**
 * base64 이미지를 Cloudinary에 업로드하고 URL 반환
 */
export async function uploadBase64ToCloudinary(
  base64: string,
  mimeType = "image/jpeg"
): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary 설정이 없습니다. (.env에 VITE_CLOUDINARY_* 확인)");
  }
  const dataUrl = base64.startsWith("data:") ? base64 : `data:${mimeType};base64,${base64}`;

  const formData = new FormData();
  formData.append("file", dataUrl);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Cloudinary 업로드 실패 (${res.status})`);
  }

  const data = (await res.json()) as { secure_url?: string };
  if (!data.secure_url) throw new Error("Cloudinary 응답에 URL이 없습니다.");
  return data.secure_url;
}

/** URL 이미지를 fetch하여 base64로 변환 (AI API용) */
export async function fetchUrlToBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`이미지 로드 실패: ${url}`);
  const blob = await res.blob();
  const mimeType = blob.type || "image/jpeg";
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({ data: base64 ?? "", mimeType });
    };
    reader.onerror = () => reject(new Error("base64 변환 실패"));
    reader.readAsDataURL(blob);
  });
}
