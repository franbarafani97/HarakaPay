import path from "node:path";
import fs from "node:fs";
import { Router } from "express";
import multer from "multer";
import { ApiError } from "../lib/api-error";
import { isDemoAllowAllApprovals, isDemoSkipLogin } from "../lib/demo-mode";
import { requireAuth } from "../middleware/auth";
import { mockInvoiceExtraction, parseInvoice, runOcr } from "../services/ocr";
import {
  createSession,
  getSession,
  publish,
  subscribe,
  updateSession,
} from "../services/scan-sessions";

const DEMO_MOCK_DELAY_MS = 600;

const SCAN_UPLOADS_PATH = path.resolve(process.cwd(), "uploads", "scans");
const MAX_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(SCAN_UPLOADS_PATH, { recursive: true });
      cb(null, SCAN_UPLOADS_PATH);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "") || ".jpg";
      cb(null, `${req.params.id}${ext}`);
    },
  }),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new ApiError(400, "INVALID_FILE_TYPE", "Only images are allowed"));
      return;
    }
    cb(null, true);
  },
});

export const scanSessionsRouter = Router();

scanSessionsRouter.post("/", requireAuth, (req, res) => {
  const session = createSession(req.user!.userId);
  res.json({
    id: session.id,
    expiresAt: session.expiresAt.toISOString(),
  });
});

scanSessionsRouter.get("/:id/events", requireAuth, (req, res) => {
  const session = getSession(String(req.params.id));
  if (!session) {
    res.status(404).json({
      error: {
        code: "SESSION_NOT_FOUND",
        message: "Session not found or expired",
      },
    });
    return;
  }
  if (session.userId !== req.user!.userId) {
    res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "Not your session" } });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(
    `data: ${JSON.stringify({
      status: session.status,
      result: session.result,
      error: session.error,
    })}\n\n`,
  );

  const unsubscribe = subscribe(session.id, res);

  req.on("close", () => {
    unsubscribe();
  });
});

scanSessionsRouter.post(
  "/:id/upload",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return next(
          new ApiError(413, "FILE_TOO_LARGE", "File exceeds 10 MB limit"),
        );
      }
      if (err) return next(err);
      next();
    });
  },
  async (req, res) => {
    const sessionId = String(req.params.id);
    const session = getSession(sessionId);
    if (!session) {
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
      throw new ApiError(
        404,
        "SESSION_NOT_FOUND",
        "Session not found or expired",
      );
    }
    if (session.status !== "pending") {
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
      throw new ApiError(
        409,
        "SESSION_USED",
        "This session has already been used",
      );
    }
    if (!req.file) {
      throw new ApiError(400, "FILE_REQUIRED", "Expected a 'file' field");
    }

    const filePath = req.file.path;
    updateSession(sessionId, {
      status: "uploaded",
      uploadedFilePath: filePath,
    });
    publish(sessionId, { status: "uploaded" });

    res.json({ ok: true });

    const demoMode = isDemoSkipLogin() || isDemoAllowAllApprovals();

    void (async () => {
      try {
        let result;
        if (demoMode) {
          await new Promise((r) => setTimeout(r, DEMO_MOCK_DELAY_MS));
          result = mockInvoiceExtraction();
        } else {
          const text = await runOcr(filePath);
          result = parseInvoice(text);
        }
        updateSession(sessionId, { status: "processed", result });
        publish(sessionId, { status: "processed", result });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        updateSession(sessionId, { status: "failed", error: message });
        publish(sessionId, { status: "failed", error: message });
      } finally {
        await fs.promises.unlink(filePath).catch(() => {});
      }
    })();
  },
);
