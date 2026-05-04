import { Router } from "express";
import { LoginRequestSchema, RegisterRequestSchema } from "@harakapay/shared";
import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../lib/password";
import { signSession } from "../lib/jwt";
import { ApiError } from "../lib/api-error";
import { requireAuth } from "../middleware/auth";

const COOKIE_NAME = "session";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: SEVEN_DAYS_MS,
  path: "/",
};

type DbUser = {
  id: string;
  email: string;
  name: string;
  role: "submitter" | "approver";
  createdAt: Date;
};

function publicUser(u: DbUser) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { name, email, password } = RegisterRequestSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "EMAIL_TAKEN", "Email is already registered");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: "submitter" },
  });

  const token = signSession({ userId: user.id, role: user.role });
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = LoginRequestSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "Email or password is incorrect",
    );
  }

  const token = signSession({ userId: user.id, role: user.role });
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.json({ user: publicUser(user) });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.status(204).send();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
  });
  if (!user) {
    throw new ApiError(401, "INVALID_SESSION", "User no longer exists");
  }
  res.json({ user: publicUser(user) });
});
