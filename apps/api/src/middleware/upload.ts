import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import type { RequestHandler } from "express";
import { ApiError } from "../lib/api-error";

export const UPLOADS_PATH = path.resolve(process.cwd(), "uploads");

const MAX_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(UPLOADS_PATH, { recursive: true });
      cb(null, UPLOADS_PATH);
    },
    filename: (req, _file, cb) => cb(null, `${req.params.id}.pdf`),
  }),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new ApiError(400, "INVALID_FILE_TYPE", "Only PDF files are allowed"));
      return;
    }
    cb(null, true);
  },
});

export const uploadPdf: RequestHandler = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return next(
        new ApiError(413, "FILE_TOO_LARGE", "File exceeds 10 MB limit"),
      );
    }
    if (err) return next(err);
    if (!req.file) {
      return next(
        new ApiError(400, "FILE_REQUIRED", "Expected a 'file' field"),
      );
    }
    next();
  });
};
