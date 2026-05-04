import type { RequestHandler } from "express";
import { ApiError } from "../lib/api-error";
import { verifySession, type SessionPayload } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: SessionPayload;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.session;
  if (!token) {
    return next(new ApiError(401, "UNAUTHENTICATED", "Not signed in"));
  }
  try {
    req.user = verifySession(token);
    next();
  } catch {
    next(new ApiError(401, "INVALID_SESSION", "Session is invalid or expired"));
  }
};

export const requireRole = (role: "submitter" | "approver"): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "UNAUTHENTICATED", "Not signed in"));
    }
    if (req.user.role !== role) {
      return next(new ApiError(403, "FORBIDDEN", `${role} role required`));
    }
    next();
  };
};
