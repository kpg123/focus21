import type { Platform } from "@focus21/shared";
import { prisma } from "../db.js";

const BAD_NAME = /^(unknown channel|null|undefined|unknown)$/i;
const CATEGORY_YEAR = /^[A-Za-z][A-Za-z /&-]{1,40}\s*[•·|]\s*(19|20)\d{2}$/;

export function isUsableChannelName(name: string | null | undefined): boolean {
  const value = (name || "").trim();
  if (!value || value.length < 2 || value.length > 120) return false;
  if (BAD_NAME.test(value)) return false;
  if (CATEGORY_YEAR.test(value)) return false;
  return true;
}

export function normalizeExternalId(externalId: string): string {
  return externalId.trim().replace(/^@/, "");
}

function looksLikeExternalId(value: string): boolean {
  const v = value.trim();
  return /^UC[\w-]{20,}$/.test(v) || v.toLowerCase() === "unknown";
}

function preferName(existing: string, incoming: string, externalId: string): string {
  const next = incoming.trim();
  const prev = existing.trim();

  // Never "upgrade" to a raw id or unusable metadata.
  if (!isUsableChannelName(next) || looksLikeExternalId(next)) {
    return isUsableChannelName(prev) ? prev : next || externalId;
  }

  if (!isUsableChannelName(prev) || looksLikeExternalId(prev)) return next;

  // Prefer a human display name over a handle that merely mirrors the id.
  if (prev.toLowerCase() === externalId.toLowerCase() && next.toLowerCase() !== prev.toLowerCase()) {
    return next;
  }

  return prev;
}

export interface DiscoverChannelInput {
  platform: Platform;
  externalId: string;
  name: string;
  url?: string | null;
  handle?: string | null;
}

/**
 * Upsert a platform channel discovered from watch heartbeats.
 * Unowned catalog rows can later be claimed by a creator registering the same externalId.
 */
export async function findOrCreateChannel(input: DiscoverChannelInput) {
  const externalId = normalizeExternalId(input.externalId);
  if (!externalId || externalId.toLowerCase() === "unknown") {
    return null;
  }

  const incomingName = isUsableChannelName(input.name)
    ? input.name.trim()
    : "";
  const handle = input.handle
    ? normalizeExternalId(input.handle)
    : externalId.startsWith("UC")
      ? null
      : externalId;

  const existing = await prisma.channel.findUnique({
    where: {
      platform_externalId: {
        platform: input.platform,
        externalId,
      },
    },
  });

  if (existing) {
    return prisma.channel.update({
      where: { id: existing.id },
      data: {
        name: preferName(
          existing.name,
          incomingName || existing.name,
          externalId,
        ),
        handle: existing.handle || handle,
        url: input.url || existing.url,
        source: existing.ownerId ? existing.source : "discovery",
      },
    });
  }

  return prisma.channel.create({
    data: {
      platform: input.platform,
      externalId,
      name: incomingName || handle || externalId,
      handle,
      url: input.url ?? null,
      source: "discovery",
      ownerId: null,
      verified: false,
    },
  });
}
