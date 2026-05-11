import { prisma } from "./prisma";
import type { SessionPayload } from "./jwt";

export const DEMO_USER_EMAIL = "demo@harakapay.demo";
export const DEMO_USER_NAME = "Haraka Pay";
export const DEMO_USER_ROLE = "approver" as const;

export function isDemoSkipLogin(): boolean {
  return process.env.DEMO_SKIP_LOGIN === "true";
}

export function isDemoAllowAllApprovals(): boolean {
  return process.env.DEMO_ALLOW_ALL_APPROVALS === "true";
}

let cachedDemoSession: SessionPayload | null = null;

export async function getDemoUserSession(): Promise<SessionPayload> {
  if (cachedDemoSession) return cachedDemoSession;
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
  });
  if (!user) {
    throw new Error(
      `DEMO_SKIP_LOGIN is on but ${DEMO_USER_EMAIL} is missing. Run 'pnpm seed' or unset the flag.`,
    );
  }
  cachedDemoSession = { userId: user.id, role: user.role };
  return cachedDemoSession;
}

export function clearDemoSessionCache(): void {
  cachedDemoSession = null;
}
