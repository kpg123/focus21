import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { JwtUser, UserRole } from "./types.js";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    const user = request.user as JwtUser;
    if (!roles.includes(user.role)) {
      reply.code(403).send({ error: "Forbidden" });
    }
  };
}

export function signToken(app: FastifyInstance, user: JwtUser): string {
  return app.jwt.sign(user, { expiresIn: "30d" });
}
