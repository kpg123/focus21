import type { WatchContext } from "./platforms";

export interface ActiveWatch {
  tabId: number;
  clientSessionId: string;
  mediaKey: string;
  context: WatchContext;
  playing: boolean;
  startedAt: string;
  lastHeartbeatAt: number;
  secondsSent: number;
}

export function mediaKey(ctx: WatchContext): string {
  return `${ctx.platform}:${ctx.channelId}:${ctx.videoId ?? ctx.url}`;
}

export function newClientSessionId(): string {
  return `cs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Last-play wins. Same media on same tab resumes; anything else starts a new session. */
export function claimPlayback(
  current: ActiveWatch | null,
  tabId: number,
  context: WatchContext,
  now = Date.now(),
): ActiveWatch {
  const key = mediaKey(context);
  if (
    current &&
    current.tabId === tabId &&
    current.mediaKey === key
  ) {
    return {
      ...current,
      context,
      playing: true,
      lastHeartbeatAt: current.playing ? current.lastHeartbeatAt : now,
    };
  }

  return {
    tabId,
    clientSessionId: newClientSessionId(),
    mediaKey: key,
    context,
    playing: true,
    startedAt: new Date(now).toISOString(),
    lastHeartbeatAt: now,
    secondsSent: 0,
  };
}

export function pauseIfActive(
  current: ActiveWatch | null,
  tabId: number,
): ActiveWatch | null {
  if (!current || current.tabId !== tabId) return current;
  return { ...current, playing: false };
}

export function clearIfTab(
  current: ActiveWatch | null,
  tabId: number,
): ActiveWatch | null {
  if (!current || current.tabId !== tabId) return current;
  return null;
}

/** Seconds to credit since last heartbeat, only while playing. Cap at 30s. */
export function heartbeatSeconds(
  current: ActiveWatch,
  now = Date.now(),
): number {
  if (!current.playing) return 0;
  const elapsed = Math.floor((now - current.lastHeartbeatAt) / 1000);
  if (elapsed < 1) return 0;
  return Math.min(elapsed, 30);
}
