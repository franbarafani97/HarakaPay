import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

let agent: ReturnType<typeof request.agent>;

beforeEach(async () => {
  await prisma.bill.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
  agent = request.agent(app);
  await agent
    .post("/api/v1/auth/register")
    .send({ name: "Test", email: "test@example.com", password: "password123" });
});

afterAll(async () => {
  await prisma.bill.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

describe("POST /api/v1/vendors", () => {
  it("creates a vendor", async () => {
    const res = await agent.post("/api/v1/vendors").send({
      name: "Acme Cleaning Co",
      email: "billing@acme.example",
      paymentMethod: "ach",
      defaultGlCode: "5400",
    });

    expect(res.status).toBe(201);
    expect(res.body.vendor.name).toBe("Acme Cleaning Co");
    expect(res.body.vendor.paymentMethod).toBe("ach");
    expect(res.body.vendor.defaultGlCode).toBe("5400");
  });

  it("rejects invalid input with 400", async () => {
    const res = await agent.post("/api/v1/vendors").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("requires auth", async () => {
    const res = await request(app)
      .post("/api/v1/vendors")
      .send({ name: "Acme", paymentMethod: "ach" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/vendors", () => {
  beforeEach(async () => {
    await prisma.vendor.createMany({
      data: [
        { name: "Acme Cleaning Co", paymentMethod: "ach" },
        { name: "Vega Legal LLP", paymentMethod: "wire" },
        { name: "Zeno Office Supplies", paymentMethod: "check" },
      ],
    });
  });

  it("lists all vendors alphabetically", async () => {
    const res = await agent.get("/api/v1/vendors");
    expect(res.status).toBe(200);
    expect(res.body.vendors).toHaveLength(3);
    expect(res.body.vendors[0].name).toBe("Acme Cleaning Co");
    expect(res.body.vendors[2].name).toBe("Zeno Office Supplies");
    expect(res.body.nextCursor).toBeNull();
  });

  it("filters by q (case-insensitive)", async () => {
    const res = await agent.get("/api/v1/vendors?q=acme");
    expect(res.status).toBe(200);
    expect(res.body.vendors).toHaveLength(1);
    expect(res.body.vendors[0].name).toBe("Acme Cleaning Co");
  });

  it("returns nextCursor when more results exist", async () => {
    const res = await agent.get("/api/v1/vendors?limit=2");
    expect(res.status).toBe(200);
    expect(res.body.vendors).toHaveLength(2);
    expect(res.body.nextCursor).not.toBeNull();

    const next = await agent.get(
      `/api/v1/vendors?limit=2&cursor=${res.body.nextCursor}`,
    );
    expect(next.status).toBe(200);
    expect(next.body.vendors).toHaveLength(1);
    expect(next.body.nextCursor).toBeNull();
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/v1/vendors");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/vendors/:id", () => {
  it("returns vendor with empty stats when no bills", async () => {
    const created = await prisma.vendor.create({
      data: { name: "Acme", paymentMethod: "ach" },
    });

    const res = await agent.get(`/api/v1/vendors/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body.vendor.name).toBe("Acme");
    expect(res.body.stats).toEqual({
      totalSpentCents: 0,
      lastPaidAt: null,
      openBillCount: 0,
    });
  });

  it("returns 404 for unknown id", async () => {
    const res = await agent.get("/api/v1/vendors/missing-id");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("VENDOR_NOT_FOUND");
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/v1/vendors/anything");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/v1/vendors/:id", () => {
  it("updates allowed fields", async () => {
    const created = await prisma.vendor.create({
      data: { name: "Old Name", paymentMethod: "ach" },
    });

    const res = await agent
      .patch(`/api/v1/vendors/${created.id}`)
      .send({ name: "New Name", notes: "Updated note" });

    expect(res.status).toBe(200);
    expect(res.body.vendor.name).toBe("New Name");
    expect(res.body.vendor.notes).toBe("Updated note");
  });

  it("returns 404 for unknown id", async () => {
    const res = await agent
      .patch("/api/v1/vendors/missing-id")
      .send({ name: "X" });

    expect(res.status).toBe(404);
  });

  it("rejects invalid input with 400", async () => {
    const created = await prisma.vendor.create({
      data: { name: "X", paymentMethod: "ach" },
    });

    const res = await agent
      .patch(`/api/v1/vendors/${created.id}`)
      .send({ paymentMethod: "bitcoin" });

    expect(res.status).toBe(400);
  });

  it("requires auth", async () => {
    const res = await request(app)
      .patch("/api/v1/vendors/anything")
      .send({ name: "X" });

    expect(res.status).toBe(401);
  });
});
