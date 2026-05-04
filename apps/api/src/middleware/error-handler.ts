import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { ApiError } from "../lib/api-error";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: err.flatten(),
      },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL", message: "Internal server error" },
  });
};
