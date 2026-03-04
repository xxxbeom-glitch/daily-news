/** Blob을 내부저장소에 저장 (ZIP 등) */
export async function saveBlobToLocalStorage(
  blob: Blob,
  filename: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
      const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "ZIP 파일", accept: { "application/zip": [".zip"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "저장 실패";
    return { ok: false, error: msg };
  }
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (res: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

/** 구글 OAuth 토큰 획득 (사용자 제스처에서 호출) */
function getGoogleAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      reject(new Error("VITE_GOOGLE_CLIENT_ID가 설정되지 않았습니다. .env에 추가해주세요."));
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google 로그인 스크립트를 불러오는 중입니다. 잠시 후 다시 시도해주세요."));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (res) => {
        if (res.error) {
          reject(new Error(res.error));
        } else if (res.access_token) {
          resolve(res.access_token);
        } else {
          reject(new Error("인증이 취소되었습니다."));
        }
      },
    });
    client.requestAccessToken();
  });
}

/** 구글 드라이브에 Blob 업로드 (ZIP 등) */
export async function uploadBlobToGoogleDrive(
  blob: Blob,
  filename: string,
  mimeType: string
): Promise<{ ok: boolean; fileId?: string; error?: string }> {
  try {
    const token = await getGoogleAccessToken();
    const boundary = "-------" + Date.now().toString(16);
    const metadata = JSON.stringify({ name: filename, mimeType });
    const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`;
    const mediaHeader = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const endPart = `\r\n--${boundary}--`;
    const zipBuf = await blob.arrayBuffer();
    const body = new Blob(
      [metaPart, mediaHeader, zipBuf, endPart],
      { type: `multipart/related; boundary=${boundary}` }
    );

    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: err.error?.message || `업로드 실패 (${res.status})`,
      };
    }
    const result = await res.json();
    return { ok: true, fileId: result.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "업로드 실패";
    return { ok: false, error: msg };
  }
}

