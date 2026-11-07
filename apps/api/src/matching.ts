import type { Gender, Platform, SurveyTargeting } from "@focus21/shared";

export interface ViewerStats {
  age?: number | null;
  gender?: string | null;
  country?: string | null;
  dailyWatchMinutes: number;
  platformMinutes: Partial<Record<Platform, number>>;
  watchedChannelIds: string[];
}

export function matchesTargeting(
  viewer: ViewerStats,
  targeting: SurveyTargeting,
): boolean {
  if (
    targeting.minDailyWatchMinutes != null &&
    viewer.dailyWatchMinutes < targeting.minDailyWatchMinutes
  ) {
    return false;
  }

  if (targeting.minAge != null && (viewer.age == null || viewer.age < targeting.minAge)) {
    return false;
  }

  if (targeting.maxAge != null && (viewer.age == null || viewer.age > targeting.maxAge)) {
    return false;
  }

  if (
    targeting.genders?.length &&
    (!viewer.gender || !targeting.genders.includes(viewer.gender as Gender))
  ) {
    return false;
  }

  if (
    targeting.countries?.length &&
    (!viewer.country || !targeting.countries.includes(viewer.country))
  ) {
    return false;
  }

  if (targeting.platforms?.length) {
    const hasPlatform = targeting.platforms.some(
      (p) => (viewer.platformMinutes[p] ?? 0) > 0,
    );
    if (!hasPlatform) return false;
  }

  if (targeting.channelIds?.length) {
    const watchedTarget = targeting.channelIds.some((id) =>
      viewer.watchedChannelIds.includes(id),
    );
    if (!watchedTarget) return false;
  }

  return true;
}

export function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
