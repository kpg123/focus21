import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { ZodError } from "zod";
import { authRoutes } from "./routes/auth.js";
import { channelRoutes } from "./routes/channels.js";
import { surveyRoutes } from "./routes/surveys.js";
import { watchRoutes } from "./routes/watch.js";

const PORT = Number(process.env.PORT ?? 4000);
const JWT_SECRET = process.env.JWT_SECRET ?? "focus21-dev-secret";
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: [WEB_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  });
  await app.register(jwt, { secret: JWT_SECRET });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Validation failed",
        details: error.flatten(),
      });
    }
    app.log.error(error);
    const err = error as Error & { statusCode?: number };
    const status = err.statusCode ?? 500;
    return reply.code(status).send({
      error: err.message || "Internal server error",
    });
  });

  app.get("/health", async () => ({
    ok: true,
    service: "focus21-api",
    time: new Date().toISOString(),
  }));

  await app.register(authRoutes);
  await app.register(watchRoutes);
  await app.register(channelRoutes);
  await app.register(surveyRoutes);

  await app.listen({ port: PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
