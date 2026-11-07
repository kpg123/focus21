import {
  extractFromInitialData,
  extractFromPlayerResponse,
  looksLikeChannelName,
  mergeChannelInfo,
  parseChannelHref,
  type YouTubeChannelInfo,
} from "./youtube";

export type Platform = "youtube" | "twitch" | "kick" | "other";

export interface WatchContext {
  platform: Platform;
  channelId: string;
  channelName: string;
  videoId?: string;
  videoTitle?: string;
  isLive?: boolean;
  url: string;
}

export function detectPlatform(hostname: string): Platform {
  const host = hostname.replace(/^www\./, "");
  if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
  if (host.includes("twitch.tv")) return "twitch";
  if (host.includes("kick.com")) return "kick";
  return "other";
}

function text(el: Element | null | undefined): string {
  return (el?.textContent || "").trim();
}

function readGlobalJson(name: string): unknown {
  const w = window as unknown as Record<string, unknown>;
  if (w[name]) return w[name];

  // Fallback: scrape assigned script blobs YouTube embeds on first paint.
  const scripts = document.querySelectorAll("script");
  for (const script of scripts) {
    const body = script.textContent || "";
    if (!body.includes(name)) continue;
    const marker = `${name} = `;
    const idx = body.indexOf(marker);
    if (idx === -1) continue;
    const start = body.indexOf("{", idx);
    if (start === -1) continue;
    try {
      // Balance braces roughly for the assigned object.
      let depth = 0;
      let end = -1;
      for (let i = start; i < body.length; i++) {
        const ch = body[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      if (end > start) return JSON.parse(body.slice(start, end));
    } catch {
      // keep scanning
    }
  }
  return null;
}

function extractYouTubeFromDom(): {
  videoId?: string;
  videoTitle?: string;
  isLive?: boolean;
  channel: YouTubeChannelInfo | null;
} {
  const params = new URLSearchParams(location.search);
  const videoId =
    params.get("v") ||
    location.pathname.match(/\/shorts\/([^/?]+)/)?.[1] ||
    location.pathname.match(/\/live\/([^/?]+)/)?.[1] ||
    undefined;

  const videoTitle =
    text(document.querySelector("h1.ytd-watch-metadata yt-formatted-string")) ||
    text(document.querySelector("h1.ytd-watch-metadata")) ||
    text(document.querySelector("h1.title yt-formatted-string")) ||
    text(document.querySelector("h1.title")) ||
    document.title.replace(/ - YouTube$/, "");

  // Prefer the owner name link — never the avatar <a>, which has an href but no text.
  const channelAnchor =
    document.querySelector<HTMLAnchorElement>(
      [
        "ytd-video-owner-renderer #channel-name a",
        "ytd-watch-metadata ytd-channel-name a",
        "#upload-info #channel-name a",
        "#owner #channel-name a",
        "ytd-channel-name#channel-name a",
        "#channel-name a",
      ].join(", "),
    ) || null;

  const href =
    channelAnchor?.getAttribute("href") ||
    document
      .querySelector<HTMLAnchorElement>("ytd-video-owner-renderer a[href*='/@'], ytd-video-owner-renderer a[href*='/channel/']")
      ?.getAttribute("href") ||
    "";

  const parsed = parseChannelHref(href);
  const rawName =
    text(channelAnchor) ||
    text(document.querySelector("ytd-video-owner-renderer #channel-name")) ||
    text(document.querySelector("#channel-name yt-formatted-string")) ||
    text(document.querySelector("#owner-name a"));

  const channelName = looksLikeChannelName(rawName)
    ? rawName
    : parsed.handle || "";

  const channel = mergeChannelInfo({
    channelId: parsed.channelId || parsed.handle || "unknown",
    channelName: channelName || "Unknown channel",
    handle: parsed.handle,
    url: href
      ? href.startsWith("http")
        ? href
        : `https://www.youtube.com${href}`
      : undefined,
  });

  const isLive = Boolean(
    document.querySelector(".ytp-live, .badge-style-type-live-now-alternate"),
  );

  return { videoId, videoTitle, isLive, channel };
}

export function extractYouTube(): WatchContext | null {
  const url = location.href;
  if (!url.includes("/watch") && !url.includes("/live") && !url.includes("/shorts/")) {
    return null;
  }

  const fromPlayer = extractFromPlayerResponse(
    readGlobalJson("ytInitialPlayerResponse"),
  );
  const fromData = extractFromInitialData(readGlobalJson("ytInitialData"));
  const fromDom = extractYouTubeFromDom();

  const channel = mergeChannelInfo(
    fromPlayer?.channel,
    fromData,
    fromDom.channel,
  );

  const videoId = fromPlayer?.videoId || fromDom.videoId;
  const videoTitle = fromPlayer?.videoTitle || fromDom.videoTitle;
  const isLive = fromPlayer?.isLive ?? fromDom.isLive;

  if (!videoId && (!channel || channel.channelId === "unknown")) return null;

  return {
    platform: "youtube",
    channelId: channel?.channelId || "unknown",
    channelName: channel?.channelName || "Unknown channel",
    videoId,
    videoTitle,
    isLive,
    url,
  };
}

export function extractTwitch(): WatchContext | null {
  const url = location.href;
  const parts = location.pathname.split("/").filter(Boolean);
  if (!parts.length) return null;

  const blocked = new Set([
    "directory",
    "videos",
    "settings",
    "inventory",
    "wallet",
    "subscriptions",
    "drops",
    "prime",
  ]);
  if (blocked.has(parts[0])) return null;

  const channelId = parts[0].toLowerCase();
  // Stream title is NOT the channel name — prefer login/display from the page header.
  const channelName =
    text(document.querySelector("[data-a-target='user-channel-header-name']")) ||
    text(document.querySelector("h1.tw-title")) ||
    channelId;

  const videoTitle =
    text(document.querySelector("[data-a-target='stream-title']")) ||
    document.title.replace(/ - Twitch$/, "");

  const isLive = Boolean(
    document.querySelector("[data-a-target='player-overlay-live']") ||
      document.querySelector(".live-indicator-container"),
  );

  return {
    platform: "twitch",
    channelId,
    channelName: channelName || channelId,
    videoTitle,
    isLive,
    url,
  };
}

export function extractKick(): WatchContext | null {
  const parts = location.pathname.split("/").filter(Boolean);
  if (!parts.length) return null;
  const blocked = new Set(["categories", "search", "transactions", "dashboard"]);
  if (blocked.has(parts[0])) return null;

  const channelId = parts[0].toLowerCase();
  const channelName =
    text(document.querySelector("a[href='/" + parts[0] + "']")) ||
    text(document.querySelector("[class*='username']")) ||
    channelId;
  const videoTitle =
    text(document.querySelector("[class*='stream-title']")) ||
    text(document.querySelector("h3")) ||
    document.title.replace(/ \| Kick$/, "");

  return {
    platform: "kick",
    channelId,
    channelName: looksLikeChannelName(channelName) ? channelName : channelId,
    videoTitle,
    isLive: true,
    url: location.href,
  };
}

export function extractWatchContext(): WatchContext | null {
  const platform = detectPlatform(location.hostname);
  if (platform === "youtube") return extractYouTube();
  if (platform === "twitch") return extractTwitch();
  if (platform === "kick") return extractKick();
  return null;
}
