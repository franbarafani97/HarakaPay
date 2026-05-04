import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import type { BillStatus } from "@harakapay/shared";
import { TRANSITIONS } from "@harakapay/shared";
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

  agent = request.agent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email: "sara@example.com", password: PASSWORD });

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

async function makeBill(
  status: BillStatus,
  overrides: Partial<{
    submittedById: string;
    approvedById: string;
    paymentDate: Date;
  }> = {},
) {
  return prisma.bill.create({
    data: {
      vendorId,
      invoiceNumber: `INV-${Math.random().toString(36).slice(2, 8)}`,
      amountCents: 10_000,
      issueDate: new Date("2026-04-01"),
      dueDate: new Date("2026-05-15"),
      submittedById: overrides.submittedById ?? submitterId,
      status,
      ...(overrides.approvedById && { approvedById: overrides.approvedById }),
      ...(overrides.paymentDate && { paymentDate: overrides.paymentDate }),
    },
  });
}

const validBill = () => ({
  vendorId,
  invoiceNumber: "INV-001",
  amountCents: 12_500,
  issueDate: "2026-04-01T00:00:00.000Z",
  dueDate: "2026-05-01T00:00:00.000Z",
});

function transitionPayload(to: BillStatus) {
  switch (to) {
    case "rejected":
      return { to, rejectionReason: "Missing receipt" };
    case "scheduled":
      return { to, paymentDate: "2026-06-01T00:00:00.000Z" };
    default:
      return { to };
  }
}

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
    expect(res.body.bills[0].invoiceNumber).toBe("INV-001");
    expect(res.body.bills[2].invoiceNumber).toBe("VG-100");
  });

  it("filters by status", async () => {
    const res = await agent.get("/api/v1/bills?status=approved");
    expect(res.body.bills).toHaveLength(1);
  });

  it("filters by vendorId", async () => {
    const res = await agent.get(`/api/v1/bills?vendorId=${vendorId}`);
    expect(res.body.bills).toHaveLength(2);
  });

  it("searches by invoice number and vendor name", async () => {
    expect((await agent.get("/api/v1/bills?q=VG-100")).body.bills).toHaveLength(
      1,
    );
    expect((await agent.get("/api/v1/bills?q=vega")).body.bills).toHaveLength(
      1,
    );
  });

  it("sorts by amount descending when sort=-amountCents", async () => {
    const res = await agent.get("/api/v1/bills?sort=-amountCents");
    expect(res.body.bills[0].amountCents).toBe(50_000);
  });

  it("paginates with cursor", async () => {
    const first = await agent.get("/api/v1/bills?limit=2");
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
    expect(res.body.bill.lineItems).toHaveLength(1);
    expect(res.body.bill.activities).toHaveLength(1);
  });

  it("returns 404 for unknown id", async () => {
    const res = await agent.get("/api/v1/bills/missing-id");
    expect(res.status).toBe(404);
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/v1/bills/anything");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/bills/:id/transition — allowed matrix", () => {
  for (const t of TRANSITIONS) {
    it(`${t.from} -> ${t.to} is allowed for ${t.role}`, async () => {
      const seedExtras: { approvedById?: string; paymentDate?: Date } = {};
      if (t.from === "approved" || t.from === "scheduled") {
        seedExtras.approvedById = approverId;
      }
      if (t.from === "scheduled") {
        seedExtras.paymentDate = new Date("2026-06-01");
      }
      const bill = await makeBill(t.from, seedExtras);
      const a = await agentAs(t.role);
      const res = await a
        .post(`/api/v1/bills/${bill.id}/transition`)
        .send(transitionPayload(t.to));

      expect(res.status).toBe(200);
      expect(res.body.bill.status).toBe(t.to);
      expect(
        res.body.bill.activities[res.body.bill.activities.length - 1].type,
      ).toBeDefined();
    });

    it(`${t.from} -> ${t.to} is denied for the other role`, async () => {
      const seedExtras: { approvedById?: string; paymentDate?: Date } = {};
      if (t.from === "approved" || t.from === "scheduled") {
        seedExtras.approvedById = approverId;
      }
      if (t.from === "scheduled") {
        seedExtras.paymentDate = new Date("2026-06-01");
      }
      const bill = await makeBill(t.from, seedExtras);
      const wrongRole = t.role === "submitter" ? "approver" : "submitter";
      const a = await agentAs(wrongRole);
      const res = await a
        .post(`/api/v1/bills/${bill.id}/transition`)
        .send(transitionPayload(t.to));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("STATE_TRANSITION_NOT_ALLOWED");
    });
  }
});

describe("POST /api/v1/bills/:id/transition — invalid transitions", () => {
  const invalid: Array<{ from: BillStatus; to: BillStatus }> = [
    { from: "draft", to: "approved" },
    { from: "draft", to: "paid" },
    { from: "paid", to: "draft" },
    { from: "paid", to: "approved" },
    { from: "rejected", to: "approved" },
    { from: "approved", to: "draft" },
  ];

  for (const c of invalid) {
    it(`rejects ${c.from} -> ${c.to} with 409`, async () => {
      const seed =
        c.from === "approved" || c.from === "scheduled"
          ? { approvedById: approverId }
          : {};
      const bill = await makeBill(c.from, seed);
      const a = await agentAs("approver");
      const res = await a
        .post(`/api/v1/bills/${bill.id}/transition`)
        .send(transitionPayload(c.to));

      expect(res.status).toBe(409);
    });
  }
});

describe("POST /api/v1/bills/:id/transition — payload effects", () => {
  it("rejects 'rejected' without rejectionReason (400)", async () => {
    const bill = await makeBill("pending_approval");
    const a = await agentAs("approver");
    const res = await a
      .post(`/api/v1/bills/${bill.id}/transition`)
      .send({ to: "rejected" });
    expect(res.status).toBe(400);
  });

  it("rejects 'scheduled' without paymentDate (400)", async () => {
    const bill = await makeBill("approved", { approvedById: approverId });
    const a = await agentAs("approver");
    const res = await a
      .post(`/api/v1/bills/${bill.id}/transition`)
      .send({ to: "scheduled" });
    expect(res.status).toBe(400);
  });

  it("approve sets approvedById and writes 'approved' activity", async () => {
    const bill = await makeBill("pending_approval");
    const a = await agentAs("approver");
    const res = await a
      .post(`/api/v1/bills/${bill.id}/transition`)
      .send({ to: "approved" });

    expect(res.body.bill.approvedById).toBe(approverId);
    const last = res.body.bill.activities.at(-1);
    expect(last.type).toBe("approved");
  });

  it("reject stores reason and writes 'rejected' activity", async () => {
    const bill = await makeBill("pending_approval");
    const a = await agentAs("approver");
    const res = await a
      .post(`/api/v1/bills/${bill.id}/transition`)
      .send({ to: "rejected", rejectionReason: "Wrong invoice" });

    expect(res.body.bill.rejectionReason).toBe("Wrong invoice");
    expect(res.body.bill.activities.at(-1).type).toBe("rejected");
  });

  it("schedule stores paymentDate", async () => {
    const bill = await makeBill("approved", { approvedById: approverId });
    const a = await agentAs("approver");
    const res = await a
      .post(`/api/v1/bills/${bill.id}/transition`)
      .send({ to: "scheduled", paymentDate: "2026-06-15T00:00:00.000Z" });

    expect(res.body.bill.paymentDate).toBe("2026-06-15T00:00:00.000Z");
    expect(res.body.bill.status).toBe("scheduled");
  });

  it("paid generates a confirmation number", async () => {
    const bill = await makeBill("scheduled", {
      approvedById: approverId,
      paymentDate: new Date("2026-06-15"),
    });
    const a = await agentAs("approver");
    const res = await a
      .post(`/api/v1/bills/${bill.id}/transition`)
      .send({ to: "paid" });

    expect(res.body.bill.paymentConfirmation).toMatch(/^PAY-/);
  });
});

describe("POST /api/v1/bills/bulk-transition", () => {
  it("approves multiple pending bills as approver", async () => {
    const bills = await Promise.all([
      makeBill("pending_approval"),
      makeBill("pending_approval"),
      makeBill("pending_approval"),
    ]);
    const a = await agentAs("approver");
    const res = await a
      .post("/api/v1/bills/bulk-transition")
      .send({ billIds: bills.map((b) => b.id), to: "approved" });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(3);
    expect(res.body.results.every((r: { success: boolean }) => r.success)).toBe(
      true,
    );
  });

  it("returns per-bill errors for ones in the wrong state", async () => {
    const ok = await makeBill("pending_approval");
    const wrong = await makeBill("draft");
    const a = await agentAs("approver");
    const res = await a
      .post("/api/v1/bills/bulk-transition")
      .send({ billIds: [ok.id, wrong.id], to: "approved" });

    expect(res.status).toBe(200);
    expect(
      res.body.results.find((r: { id: string }) => r.id === ok.id).success,
    ).toBe(true);
    expect(
      res.body.results.find((r: { id: string }) => r.id === wrong.id).success,
    ).toBe(false);
  });

  it("rejects bulk to non-approved targets", async () => {
    const a = await agentAs("approver");
    const res = await a
      .post("/api/v1/bills/bulk-transition")
      .send({ billIds: ["x"], to: "paid" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BULK_NOT_SUPPORTED");
  });

  it("denies submitter bulk-approve (each item denied)", async () => {
    const bill = await makeBill("pending_approval");
    const a = await agentAs("submitter");
    const res = await a
      .post("/api/v1/bills/bulk-transition")
      .send({ billIds: [bill.id], to: "approved" });

    expect(res.body.results[0].success).toBe(false);
  });
});

describe("PATCH /api/v1/bills/:id", () => {
  it("edits a draft bill and writes 'edited' activity", async () => {
    const bill = await makeBill("draft");
    const res = await agent
      .patch(`/api/v1/bills/${bill.id}`)
      .send({ amountCents: 99_000, memo: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.bill.amountCents).toBe(99_000);
    expect(res.body.bill.memo).toBe("Updated");
    expect(res.body.bill.activities.at(-1).type).toBe("edited");
  });

  it("edits a rejected bill", async () => {
    const bill = await makeBill("rejected", { approvedById: approverId });
    const res = await agent
      .patch(`/api/v1/bills/${bill.id}`)
      .send({ memo: "Fixed" });
    expect(res.status).toBe(200);
  });

  it("rejects edits when status is approved (409)", async () => {
    const bill = await makeBill("approved", { approvedById: approverId });
    const res = await agent
      .patch(`/api/v1/bills/${bill.id}`)
      .send({ memo: "x" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BILL_NOT_EDITABLE");
  });

  it("replaces line items when provided", async () => {
    const bill = await makeBill("draft");
    await prisma.lineItem.create({
      data: { billId: bill.id, description: "Old", amountCents: 1_000 },
    });
    const res = await agent.patch(`/api/v1/bills/${bill.id}`).send({
      lineItems: [{ description: "New", amountCents: 2_000 }],
    });

    expect(res.body.bill.lineItems).toHaveLength(1);
    expect(res.body.bill.lineItems[0].description).toBe("New");
  });

  it("returns 404 for unknown id", async () => {
    const res = await agent.patch("/api/v1/bills/missing").send({ memo: "x" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/v1/bills/:id", () => {
  it("deletes a draft bill by its submitter", async () => {
    const bill = await makeBill("draft");
    const res = await agent.delete(`/api/v1/bills/${bill.id}`);
    expect(res.status).toBe(204);
    const after = await prisma.bill.findUnique({ where: { id: bill.id } });
    expect(after).toBeNull();
  });

  it("rejects delete when status is not draft (409)", async () => {
    const bill = await makeBill("pending_approval");
    const res = await agent.delete(`/api/v1/bills/${bill.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BILL_NOT_DELETABLE");
  });

  it("rejects delete when caller isn't the submitter (403)", async () => {
    const bill = await makeBill("draft");
    const a = await agentAs("approver");
    const res = await a.delete(`/api/v1/bills/${bill.id}`);
    expect(res.status).toBe(403);
  });

  it("returns 404 for unknown id", async () => {
    const res = await agent.delete("/api/v1/bills/missing");
    expect(res.status).toBe(404);
  });
});
