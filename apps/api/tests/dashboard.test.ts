import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

const PASSWORD = "password123";
let passwordHash: string;
let vendorId: string;
let submitterId: string;
let approverId: string;

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 10);
});

beforeEach(async () => {
  await prisma.bill.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();

  const [submitter, approver] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Sara",
        email: "sara@example.com",
        passwordHash,
        role: "submitter",
      },
    }),
    prisma.user.create({
      data: {
        name: "Marcus",
        email: "marcus@example.com",
        passwordHash,
        role: "approver",
      },
    }),
  ]);
  submitterId = submitter.id;
  approverId = approver.id;

  const vendor = await prisma.vendor.create({
    data: { name: "Acme Cleaning Co", paymentMethod: "ach" },
  });
  vendorId = vendor.id;
});

afterAll(async () => {
  await prisma.bill.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

async function agentAs(role: "submitter" | "approver") {
  const a = request.agent(app);
  const email =
    role === "submitter" ? "sara@example.com" : "marcus@example.com";
  await a.post("/api/v1/auth/login").send({ email, password: PASSWORD });
  return a;
}

const baseBill = (overrides: Record<string, unknown>) => ({
  vendorId,
  invoiceNumber: `INV-${Math.random().toString(36).slice(2, 8)}`,
  amountCents: 10_000,
  issueDate: new Date("2026-04-01"),
  dueDate: new Date("2026-05-15"),
  submittedById: submitterId,
  ...overrides,
});

describe("GET /api/v1/dashboard/summary", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/api/v1/dashboard/summary");
    expect(res.status).toBe(401);
  });

  it("approver sees count of all pending_approval bills", async () => {
    await prisma.bill.createMany({
      data: [
        baseBill({ status: "pending_approval", submittedById: submitterId }),
        baseBill({ status: "pending_approval", submittedById: submitterId }),
        baseBill({ status: "pending_approval", submittedById: approverId }),
        baseBill({ status: "draft", submittedById: submitterId }),
      ],
    });

    const a = await agentAs("approver");
    const res = await a.get("/api/v1/dashboard/summary");

    expect(res.status).toBe(200);
    expect(res.body.needsMyApproval).toBe(3);
  });

  it("submitter sees only their own pending_approval bills", async () => {
    await prisma.bill.createMany({
      data: [
        baseBill({ status: "pending_approval", submittedById: submitterId }),
        baseBill({ status: "pending_approval", submittedById: submitterId }),
        baseBill({ status: "pending_approval", submittedById: approverId }),
      ],
    });

    const a = await agentAs("submitter");
    const res = await a.get("/api/v1/dashboard/summary");

    expect(res.body.needsMyApproval).toBe(2);
  });

  it("counts bills due in the next 7 days, excluding paid and rejected", async () => {
    const now = new Date();
    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const inFifteenDays = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    await prisma.bill.createMany({
      data: [
        baseBill({ status: "approved", dueDate: inThreeDays }),
        baseBill({ status: "scheduled", dueDate: inThreeDays }),
        baseBill({ status: "paid", dueDate: inThreeDays }),
        baseBill({ status: "rejected", dueDate: inThreeDays }),
        baseBill({ status: "approved", dueDate: inFifteenDays }),
      ],
    });

    const a = await agentAs("approver");
    const res = await a.get("/api/v1/dashboard/summary");

    expect(res.body.dueThisWeek).toBe(2);
  });

  it("counts only scheduled bills with paymentDate in the next 7 days", async () => {
    const now = new Date();
    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const inFifteenDays = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    await prisma.bill.createMany({
      data: [
        baseBill({ status: "scheduled", paymentDate: inThreeDays }),
        baseBill({ status: "scheduled", paymentDate: inThreeDays }),
        baseBill({ status: "scheduled", paymentDate: inFifteenDays }),
        baseBill({ status: "approved", paymentDate: inThreeDays }),
      ],
    });

    const a = await agentAs("approver");
    const res = await a.get("/api/v1/dashboard/summary");

    expect(res.body.scheduledThisWeek).toBe(2);
  });

  it("aggregates paid bills since start of current month", async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const fiveDaysAfterStart = new Date(
      startOfMonth.getTime() + 5 * 24 * 60 * 60 * 1000,
    );
    const lastMonth = new Date(
      startOfMonth.getTime() - 5 * 24 * 60 * 60 * 1000,
    );

    await prisma.bill.createMany({
      data: [
        baseBill({
          status: "paid",
          paymentDate: fiveDaysAfterStart,
          amountCents: 12_000,
        }),
        baseBill({
          status: "paid",
          paymentDate: fiveDaysAfterStart,
          amountCents: 33_500,
        }),
        baseBill({
          status: "paid",
          paymentDate: lastMonth,
          amountCents: 999_999,
        }),
        baseBill({ status: "scheduled", paymentDate: fiveDaysAfterStart }),
      ],
    });

    const a = await agentAs("approver");
    const res = await a.get("/api/v1/dashboard/summary");

    expect(res.body.paidThisMonth).toEqual({
      count: 2,
      totalCents: 45_500,
    });
  });

  it("returns zero counts when there are no bills", async () => {
    const a = await agentAs("approver");
    const res = await a.get("/api/v1/dashboard/summary");

    expect(res.body).toEqual({
      needsMyApproval: 0,
      dueThisWeek: 0,
      scheduledThisWeek: 0,
      paidThisMonth: { count: 0, totalCents: 0 },
    });
  });
});
