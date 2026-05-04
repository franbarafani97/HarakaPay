import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import path from "node:path";
import fs from "node:fs";
import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { UPLOADS_PATH } from "../src/middleware/upload";

const PASSWORD = "password123";
let passwordHash: string;
let agent: ReturnType<typeof request.agent>;
let vendorId: string;
let submitterId: string;

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
  submitterId = submitter.id;

  agent = request.agent(app);
  await agent
    .post("/api/v1/auth/login")
    .send({ email: "sara@example.com", password: PASSWORD });

  const vendor = await prisma.vendor.create({
    data: { name: "Acme Cleaning Co", paymentMethod: "ach" },
  });
  vendorId = vendor.id;
});

afterEach(async () => {
  try {
    const files = await fs.promises.readdir(UPLOADS_PATH);
    await Promise.all(
      files.map((f) => fs.promises.unlink(path.join(UPLOADS_PATH, f))),
    );
  } catch {
    // dir doesn't exist or already empty — ignore
  }
});

afterAll(async () => {
  await prisma.bill.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

async function makeBill() {
  return prisma.bill.create({
    data: {
      vendorId,
      invoiceNumber: "INV-001",
      amountCents: 10_000,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      submittedById: submitterId,
      status: "draft",
    },
  });
}

const PDF_BUFFER = Buffer.from("%PDF-1.4\nfake test content");

describe("POST /api/v1/bills/:id/attachment", () => {
  it("uploads a PDF and updates the bill", async () => {
    const bill = await makeBill();
    const res = await agent
      .post(`/api/v1/bills/${bill.id}/attachment`)
      .attach("file", PDF_BUFFER, {
        filename: "invoice.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(200);
    expect(res.body.bill.attachmentFilename).toBe("invoice.pdf");
    expect(res.body.bill.attachmentUrl).toBe(
      `/api/v1/bills/${bill.id}/attachment`,
    );

    const onDisk = path.join(UPLOADS_PATH, `${bill.id}.pdf`);
    expect(fs.existsSync(onDisk)).toBe(true);
  });

  it("rejects non-PDF files with 400", async () => {
    const bill = await makeBill();
    const res = await agent
      .post(`/api/v1/bills/${bill.id}/attachment`)
      .attach("file", Buffer.from("hello"), {
        filename: "x.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_FILE_TYPE");
  });

  it("rejects files over 10 MB with 413", async () => {
    const bill = await makeBill();
    const big = Buffer.alloc(11 * 1024 * 1024);
    const res = await agent
      .post(`/api/v1/bills/${bill.id}/attachment`)
      .attach("file", big, {
        filename: "big.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("returns 400 when no file field is sent", async () => {
    const bill = await makeBill();
    const res = await agent.post(`/api/v1/bills/${bill.id}/attachment`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("FILE_REQUIRED");
  });

  it("returns 404 for missing bill", async () => {
    const res = await agent
      .post("/api/v1/bills/missing-id/attachment")
      .attach("file", PDF_BUFFER, {
        filename: "invoice.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BILL_NOT_FOUND");
  });

  it("requires auth", async () => {
    const bill = await makeBill();
    const res = await request(app)
      .post(`/api/v1/bills/${bill.id}/attachment`)
      .attach("file", PDF_BUFFER, {
        filename: "invoice.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/bills/:id/attachment", () => {
  it("returns the uploaded PDF with correct headers", async () => {
    const bill = await makeBill();
    await agent
      .post(`/api/v1/bills/${bill.id}/attachment`)
      .attach("file", PDF_BUFFER, {
        filename: "invoice.pdf",
        contentType: "application/pdf",
      });

    const res = await agent.get(`/api/v1/bills/${bill.id}/attachment`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("invoice.pdf");
    expect(res.body).toEqual(PDF_BUFFER);
  });

  it("returns 404 when bill has no attachment", async () => {
    const bill = await makeBill();
    const res = await agent.get(`/api/v1/bills/${bill.id}/attachment`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ATTACHMENT_NOT_FOUND");
  });

  it("requires auth", async () => {
    const bill = await makeBill();
    const res = await request(app).get(`/api/v1/bills/${bill.id}/attachment`);
    expect(res.status).toBe(401);
  });
});
