import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../auth.js";
import { prisma } from "../db.js";

const heartbeatSchema = z.object({
  platform: z.enum(["youtube", "twitch", "kick", "other"]),
  channelId: z.string().min(1).max(200),
  channelName: z.string().min(1).max(200),
  videoId: z.string().max(200).optional(),
  videoTitle: z.string().max(500).optional(),
  secondsWatched: z.number().int().min(1).max(120),
  isLive: z.boolean().optional(),
  url: z.string().url(),
  startedAt: z.string().datetime(),
  clientSessionId: z.string().min(4).max(80).optional(),
  playing: z.boolean().optional(),
});

export async function watchRoutes(app: FastifyInstance) {
  app.post("/watch/heartbeat", { preHandler: authenticate }, async (request, reply) => {
    const body = heartbeatSchema.parse(request.body);

    // Extension should only send while playing; reject paused ticks defensively.
    if (body.playing === false) {
      return reply.code(400).send({ error: "Paused playback is not tracked" });
    }

    let session;

    if (body.clientSessionId) {
      const existing = await prisma.watchSession.findFirst({
        where: {
          userId: request.user.id,
          clientSessionId: body.clientSessionId,
        },
      });

      if (existing) {
        session = await prisma.watchSession.update({
          where: { id: existing.id },
          data: {
            secondsWatched: existing.secondsWatched + body.secondsWatched,
            lastSeenAt: new Date(),
            videoTitle: body.videoTitle ?? existing.videoTitle,
            channelName: body.channelName,
            url: body.url,
            isLive: body.isLive ?? existing.isLive,
          },
        });
      } else {
        session = await prisma.watchSession.create({
          data: {
            userId: request.user.id,
            platform: body.platform,
            channelId: body.channelId,
            channelName: body.channelName,
            videoId: body.videoId,
            videoTitle: body.videoTitle,
            secondsWatched: body.secondsWatched,
            isLive: body.isLive ?? false,
            url: body.url,
            clientSessionId: body.clientSessionId,
            startedAt: new Date(body.startedAt),
            lastSeenAt: new Date(),
          },
        });
      }
    } else {
      // Legacy fallback: merge recent same-video heartbeats.
      const windowStart = new Date(Date.now() - 15 * 60 * 1000);
      const existing = await prisma.watchSession.findFirst({
        where: {
          userId: request.user.id,
          platform: body.platform,
          channelId: body.channelId,
          videoId: body.videoId ?? null,
          lastSeenAt: { gte: windowStart },
        },
        orderBy: { lastSeenAt: "desc" },
      });

      if (existing) {
        session = await prisma.watchSession.update({
          where: { id: existing.id },
          data: {
            secondsWatched: existing.secondsWatched + body.secondsWatched,
            lastSeenAt: new Date(),
            videoTitle: body.videoTitle ?? existing.videoTitle,
            channelName: body.channelName,
            url: body.url,
            isLive: body.isLive ?? existing.isLive,
          },
        });
      } else {
        session = await prisma.watchSession.create({
          data: {
            userId: request.user.id,
            platform: body.platform,
            channelId: body.channelId,
            channelName: body.channelName,
            videoId: body.videoId,
            videoTitle: body.videoTitle,
            secondsWatched: body.secondsWatched,
            isLive: body.isLive ?? false,
            url: body.url,
            startedAt: new Date(body.startedAt),
            lastSeenAt: new Date(),
          },
        });
      }
    }

    return {
      session: {
        id: session.id,
        clientSessionId: session.clientSessionId,
        secondsWatched: session.secondsWatched,
        channelName: session.channelName,
        platform: session.platform,
      },
    };
  });

  app.get("/watch/stats", { preHandler: authenticate }, async (request) => {
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const sessions = await prisma.watchSession.findMany({
      where: {
        userId: request.user.id,
        lastSeenAt: { gte: since },
      },
      orderBy: { lastSeenAt: "desc" },
    });

    const totalSeconds = sessions.reduce((sum, s) => sum + s.secondsWatched, 0);
    const byPlatform: Record<string, number> = {};
    const byChannel: Record<string, { name: string; seconds: number; platform: string }> =
      {};

    for (const s of sessions) {
      byPlatform[s.platform] = (byPlatform[s.platform] ?? 0) + s.secondsWatched;
      const key = `${s.platform}:${s.channelId}`;
      if (!byChannel[key]) {
        byChannel[key] = {
          name: s.channelName,
          seconds: 0,
          platform: s.platform,
        };
      }
      byChannel[key].seconds += s.secondsWatched;
    }

    return {
      date: since.toISOString().slice(0, 10),
      totalSeconds,
      totalMinutes: Math.floor(totalSeconds / 60),
      byPlatform,
      channels: Object.entries(byChannel).map(([id, data]) => ({
        id,
        ...data,
        minutes: Math.floor(data.seconds / 60),
      })),
      recentSessions: sessions.slice(0, 20).map((s) => ({
        id: s.id,
        clientSessionId: s.clientSessionId,
        platform: s.platform,
        channelName: s.channelName,
        videoTitle: s.videoTitle,
        secondsWatched: s.secondsWatched,
        isLive: s.isLive,
        lastSeenAt: s.lastSeenAt,
      })),
    };
  });
}
