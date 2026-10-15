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

export function extractYouTube(): WatchContext | null {
  const url = location.href;
  if (!url.includes("/watch") && !url.includes("/live") && !url.includes("/shorts/")) {
    return null;
  }

  const params = new URLSearchParams(location.search);
  const videoId =
    params.get("v") ||
    location.pathname.match(/\/shorts\/([^/?]+)/)?.[1] ||
    location.pathname.match(/\/live\/([^/?]+)/)?.[1] ||
    undefined;

  const videoTitle =
    text(document.querySelector("h1.ytd-watch-metadata yt-formatted-string")) ||
    text(document.querySelector("h1.title")) ||
    document.title.replace(/ - YouTube$/, "");

  const channelAnchor =
    document.querySelector<HTMLAnchorElement>(
      "ytd-channel-name a, #channel-name a, ytd-video-owner-renderer a",
    ) || null;

  const channelName =
    text(channelAnchor) ||
    text(document.querySelector("#owner-name a")) ||
    "Unknown channel";

  let channelId = "unknown";
  const href = channelAnchor?.getAttribute("href") || "";
  const channelMatch =
    href.match(/\/channel\/([^/?]+)/) ||
    href.match(/\/@([^/?]+)/) ||
    href.match(/\/c\/([^/?]+)/) ||
    href.match(/\/user\/([^/?]+)/);
  if (channelMatch) channelId = channelMatch[1];

  const isLive = Boolean(
    document.querySelector(".ytp-live, .badge-style-type-live-now-alternate"),
  );

  if (!videoId && channelId === "unknown") return null;

  return {
    platform: "youtube",
    channelId,
    channelName,
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

  // Skip directory / settings style pages
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
  const channelName =
    text(document.querySelector("h1[data-a-target='stream-title']")) ||
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
    text(document.querySelector("h1")) ||
    text(document.querySelector("[class*='username']")) ||
    channelId;
  const videoTitle =
    text(document.querySelector("[class*='stream-title'], h3, h2")) ||
    document.title.replace(/ \| Kick$/, "");

  return {
    platform: "kick",
    channelId,
    channelName,
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
