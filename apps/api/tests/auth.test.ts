import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

describe("POST /api/v1/auth/register", () => {
  it("creates a user and sets a session cookie", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Sara",
        email: "sara@example.com",
        password: "password123",
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("sara@example.com");
    expect(res.body.user.role).toBe("submitter");
    expect(res.body.user).not.toHaveProperty("passwordHash");

    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies[0]).toMatch(/^session=/);
    expect(cookies[0]).toMatch(/HttpOnly/);
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Sara",
        email: "dup@example.com",
        password: "password123",
      });

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Other",
        email: "dup@example.com",
        password: "password123",
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects a weak password with 400", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Sara", email: "sara@example.com", password: "short" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/auth/login", () => {
  beforeEach(async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Sara",
        email: "sara@example.com",
        password: "password123",
      });
  });

  it("succeeds with correct credentials", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "sara@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("sara@example.com");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects wrong password with 401", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "sara@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects unknown email with 401", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/auth/me", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user with a valid session", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/v1/auth/register")
      .send({
        name: "Sara",
        email: "sara@example.com",
        password: "password123",
      });

    const res = await agent.get("/api/v1/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("sara@example.com");
  });

  it("returns 401 with an invalid token", async () => {
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", "session=garbage");

    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("clears the session cookie", async () => {
    const res = await request(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(204);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies[0]).toMatch(/^session=;/);
  });
});
