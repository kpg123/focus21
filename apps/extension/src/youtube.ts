export interface YouTubeChannelInfo {
  channelId: string;
  channelName: string;
  handle?: string;
  url?: string;
}

export interface YouTubeVideoInfo {
  videoId?: string;
  videoTitle?: string;
  isLive?: boolean;
  channel: YouTubeChannelInfo | null;
}

const BAD_NAME = /^(unknown channel|null|undefined)$/i;
const CATEGORY_YEAR = /^[A-Za-z][A-Za-z /&-]{1,40}\s*[•·|]\s*(19|20)\d{2}$/;

export function looksLikeChannelName(name: string | null | undefined): boolean {
  const value = (name || "").trim();
  if (!value || value.length < 2 || value.length > 100) return false;
  if (BAD_NAME.test(value)) return false;
  if (CATEGORY_YEAR.test(value)) return false;
  return true;
}

export function parseChannelHref(href: string | null | undefined): {
  channelId?: string;
  handle?: string;
} {
  if (!href) return {};
  const channel = href.match(/\/channel\/([^/?#]+)/);
  if (channel) return { channelId: decodeURIComponent(channel[1]) };
  const handle = href.match(/\/@([^/?#]+)/);
  if (handle) return { handle: decodeURIComponent(handle[1]) };
  const legacy =
    href.match(/\/c\/([^/?#]+)/) || href.match(/\/user\/([^/?#]+)/);
  if (legacy) return { handle: decodeURIComponent(legacy[1]) };
  return {};
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function readString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/** Pull author/channel fields from ytInitialPlayerResponse-style JSON. */
export function extractFromPlayerResponse(
  playerResponse: unknown,
): YouTubeVideoInfo | null {
  const root = asRecord(playerResponse);
  if (!root) return null;
  const videoDetails = asRecord(root.videoDetails);
  if (!videoDetails) return null;

  const videoId = readString(videoDetails.videoId);
  const videoTitle = readString(videoDetails.title);
  const channelId = readString(videoDetails.channelId);
  const channelName = readString(videoDetails.author);
  const isLive =
    videoDetails.isLive === true ||
    videoDetails.isLiveContent === true ||
    false;

  if (!channelId && !channelName && !videoId) return null;

  return {
    videoId,
    videoTitle,
    isLive,
    channel:
      channelId || channelName
        ? {
            channelId: channelId || "unknown",
            channelName: looksLikeChannelName(channelName)
              ? (channelName as string)
              : channelId || "Unknown channel",
            url: channelId
              ? `https://www.youtube.com/channel/${channelId}`
              : undefined,
          }
        : null,
  };
}

/**
 * Walk ytInitialData for the video owner renderer on watch pages.
 * Kept tolerant — YouTube rearranges these trees often.
 */
export function extractFromInitialData(initialData: unknown): YouTubeChannelInfo | null {
  const queue: unknown[] = [initialData];
  const seen = new Set<unknown>();

  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);

    const rec = node as Record<string, unknown>;

    const videoOwner = asRecord(rec.videoOwnerRenderer);
    if (videoOwner) {
      const title = asRecord(videoOwner.title);
      const runs = Array.isArray(title?.runs) ? title.runs : [];
      const firstRun = asRecord(runs[0]);
      const name = readString(firstRun?.text);
      const nav = asRecord(firstRun?.navigationEndpoint);
      const browse = asRecord(nav?.browseEndpoint);
      const canonical = asRecord(nav?.commandMetadata)
        ? asRecord(
            (asRecord(nav?.commandMetadata) as Record<string, unknown>)
              .webCommandMetadata,
          )
        : null;
      const href = readString(canonical?.url, browse?.canonicalBaseUrl);
      const parsed = parseChannelHref(href);
      const channelId =
        readString(browse?.browseId) || parsed.channelId || parsed.handle;
      if (channelId || looksLikeChannelName(name)) {
        return {
          channelId: channelId || "unknown",
          channelName: looksLikeChannelName(name)
            ? (name as string)
            : parsed.handle || channelId || "Unknown channel",
          handle: parsed.handle,
          url: href
            ? href.startsWith("http")
              ? href
              : `https://www.youtube.com${href}`
            : undefined,
        };
      }
    }

    for (const value of Object.values(rec)) {
      if (value && typeof value === "object") queue.push(value);
    }
  }

  return null;
}

export function mergeChannelInfo(
  ...parts: Array<Partial<YouTubeChannelInfo> | null | undefined>
): YouTubeChannelInfo | null {
  let channelId = "";
  let channelName = "";
  let handle: string | undefined;
  let url: string | undefined;

  for (const part of parts) {
    if (!part) continue;
    if (!channelId && part.channelId && part.channelId !== "unknown") {
      channelId = part.channelId;
    }
    if (!looksLikeChannelName(channelName) && looksLikeChannelName(part.channelName)) {
      channelName = part.channelName!.trim();
    }
    if (!handle && part.handle) handle = part.handle;
    if (!url && part.url) url = part.url;
  }

  if (!channelId && handle) channelId = handle;
  if (!channelName && handle) channelName = handle;
  if (!channelId && !channelName) return null;

  return {
    channelId: channelId || "unknown",
    channelName: looksLikeChannelName(channelName)
      ? channelName
      : handle || channelId || "Unknown channel",
    handle,
    url,
  };
}
