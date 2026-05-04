import jwt from "jsonwebtoken";
import { z } from "zod";

const SECRET = process.env.JWT_SECRET ?? "dev-jwt-secret";
const EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60;

const SessionPayloadSchema = z.object({
  userId: z.string(),
  role: z.enum(["submitter", "approver"]),
});

export type SessionPayload = z.infer<typeof SessionPayloadSchema>;

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN_SECONDS });
}

export function verifySession(token: string): SessionPayload {
  const decoded = jwt.verify(token, SECRET);
  return SessionPayloadSchema.parse(decoded);
}
