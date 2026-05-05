import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth";
import { vendorsRouter } from "./routes/vendors";
import { billsRouter } from "./routes/bills";
import { dashboardRouter } from "./routes/dashboard";
import { exportRouter } from "./routes/export";
import { scanSessionsRouter } from "./routes/scan-sessions";
import { errorHandler } from "./middleware/error-handler";

export const app = express();

app.use(helmet());

const LAN_ORIGIN_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (process.env.NODE_ENV === "production") {
        const allowed = process.env.WEB_ORIGIN ?? "http://localhost:5173";
        return cb(null, origin === allowed);
      }
      return cb(null, LAN_ORIGIN_RE.test(origin));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/v1/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/vendors", vendorsRouter);
app.use("/api/v1/bills", billsRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/export", exportRouter);
app.use("/api/v1/scan-sessions", scanSessionsRouter);

app.use(errorHandler);
