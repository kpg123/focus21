import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../auth.js";
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
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.user.id },
    });

    if (user.role === "viewer") {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "channel_owner" },
      });
    }

    try {
      const channel = await prisma.channel.create({
        data: {
          ownerId: request.user.id,
          name: body.name,
          platform: body.platform,
          externalId: body.externalId,
          url: body.url,
        },
      });
      return reply.code(201).send({ channel });
    } catch {
      return reply.code(409).send({ error: "Channel already registered" });
    }
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
