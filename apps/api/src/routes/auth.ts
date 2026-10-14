import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, signToken } from "../auth.js";
import { prisma } from "../db.js";
import { parseJson } from "../matching.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(80),
  role: z.enum(["viewer", "channel_owner"]).default("viewer"),
  age: z.number().int().min(13).max(120).optional(),
  gender: z
    .enum(["male", "female", "non_binary", "prefer_not_to_say"])
    .optional(),
  country: z.string().min(2).max(56).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const profileSchema = z.object({
  displayName: z.string().min(2).max(80).optional(),
  age: z.number().int().min(13).max(120).nullable().optional(),
  gender: z
    .enum(["male", "female", "non_binary", "prefer_not_to_say"])
    .nullable()
    .optional(),
  country: z.string().min(2).max(56).nullable().optional(),
  languages: z.array(z.string()).optional(),
});

function publicUser(user: {
  id: string;
  email: string;
  displayName: string;
  role: string;
  age: number | null;
  gender: string | null;
  country: string | null;
  languages: string;
  balanceCents: number;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    age: user.age,
    gender: user.gender,
    country: user.country,
    languages: parseJson<string[]>(user.languages, []),
    balanceCents: user.balanceCents,
    createdAt: user.createdAt,
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.code(409).send({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash,
        displayName: body.displayName,
        role: body.role,
        age: body.age,
        gender: body.gender,
        country: body.country,
      },
    });

    const token = signToken(app, {
      id: user.id,
      email: user.email,
      role: user.role as "viewer" | "channel_owner" | "admin",
    });

    return { token, user: publicUser(user) };
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (!user) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const token = signToken(app, {
      id: user.id,
      email: user.email,
      role: user.role as "viewer" | "channel_owner" | "admin",
    });

    return { token, user: publicUser(user) };
  });

  app.get("/auth/me", { preHandler: authenticate }, async (request) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.user.id },
    });
    return { user: publicUser(user) };
  });

  app.patch("/auth/me", { preHandler: authenticate }, async (request) => {
    const body = profileSchema.parse(request.body);
    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: {
        displayName: body.displayName,
        age: body.age === undefined ? undefined : body.age,
        gender: body.gender === undefined ? undefined : body.gender,
        country: body.country === undefined ? undefined : body.country,
        languages:
          body.languages === undefined
            ? undefined
            : JSON.stringify(body.languages),
      },
    });
    return { user: publicUser(user) };
  });
}
