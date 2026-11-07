export type Platform = "youtube" | "twitch" | "kick" | "other";

export type Gender = "male" | "female" | "non_binary" | "prefer_not_to_say";

export type UserRole = "viewer" | "channel_owner" | "admin";

export type SurveyStatus = "draft" | "active" | "paused" | "completed";

export type SurveyQuestionType = "single" | "multi" | "text" | "rating";

export interface Demographics {
  age?: number;
  gender?: Gender;
  country?: string;
  languages?: string[];
}

export interface SurveyTargeting {
  minDailyWatchMinutes?: number;
  platforms?: Platform[];
  genders?: Gender[];
  minAge?: number;
  maxAge?: number;
  countries?: string[];
  channelIds?: string[];
}

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  prompt: string;
  options?: string[];
  required?: boolean;
}

export interface WatchHeartbeatPayload {
  platform: Platform;
  channelId: string;
  channelName: string;
  videoId?: string;
  videoTitle?: string;
  secondsWatched: number;
  isLive?: boolean;
  url: string;
  startedAt: string;
  /** Stable id for one continuous play bout; new id = new backend session. */
  clientSessionId?: string;
  playing?: boolean;
}

export interface SurveyOffer {
  id: string;
  title: string;
  description: string;
  rewardCents: number;
  estimatedMinutes: number;
  channelName: string;
  expiresAt: string;
}

export const PLATFORM_HOSTS: Record<Platform, string[]> = {
  youtube: ["www.youtube.com", "youtube.com", "m.youtube.com"],
  twitch: ["www.twitch.tv", "twitch.tv"],
  kick: ["kick.com", "www.kick.com"],
  other: [],
};

export function detectPlatform(hostname: string): Platform {
  const host = hostname.replace(/^www\./, "");
  if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
  if (host.includes("twitch.tv")) return "twitch";
  if (host.includes("kick.com")) return "kick";
  return "other";
}
