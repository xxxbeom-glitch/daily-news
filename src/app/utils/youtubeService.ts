/**
 * YouTube 시황 영상 검색
 * 1. 매일경제TV: 제목에 '[간밤 미국은]' 포함, 당일 업로드
 * 2. 채널K 글로벌: '체크인 뉴욕' 플레이리스트에서 당일 업로드
 */

const MKE_CHANNEL_ID = "UCnfwIKyFYRuqZzzKBDt6JOA"; // 매일경제TV @MKeconomy_TV
const KIWOOM_HANDLE = "kiwoomchk_global"; // 채널K 글로벌 by 키움증권 @kiwoomchk_global
const CHECKIN_NEWYORK_PLAYLIST_TITLE = "체크인 뉴욕";

function getYouTubeApiKey(): string {
  const key = (import.meta.env.VITE_YOUTUBE_API_KEY as string) ?? "";
  return key.trim().replace(/^["']|["']$/g, "");
}

/** KST 기준 오늘 00:00:00을 ISO 문자열로 (YouTube API용) */
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

/** 매일경제TV: '[간밤 미국은]' 제목 포함, 당일 업로드 */
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
    q: "[간밤 미국은]",
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
      channelTitle: s?.channelTitle ?? "매일경제TV",
      channelId: s?.channelId ?? MKE_CHANNEL_ID,
      publishedAt: s?.publishedAt ?? "",
    });
  }
  return results;
}

/** 채널K 글로벌: '체크인 뉴욕' 플레이리스트에서 당일 업로드 영상 */
async function fetchCheckinNewYorkVideos(
  apiKey: string,
  publishedAfter: string,
  seen: Set<string>
): Promise<YouTubeMarketVideo[]> {
  // 1. 채널 ID 조회 (forHandle)
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
    console.warn("[YouTube] 채널K 글로벌 채널을 찾을 수 없습니다.");
    return [];
  }

  const channelTitle = channelRes.items?.[0]?.snippet?.title ?? "채널K 글로벌 by 키움증권";

  // 2. 채널의 플레이리스트 목록
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
    console.warn("[YouTube] '체크인 뉴욕' 플레이리스트를 찾을 수 없습니다.");
    return [];
  }

  // 3. 플레이리스트 항목 (최신순, 당일 것만 사용)
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

    // 당일 업로드만
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

export async function searchYouTubeMarketVideos(): Promise<YouTubeMarketVideo[]> {
  const apiKey = getYouTubeApiKey();
  if (!apiKey) {
    throw new Error("YouTube API 키가 없습니다. .env에 VITE_YOUTUBE_API_KEY를 추가하세요.");
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
