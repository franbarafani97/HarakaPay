import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

const PASSWORD = "password123";
let passwordHash: string;
let agent: ReturnType<typeof request.agent>;
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

  const submitter = await prisma.user.create({
    data: {
      name: "Sara",
      email: "sara@example.com",
      passwordHash,
      role: "submitter",
    },
  });
  const approver = await prisma.user.create({
    data: {
      name: "Marcus",
      email: "marcus@example.com",
      passwordHash,
      role: "approver",
    },
  });
  submitterId = submitter.id;
  approverId = approver.id;

  const vendor = await prisma.vendor.create({
    data: { name: "Acme Cleaning Co", paymentMethod: "ach" },
  });
  vendorId = vendor.id;

  agent = request.agent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email: "sara@example.com", password: PASSWORD });

  await prisma.bill.createMany({
    data: [
      {
        vendorId,
        invoiceNumber: "INV-001",
        amountCents: 12_500,
        issueDate: new Date("2026-04-01"),
        dueDate: new Date("2026-05-10"),
        status: "approved",
        submittedById: submitterId,
        approvedById: approverId,
      },
      {
        vendorId,
        invoiceNumber: "INV-002",
        amountCents: 33_000,
        issueDate: new Date("2026-04-05"),
        dueDate: new Date("2026-05-15"),
        status: "paid",
        submittedById: submitterId,
        approvedById: approverId,
        paymentDate: new Date("2026-05-04"),
        paymentConfirmation: "PAY-DEADBEEFCAFE",
      },
    ],
  });
});

afterAll(async () => {
  await prisma.bill.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

describe("GET /api/v1/export/bills.csv", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/api/v1/export/bills.csv");
    expect(res.status).toBe(401);
  });

  it("returns CSV with human-readable header row and one row per bill", async () => {
    const res = await agent.get("/api/v1/export/bills.csv");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toMatch(
      /attachment;\s*filename="bills-\d{4}-\d{2}-\d{2}\.csv"/,
    );

    const lines = res.text.trim().split("\n");
    expect(lines[0]).toBe(
      "Vendor,Invoice #,Amount (USD),Currency,Issued,Due,Status,Payment date,Confirmation #,Submitted by,Approver,Memo,GL code,Rejection reason",
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("INV-001");
    expect(lines[1]).toContain("Acme Cleaning Co");
    expect(lines[1]).toContain("125.00");
    expect(lines[1]).toContain("Approved");
    expect(lines[1]).toContain("Sara");
    expect(lines[2]).toContain("INV-002");
    expect(lines[2]).toContain("330.00");
    expect(lines[2]).toContain("Paid");
    expect(lines[2]).toContain("PAY-DEADBEEFCAFE");
    expect(lines[2]).toContain("Marcus");
  });

  it("filters by status", async () => {
    const res = await agent.get("/api/v1/export/bills.csv?status=paid");
    const lines = res.text.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("INV-002");
  });

  it("escapes vendor names containing commas and quotes", async () => {
    const tricky = await prisma.vendor.create({
      data: { name: 'Foo, "Bar" Co', paymentMethod: "ach" },
    });
    await prisma.bill.create({
      data: {
        vendorId: tricky.id,
        invoiceNumber: "TRK-001",
        amountCents: 1000,
        issueDate: new Date(),
        dueDate: new Date(),
        status: "draft",
        submittedById: submitterId,
      },
    });

    const res = await agent.get("/api/v1/export/bills.csv");
    expect(res.text).toContain('"Foo, ""Bar"" Co"');
  });
});
