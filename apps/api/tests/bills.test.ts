import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

let agent: ReturnType<typeof request.agent>;
let vendorId: string;

beforeEach(async () => {
  await prisma.bill.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
  agent = request.agent(app);
  await agent
    .post("/api/v1/auth/register")
    .send({ name: "Test", email: "test@example.com", password: "password123" });
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

const validBill = () => ({
  vendorId,
  invoiceNumber: "INV-001",
  amountCents: 12_500,
  issueDate: "2026-04-01T00:00:00.000Z",
  dueDate: "2026-05-01T00:00:00.000Z",
});

describe("POST /api/v1/bills", () => {
  it("creates a bill in draft with a created activity", async () => {
    const res = await agent.post("/api/v1/bills").send(validBill());

    expect(res.status).toBe(201);
    expect(res.body.bill.status).toBe("draft");
    expect(res.body.bill.amountCents).toBe(12_500);
    expect(res.body.bill.vendor.name).toBe("Acme Cleaning Co");
    expect(res.body.bill.activities).toHaveLength(1);
    expect(res.body.bill.activities[0].type).toBe("created");
  });

  it("persists line items when provided", async () => {
    const res = await agent.post("/api/v1/bills").send({
      ...validBill(),
      lineItems: [
        { description: "Office cleaning", amountCents: 8_000, glCode: "5400" },
        { description: "Window washing", amountCents: 4_500 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.bill.lineItems).toHaveLength(2);
    expect(res.body.bill.lineItems[0].description).toBe("Office cleaning");
  });

  it("rejects with 400 when vendor doesn't exist", async () => {
    const res = await agent
      .post("/api/v1/bills")
      .send({ ...validBill(), vendorId: "missing-id" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VENDOR_NOT_FOUND");
  });

  it("rejects with 400 when amount is non-positive", async () => {
    const res = await agent
      .post("/api/v1/bills")
      .send({ ...validBill(), amountCents: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("requires auth", async () => {
    const res = await request(app).post("/api/v1/bills").send(validBill());
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/bills", () => {
  beforeEach(async () => {
    const otherVendor = await prisma.vendor.create({
      data: { name: "Vega Legal LLP", paymentMethod: "wire" },
    });
    await prisma.bill.createMany({
      data: [
        {
          vendorId,
          invoiceNumber: "INV-001",
          amountCents: 10_000,
          issueDate: new Date("2026-04-01"),
          dueDate: new Date("2026-05-10"),
          status: "draft",
        },
        {
          vendorId,
          invoiceNumber: "INV-002",
          amountCents: 25_000,
          issueDate: new Date("2026-04-05"),
          dueDate: new Date("2026-05-15"),
          status: "pending_approval",
        },
        {
          vendorId: otherVendor.id,
          invoiceNumber: "VG-100",
          amountCents: 50_000,
          issueDate: new Date("2026-04-10"),
          dueDate: new Date("2026-05-20"),
          status: "approved",
        },
      ],
    });
  });

  it("lists bills sorted by due date ascending by default", async () => {
    const res = await agent.get("/api/v1/bills");
    expect(res.status).toBe(200);
    expect(res.body.bills).toHaveLength(3);
    expect(res.body.bills[0].invoiceNumber).toBe("INV-001");
    expect(res.body.bills[2].invoiceNumber).toBe("VG-100");
  });

  it("filters by status", async () => {
    const res = await agent.get("/api/v1/bills?status=approved");
    expect(res.status).toBe(200);
    expect(res.body.bills).toHaveLength(1);
    expect(res.body.bills[0].invoiceNumber).toBe("VG-100");
  });

  it("filters by vendorId", async () => {
    const res = await agent.get(`/api/v1/bills?vendorId=${vendorId}`);
    expect(res.status).toBe(200);
    expect(res.body.bills).toHaveLength(2);
  });

  it("searches by invoice number and vendor name", async () => {
    const byInvoice = await agent.get("/api/v1/bills?q=VG-100");
    expect(byInvoice.body.bills).toHaveLength(1);

    const byVendor = await agent.get("/api/v1/bills?q=vega");
    expect(byVendor.body.bills).toHaveLength(1);
    expect(byVendor.body.bills[0].vendor.name).toBe("Vega Legal LLP");
  });

  it("sorts by amount descending when sort=-amountCents", async () => {
    const res = await agent.get("/api/v1/bills?sort=-amountCents");
    expect(res.body.bills[0].amountCents).toBe(50_000);
    expect(res.body.bills[2].amountCents).toBe(10_000);
  });

  it("paginates with cursor", async () => {
    const first = await agent.get("/api/v1/bills?limit=2");
    expect(first.body.bills).toHaveLength(2);
    expect(first.body.nextCursor).not.toBeNull();

    const second = await agent.get(
      `/api/v1/bills?limit=2&cursor=${first.body.nextCursor}`,
    );
    expect(second.body.bills).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/v1/bills");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/bills/:id", () => {
  it("returns bill with vendor, line items, and activity", async () => {
    const created = await agent.post("/api/v1/bills").send({
      ...validBill(),
      lineItems: [{ description: "Item A", amountCents: 5_000 }],
    });

    const res = await agent.get(`/api/v1/bills/${created.body.bill.id}`);

    expect(res.status).toBe(200);
    expect(res.body.bill.invoiceNumber).toBe("INV-001");
    expect(res.body.bill.vendor.name).toBe("Acme Cleaning Co");
    expect(res.body.bill.lineItems).toHaveLength(1);
    expect(res.body.bill.activities).toHaveLength(1);
    expect(res.body.bill.activities[0].type).toBe("created");
  });

  it("returns 404 for unknown id", async () => {
    const res = await agent.get("/api/v1/bills/missing-id");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BILL_NOT_FOUND");
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/v1/bills/anything");
    expect(res.status).toBe(401);
  });
});
