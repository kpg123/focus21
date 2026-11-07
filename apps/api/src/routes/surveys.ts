import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SurveyQuestion, SurveyTargeting } from "@focus21/shared";
import { authenticate } from "../auth.js";
import { prisma } from "../db.js";
import { matchesTargeting, parseJson, type ViewerStats } from "../matching.js";

const questionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["single", "multi", "text", "rating"]),
  prompt: z.string().min(1).max(500),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

const targetingSchema = z.object({
  minDailyWatchMinutes: z.number().int().min(0).optional(),
  platforms: z.array(z.enum(["youtube", "twitch", "kick", "other"])).optional(),
  genders: z
    .array(z.enum(["male", "female", "non_binary", "prefer_not_to_say"]))
    .optional(),
  minAge: z.number().int().min(13).optional(),
  maxAge: z.number().int().max(120).optional(),
  countries: z.array(z.string()).optional(),
  channelIds: z.array(z.string()).optional(),
});

const createSurveySchema = z.object({
  channelId: z.string().min(1),
  title: z.string().min(3).max(160),
  description: z.string().min(3).max(2000),
  rewardCents: z.number().int().min(25).max(50000),
  estimatedMinutes: z.number().int().min(1).max(60).default(5),
  maxResponses: z.number().int().min(1).optional(),
  questions: z.array(questionSchema).min(1).max(40),
  targeting: targetingSchema.default({}),
  status: z.enum(["draft", "active"]).default("draft"),
  expiresAt: z.string().datetime().optional(),
});

const answerSchema = z.object({
  answers: z.record(z.union([z.string(), z.array(z.string()), z.number()])),
});

async function getViewerStats(userId: string): Promise<ViewerStats> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const sessions = await prisma.watchSession.findMany({
    where: { userId, lastSeenAt: { gte: since } },
  });

  const platformMinutes: ViewerStats["platformMinutes"] = {};
  const watchedChannelIds = new Set<string>();
  let totalSeconds = 0;

  for (const s of sessions) {
    totalSeconds += s.secondsWatched;
    const platform = s.platform as keyof typeof platformMinutes;
    platformMinutes[platform] =
      (platformMinutes[platform] ?? 0) + Math.floor(s.secondsWatched / 60);
    watchedChannelIds.add(s.channelId);
  }

  return {
    age: user.age,
    gender: user.gender,
    country: user.country,
    dailyWatchMinutes: Math.floor(totalSeconds / 60),
    platformMinutes,
    watchedChannelIds: [...watchedChannelIds],
  };
}

function serializeSurvey(survey: {
  id: string;
  channelId: string;
  title: string;
  description: string;
  status: string;
  rewardCents: number;
  estimatedMinutes: number;
  maxResponses: number | null;
  responseCount: number;
  questionsJson: string;
  targetingJson: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  channel?: { name: string; platform: string };
}) {
  return {
    id: survey.id,
    channelId: survey.channelId,
    title: survey.title,
    description: survey.description,
    status: survey.status,
    rewardCents: survey.rewardCents,
    estimatedMinutes: survey.estimatedMinutes,
    maxResponses: survey.maxResponses,
    responseCount: survey.responseCount,
    questions: parseJson<SurveyQuestion[]>(survey.questionsJson, []),
    targeting: parseJson<SurveyTargeting>(survey.targetingJson, {}),
    createdAt: survey.createdAt,
    updatedAt: survey.updatedAt,
    expiresAt: survey.expiresAt,
    channelName: survey.channel?.name,
    channelPlatform: survey.channel?.platform,
  };
}

export async function surveyRoutes(app: FastifyInstance) {
  app.post("/surveys", { preHandler: authenticate }, async (request, reply) => {
    const body = createSurveySchema.parse(request.body);
    const channel = await prisma.channel.findUnique({
      where: { id: body.channelId },
    });
    if (!channel || channel.ownerId !== request.user.id) {
      return reply.code(404).send({ error: "Channel not found" });
    }

    const survey = await prisma.survey.create({
      data: {
        channelId: body.channelId,
        title: body.title,
        description: body.description,
        rewardCents: body.rewardCents,
        estimatedMinutes: body.estimatedMinutes,
        maxResponses: body.maxResponses,
        questionsJson: JSON.stringify(body.questions),
        targetingJson: JSON.stringify(body.targeting),
        status: body.status,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
      include: { channel: true },
    });

    return reply.code(201).send({ survey: serializeSurvey(survey) });
  });

  app.get("/surveys/mine", { preHandler: authenticate }, async (request) => {
    const surveys = await prisma.survey.findMany({
      where: { channel: { ownerId: request.user.id } },
      include: { channel: true },
      orderBy: { createdAt: "desc" },
    });
    return { surveys: surveys.map(serializeSurvey) };
  });

  app.patch(
    "/surveys/:id/status",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z
        .object({ status: z.enum(["draft", "active", "paused", "completed"]) })
        .parse(request.body);

      const survey = await prisma.survey.findUnique({
        where: { id },
        include: { channel: true },
      });
      if (!survey || survey.channel.ownerId !== request.user.id) {
        return reply.code(404).send({ error: "Survey not found" });
      }

      const updated = await prisma.survey.update({
        where: { id },
        data: { status: body.status },
        include: { channel: true },
      });
      return { survey: serializeSurvey(updated) };
    },
  );

  app.get("/surveys/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        channel: true,
        responses: {
          select: {
            id: true,
            userId: true,
            answersJson: true,
            rewardCents: true,
            createdAt: true,
            user: { select: { displayName: true, age: true, gender: true, country: true } },
          },
        },
      },
    });
    if (!survey) {
      return reply.code(404).send({ error: "Survey not found" });
    }

    const isOwner = survey.channel.ownerId === request.user.id;
    if (!isOwner && survey.status !== "active") {
      return reply.code(404).send({ error: "Survey not found" });
    }

    return {
      survey: serializeSurvey(survey),
      responses: isOwner
        ? survey.responses.map((r) => ({
            id: r.id,
            answers: parseJson(r.answersJson, {}),
            rewardCents: r.rewardCents,
            createdAt: r.createdAt,
            respondent: r.user,
          }))
        : undefined,
    };
  });

  /** Extension + web: pending survey offers for the current viewer */
  app.get("/surveys/offers", { preHandler: authenticate }, async (request) => {
    const now = new Date();
    const offers = await prisma.surveyOffer.findMany({
      where: {
        userId: request.user.id,
        status: "pending",
        expiresAt: { gt: now },
      },
      include: {
        survey: { include: { channel: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return {
      offers: offers.map((o) => ({
        id: o.id,
        surveyId: o.surveyId,
        title: o.survey.title,
        description: o.survey.description,
        rewardCents: o.survey.rewardCents,
        estimatedMinutes: o.survey.estimatedMinutes,
        channelName: o.survey.channel.name,
        expiresAt: o.expiresAt.toISOString(),
        questions: parseJson<SurveyQuestion[]>(o.survey.questionsJson, []),
      })),
    };
  });

  /** Match viewer against active surveys and create offers */
  app.post("/surveys/match", { preHandler: authenticate }, async (request) => {
    const viewer = await getViewerStats(request.user.id);
    const active = await prisma.survey.findMany({
      where: {
        status: "active",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { channel: true },
    });

    const created = [];
    for (const survey of active) {
      if (survey.maxResponses != null && survey.responseCount >= survey.maxResponses) {
        continue;
      }

      const alreadyResponded = await prisma.surveyResponse.findUnique({
        where: {
          surveyId_userId: { surveyId: survey.id, userId: request.user.id },
        },
      });
      if (alreadyResponded) continue;

      const targeting = parseJson<SurveyTargeting>(survey.targetingJson, {});
      if (!matchesTargeting(viewer, targeting)) continue;

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      try {
        const offer = await prisma.surveyOffer.upsert({
          where: {
            surveyId_userId: { surveyId: survey.id, userId: request.user.id },
          },
          create: {
            surveyId: survey.id,
            userId: request.user.id,
            status: "pending",
            expiresAt,
          },
          update: {},
          include: { survey: { include: { channel: true } } },
        });

        if (offer.status === "pending") {
          created.push({
            id: offer.id,
            surveyId: offer.surveyId,
            title: offer.survey.title,
            description: offer.survey.description,
            rewardCents: offer.survey.rewardCents,
            estimatedMinutes: offer.survey.estimatedMinutes,
            channelName: offer.survey.channel.name,
            expiresAt: offer.expiresAt.toISOString(),
          });
        }
      } catch {
        // ignore race on unique constraint
      }
    }

    return { offers: created, viewerStats: viewer };
  });

  app.post(
    "/surveys/offers/:id/seen",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const offer = await prisma.surveyOffer.findFirst({
        where: { id, userId: request.user.id },
      });
      if (!offer) return reply.code(404).send({ error: "Offer not found" });
      await prisma.surveyOffer.update({
        where: { id },
        data: { seenAt: new Date() },
      });
      return { ok: true };
    },
  );

  app.post(
    "/surveys/offers/:id/dismiss",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const offer = await prisma.surveyOffer.findFirst({
        where: { id, userId: request.user.id },
      });
      if (!offer) return reply.code(404).send({ error: "Offer not found" });
      await prisma.surveyOffer.update({
        where: { id },
        data: { status: "dismissed", dismissedAt: new Date() },
      });
      return { ok: true };
    },
  );

  app.post(
    "/surveys/:id/respond",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = answerSchema.parse(request.body);

      const survey = await prisma.survey.findUnique({
        where: { id },
        include: { channel: true },
      });
      if (!survey || survey.status !== "active") {
        return reply.code(404).send({ error: "Survey not available" });
      }
      if (survey.maxResponses != null && survey.responseCount >= survey.maxResponses) {
        return reply.code(409).send({ error: "Survey is full" });
      }

      const existing = await prisma.surveyResponse.findUnique({
        where: {
          surveyId_userId: { surveyId: id, userId: request.user.id },
        },
      });
      if (existing) {
        return reply.code(409).send({ error: "Already responded" });
      }

      const questions = parseJson<SurveyQuestion[]>(survey.questionsJson, []);
      for (const q of questions) {
        if (q.required !== false && body.answers[q.id] == null) {
          return reply.code(400).send({ error: `Missing answer for ${q.id}` });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const response = await tx.surveyResponse.create({
          data: {
            surveyId: id,
            userId: request.user.id,
            answersJson: JSON.stringify(body.answers),
            rewardCents: survey.rewardCents,
          },
        });

        await tx.survey.update({
          where: { id },
          data: { responseCount: { increment: 1 } },
        });

        await tx.user.update({
          where: { id: request.user.id },
          data: { balanceCents: { increment: survey.rewardCents } },
        });

        await tx.surveyOffer.updateMany({
          where: { surveyId: id, userId: request.user.id },
          data: { status: "completed" },
        });

        return response;
      });

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: request.user.id },
      });

      return {
        response: {
          id: result.id,
          rewardCents: result.rewardCents,
          createdAt: result.createdAt,
        },
        balanceCents: user.balanceCents,
      };
    },
  );
}
