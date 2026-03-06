/**
 * YouTube ?쒗솴 ?곸긽 寃??
 * 1. 留ㅼ씪寃쎌젣TV: ?쒕ぉ??'[媛꾨갇 誘멸뎅?]' ?ы븿, ?뱀씪 ?낅줈??
 * 2. 梨꾨꼸K 湲濡쒕쾶: '泥댄겕???댁슃' ?뚮젅?대━?ㅽ듃?먯꽌 ?뱀씪 ?낅줈??
 */

const MKE_CHANNEL_ID = "UCnfwIKyFYRuqZzzKBDt6JOA"; // 留ㅼ씪寃쎌젣TV @MKeconomy_TV
const KIWOOM_HANDLE = "kiwoomchk_global"; // 梨꾨꼸K 湲濡쒕쾶 by ?ㅼ?利앷텒 @kiwoomchk_global
const CHECKIN_NEWYORK_PLAYLIST_TITLE = "泥댄겕???댁슃";

function getYouTubeApiKey(): string {
  const key = (import.meta.env.VITE_YOUTUBE_API_KEY as string) ?? "";
  return key.trim().replace(/^["']|["']$/g, "");
}

/** KST 湲곗? ?ㅻ뒛 00:00:00??ISO 臾몄옄?대줈 (YouTube API?? */
function getTodayStartISO(): string {
  const now = new Date();
  const kr = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kr.getUTCFullYear();
  const m = kr.getUTCMonth();
  const d = kr.getUTCDate();
  const kstMidnightUtc = Date.UTC(y, m, d, 0, 0, 0) - 9 * 60 * 60 * 1000;
  return new Date(kstMidnightUtc).toISOString().slice(0, 19) + "Z";
}

export interface YouTubeMarketVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  viewCount?: string;
}

async function fetchApi<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** 留ㅼ씪寃쎌젣TV: '[媛꾨갇 誘멸뎅?]' ?쒕ぉ ?ы븿, ?뱀씪 ?낅줈??*/
async function fetchMkeVideos(
  apiKey: string,
  publishedAfter: string,
  seen: Set<string>
): Promise<YouTubeMarketVideo[]> {
  const params = new URLSearchParams({
    part: "snippet",
    channelId: MKE_CHANNEL_ID,
    type: "video",
    maxResults: "10",
    order: "date",
    publishedAfter,
    q: "[媛꾨갇 誘멸뎅?]",
    key: apiKey,
  });
  const url = `https://www.googleapis.com/youtube/v3/search?${params}`;

  const json = await fetchApi<{
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        description?: string;
        thumbnails?: { default?: { url?: string }; medium?: { url?: string } };
        channelTitle?: string;
        channelId?: string;
        publishedAt?: string;
      };
    }>;
  }>(url);

  const results: YouTubeMarketVideo[] = [];
  for (const item of json.items ?? []) {
    const videoId = item.id?.videoId;
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);

    const s = item.snippet;
    const thumb = s?.thumbnails?.medium?.url ?? s?.thumbnails?.default?.url ?? "";

    results.push({
      id: videoId,
      title: s?.title ?? "",
      description: s?.description ?? "",
      thumbnailUrl: thumb,
      channelTitle: s?.channelTitle ?? "留ㅼ씪寃쎌젣TV",
      channelId: s?.channelId ?? MKE_CHANNEL_ID,
      publishedAt: s?.publishedAt ?? "",
    });
  }
  return results;
}

/** 梨꾨꼸K 湲濡쒕쾶: '泥댄겕???댁슃' ?뚮젅?대━?ㅽ듃?먯꽌 ?뱀씪 ?낅줈???곸긽 */
async function fetchCheckinNewYorkVideos(
  apiKey: string,
  publishedAfter: string,
  seen: Set<string>
): Promise<YouTubeMarketVideo[]> {
  // 1. 梨꾨꼸 ID 議고쉶 (forHandle)
  const channelParams = new URLSearchParams({
    part: "id,snippet",
    forHandle: KIWOOM_HANDLE,
    key: apiKey,
  });
  const channelRes = await fetchApi<{
    items?: Array<{ id?: string; snippet?: { title?: string } }>;
  }>(`https://www.googleapis.com/youtube/v3/channels?${channelParams}`);

  const channelId = channelRes.items?.[0]?.id;
  if (!channelId) {
    console.warn("[YouTube] 梨꾨꼸K 湲濡쒕쾶 梨꾨꼸??李얠쓣 ???놁뒿?덈떎.");
    return [];
  }

  const channelTitle = channelRes.items?.[0]?.snippet?.title ?? "梨꾨꼸K 湲濡쒕쾶 by ?ㅼ?利앷텒";

  // 2. 梨꾨꼸???뚮젅?대━?ㅽ듃 紐⑸줉
  const playlistParams = new URLSearchParams({
    part: "snippet",
    channelId,
    maxResults: "50",
    key: apiKey,
  });
  const playlistsRes = await fetchApi<{
    items?: Array<{
      id?: string;
      snippet?: { title?: string };
    }>;
  }>(`https://www.googleapis.com/youtube/v3/playlists?${playlistParams}`);

  const targetPlaylist = playlistsRes.items?.find((p) =>
    p.snippet?.title?.includes(CHECKIN_NEWYORK_PLAYLIST_TITLE)
  );
  if (!targetPlaylist?.id) {
    console.warn("[YouTube] '泥댄겕???댁슃' ?뚮젅?대━?ㅽ듃瑜?李얠쓣 ???놁뒿?덈떎.");
    return [];
  }

  // 3. ?뚮젅?대━?ㅽ듃 ??ぉ (理쒖떊?? ?뱀씪 寃껊쭔 ?ъ슜)
  const itemsParams = new URLSearchParams({
    part: "snippet",
    playlistId: targetPlaylist.id,
    maxResults: "10",
    key: apiKey,
  });
  const itemsRes = await fetchApi<{
    items?: Array<{
      snippet?: {
        resourceId?: { videoId?: string };
        title?: string;
        description?: string;
        thumbnails?: { default?: { url?: string }; medium?: { url?: string } };
        publishedAt?: string;
      };
    }>;
  }>(`https://www.googleapis.com/youtube/v3/playlistItems?${itemsParams}`);

  const results: YouTubeMarketVideo[] = [];
  for (const item of itemsRes.items ?? []) {
    const videoId = item.snippet?.resourceId?.videoId;
    const publishedAt = item.snippet?.publishedAt ?? "";
    if (!videoId || seen.has(videoId)) continue;

    // ?뱀씪 ?낅줈?쒕쭔
    if (publishedAt < publishedAfter) continue;
    seen.add(videoId);

    const s = item.snippet;
    const thumb = s?.thumbnails?.medium?.url ?? s?.thumbnails?.default?.url ?? "";

    results.push({
      id: videoId,
      title: s?.title ?? "",
      description: s?.description ?? "",
      thumbnailUrl: thumb,
      channelTitle,
      channelId,
      publishedAt,
    });
  }
  return results;
}

/** URL?먯꽌 YouTube videoId 異붿텧 */
export function extractYouTubeVideoId(url: string): string | null {
  const trimmed = (url || "").trim();
  const m = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** URL로 영상 메타데이터 조회 (제목·설명·업로드일시) */
export async function fetchYouTubeVideoByUrl(
  url: string
): Promise<{ id: string; title: string; description: string; url: string; publishedAt: string }> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) throw new Error("유효하지 않은 유튜브 URL입니다.");
  const apiKey = getYouTubeApiKey();
  if (!apiKey) throw new Error("YouTube API 키가 없습니다. .env에 VITE_YOUTUBE_API_KEY를 추가해주세요.");
  const params = new URLSearchParams({
    part: "snippet",
    id: videoId,
    key: apiKey,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? "영상 정보를 가져올 수 없습니다.");
  }
  const json = (await res.json()) as {
    items?: Array<{
      id?: string;
      snippet?: { title?: string; description?: string; publishedAt?: string };
    }>;
  };
  const item = json.items?.[0];
  if (!item) throw new Error("영상을 찾을 수 없습니다.");
  const s = item.snippet;
  return {
    id: videoId,
    title: s?.title ?? "",
    description: s?.description ?? "",
    url: `https://www.youtube.com/watch?v=${videoId}`,
    publishedAt: s?.publishedAt ?? "",
  };
}

export async function searchYouTubeMarketVideos(): Promise<YouTubeMarketVideo[]> {
  const apiKey = getYouTubeApiKey();
  if (!apiKey) {
    throw new Error("YouTube API 키가 없습니다. .env에 VITE_YOUTUBE_API_KEY를 추가해주세요.");
  }

  const publishedAfter = getTodayStartISO();
  const seen = new Set<string>();
  const results: YouTubeMarketVideo[] = [];

  try {
    const [mkeVideos, checkinVideos] = await Promise.all([
      fetchMkeVideos(apiKey, publishedAfter, seen),
      fetchCheckinNewYorkVideos(apiKey, publishedAfter, seen),
    ]);
    results.push(...mkeVideos, ...checkinVideos);
  } catch (e) {
    console.error("[YouTube] 검색 실패", e);
    throw e;
  }

  results.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
  return results;
}
