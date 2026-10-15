import type {
  Demographics,
  Gender,
  Platform,
  SurveyQuestion,
  SurveyStatus,
  SurveyTargeting,
  UserRole,
} from "@focus21/shared";

export type {
  Demographics,
  Gender,
  Platform,
  SurveyQuestion,
  SurveyStatus,
  SurveyTargeting,
  UserRole,
};

export interface JwtUser {
  id: string;
  email: string;
  role: UserRole;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}
