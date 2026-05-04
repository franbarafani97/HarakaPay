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
import { errorHandler } from "./middleware/error-handler";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
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

app.use(errorHandler);
