import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../auth.js";
import { normalizeExternalId } from "../channels/catalog.js";
import { prisma } from "../db.js";

const channelSchema = z.object({
  name: z.string().min(1).max(120),
  platform: z.enum(["youtube", "twitch", "kick", "other"]),
  externalId: z.string().min(1).max(200),
  url: z.string().url().optional(),
});

export async function channelRoutes(app: FastifyInstance) {
  app.get("/channels/mine", { preHandler: authenticate }, async (request) => {
    const channels = await prisma.channel.findMany({
      where: { ownerId: request.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { surveys: true } },
      },
    });
    return { channels };
  });

  app.post("/channels", { preHandler: authenticate }, async (request, reply) => {
    const body = channelSchema.parse(request.body);
    const externalId = normalizeExternalId(body.externalId);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.user.id },
    });

    if (user.role === "viewer") {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "channel_owner" },
      });
    }

    const existing = await prisma.channel.findUnique({
      where: {
        platform_externalId: {
          platform: body.platform,
          externalId,
        },
      },
    });

    if (existing?.ownerId && existing.ownerId !== request.user.id) {
      return reply.code(409).send({ error: "Channel already registered" });
    }

    // Claim a discovery catalog row, or create a fresh owned channel.
    const channel = existing
      ? await prisma.channel.update({
          where: { id: existing.id },
          data: {
            ownerId: request.user.id,
            name: body.name,
            url: body.url ?? existing.url,
            source: "owner",
            verified: existing.verified,
            handle: existing.handle || (!externalId.startsWith("UC") ? externalId : existing.handle),
          },
        })
      : await prisma.channel.create({
          data: {
            ownerId: request.user.id,
            name: body.name,
            platform: body.platform,
            externalId,
            url: body.url,
            source: "owner",
            handle: externalId.startsWith("UC") ? null : externalId,
          },
        });

    return reply.code(existing ? 200 : 201).send({ channel });
  });

  app.get("/channels/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const channel = await prisma.channel.findUnique({
      where: { id },
      include: {
        surveys: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!channel || channel.ownerId !== request.user.id) {
      return reply.code(404).send({ error: "Channel not found" });
    }
    return { channel };
  });
}
