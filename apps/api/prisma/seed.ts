import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const viewer = await prisma.user.upsert({
    where: { email: "viewer@focus21.dev" },
    update: {},
    create: {
      email: "viewer@focus21.dev",
      passwordHash,
      displayName: "Alex Viewer",
      role: "viewer",
      age: 26,
      gender: "female",
      country: "US",
      languages: JSON.stringify(["en"]),
      balanceCents: 0,
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: "creator@focus21.dev" },
    update: {},
    create: {
      email: "creator@focus21.dev",
      passwordHash,
      displayName: "Nova Streams",
      role: "channel_owner",
      age: 31,
      gender: "male",
      country: "US",
    },
  });

  const channel = await prisma.channel.upsert({
    where: {
      platform_externalId: { platform: "youtube", externalId: "UC_nova_demo" },
    },
    update: {},
    create: {
      ownerId: owner.id,
      name: "Nova Streams",
      platform: "youtube",
      externalId: "UC_nova_demo",
      url: "https://www.youtube.com/@novastreams",
      verified: true,
    },
  });

  const existingSurvey = await prisma.survey.findFirst({
    where: { channelId: channel.id, title: "Viewer habits pulse" },
  });

  if (!existingSurvey) {
    await prisma.survey.create({
      data: {
        channelId: channel.id,
        title: "Viewer habits pulse",
        description:
          "Help Nova Streams understand how you watch. Earn a reward for ~3 minutes.",
        status: "active",
        rewardCents: 250,
        estimatedMinutes: 3,
        maxResponses: 500,
        questionsJson: JSON.stringify([
          {
            id: "q1",
            type: "single",
            prompt: "How often do you watch this channel?",
            options: ["Daily", "A few times a week", "Weekly", "Rarely"],
            required: true,
          },
          {
            id: "q2",
            type: "multi",
            prompt: "Which formats do you prefer?",
            options: ["Live streams", "VODs", "Shorts", "Podcasts"],
            required: true,
          },
          {
            id: "q3",
            type: "rating",
            prompt: "How likely are you to recommend this channel?",
            required: true,
          },
          {
            id: "q4",
            type: "text",
            prompt: "Anything we should improve?",
            required: false,
          },
        ]),
        targetingJson: JSON.stringify({
          minDailyWatchMinutes: 60,
          genders: ["female", "male", "non_binary"],
          minAge: 18,
          maxAge: 45,
          platforms: ["youtube", "twitch"],
        }),
      },
    });
  }

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const existingWatch = await prisma.watchSession.findFirst({
    where: { userId: viewer.id, channelId: "UC_nova_demo" },
  });
  if (!existingWatch) {
    await prisma.watchSession.create({
      data: {
        userId: viewer.id,
        platform: "youtube",
        channelId: "UC_nova_demo",
        channelName: "Nova Streams",
        videoId: "demo-video-1",
        videoTitle: "Morning grind VOD",
        secondsWatched: 75 * 60,
        isLive: false,
        url: "https://www.youtube.com/watch?v=demo-video-1",
        startedAt: since,
        lastSeenAt: new Date(),
      },
    });
  }

  console.log("Seeded demo users:");
  console.log("  viewer@focus21.dev / password123");
  console.log("  creator@focus21.dev / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
