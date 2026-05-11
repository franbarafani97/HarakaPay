import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import {
  Prisma,
  type ActivityType,
  type BillStatus,
  type PaymentMethod,
} from "@prisma/client";
import { prisma } from "./lib/prisma";
import {
  DEMO_USER_EMAIL,
  DEMO_USER_NAME,
  DEMO_USER_ROLE,
} from "./lib/demo-mode";

const DEMO_PASSWORD = "demo1234";

async function ensureDemoUser(passwordHash: string) {
  await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: { name: DEMO_USER_NAME, role: DEMO_USER_ROLE },
    create: {
      email: DEMO_USER_EMAIL,
      name: DEMO_USER_NAME,
      role: DEMO_USER_ROLE,
      passwordHash,
    },
  });
}

const VENDORS: Array<{
  name: string;
  email: string;
  paymentMethod: PaymentMethod;
  bankAccountLast4: string | null;
  defaultGlCode: string | null;
  notes: string | null;
}> = [
  {
    name: "Acme Cleaning Co",
    email: "billing@acme-clean.example",
    paymentMethod: "ach",
    bankAccountLast4: "4123",
    defaultGlCode: "5400",
    notes: "Weekly office cleaning",
  },
  {
    name: "North Atlantic Office Supplies",
    email: "ar@noatl.example",
    paymentMethod: "ach",
    bankAccountLast4: "8821",
    defaultGlCode: "5100",
    notes: null,
  },
  {
    name: "Vega Legal LLP",
    email: "billing@vegalegal.example",
    paymentMethod: "wire",
    bankAccountLast4: "0042",
    defaultGlCode: "6200",
    notes: "Quarterly retainer",
  },
  {
    name: "Bluefin Software Consulting",
    email: "invoices@bluefin.example",
    paymentMethod: "wire",
    bankAccountLast4: "9913",
    defaultGlCode: "5800",
    notes: null,
  },
  {
    name: "Apex HVAC Services",
    email: "ap@apex-hvac.example",
    paymentMethod: "check",
    bankAccountLast4: null,
    defaultGlCode: "5500",
    notes: "Maintenance contract",
  },
  {
    name: "Sunrise Landscaping",
    email: "office@sunriselandscape.example",
    paymentMethod: "check",
    bankAccountLast4: null,
    defaultGlCode: "5400",
    notes: null,
  },
  {
    name: "TerraNova Couriers",
    email: "billing@terranova.example",
    paymentMethod: "ach",
    bankAccountLast4: "7766",
    defaultGlCode: "5300",
    notes: null,
  },
  {
    name: "Helix Marketing Agency",
    email: "accounts@helixmkt.example",
    paymentMethod: "wire",
    bankAccountLast4: "5544",
    defaultGlCode: "6100",
    notes: "Monthly retainer",
  },
  {
    name: "Stratus Cloud Hosting",
    email: "billing@stratus.example",
    paymentMethod: "ach",
    bankAccountLast4: "1198",
    defaultGlCode: "5800",
    notes: null,
  },
  {
    name: "Iron Forge Print Shop",
    email: "orders@ironforge.example",
    paymentMethod: "check",
    bankAccountLast4: null,
    defaultGlCode: "5100",
    notes: null,
  },
  {
    name: "Pacific Coast Insurance",
    email: "ap@paccoast.example",
    paymentMethod: "ach",
    bankAccountLast4: "3370",
    defaultGlCode: "6300",
    notes: "General liability",
  },
  {
    name: "Greenleaf Catering",
    email: "billing@greenleaf.example",
    paymentMethod: "check",
    bankAccountLast4: null,
    defaultGlCode: "5700",
    notes: "Office events",
  },
];

const REJECTION_REASONS = [
  "Wrong PO referenced",
  "Amount exceeds approval limit",
];

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function daysAhead(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

function generateInvoiceNumber(): string {
  return "INV-" + randomBytes(3).toString("hex").toUpperCase();
}

function generateConfirmation(): string {
  return "PAY-" + randomBytes(6).toString("hex").toUpperCase();
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

type ActivityRecord = {
  type: ActivityType;
  userId: string;
  createdAt: Date;
  metadata?: Prisma.InputJsonValue;
};

type SeedBillArgs = {
  status: BillStatus;
  vendorId: string;
  submitterId: string;
  approverId: string;
  amountCents: number;
  baseDaysAgo: number;
  paymentDaysAhead?: number;
  paidDaysAgo?: number;
  rejectionReason?: string;
  dueDaysFromNow?: number;
};

function buildActivityChain(args: SeedBillArgs): ActivityRecord[] {
  const items: ActivityRecord[] = [];
  const offset = (n: number) => daysAgo(args.baseDaysAgo + n);

  items.push({
    type: "created",
    userId: args.submitterId,
    createdAt: offset(5),
  });

  if (args.status === "draft") return items;

  items.push({
    type: "submitted",
    userId: args.submitterId,
    createdAt: offset(4),
    metadata: { fromStatus: "draft", toStatus: "pending_approval" },
  });

  if (args.status === "pending_approval") return items;

  if (args.status === "rejected") {
    items.push({
      type: "rejected",
      userId: args.approverId,
      createdAt: offset(0),
      metadata: {
        fromStatus: "pending_approval",
        toStatus: "rejected",
        reason: args.rejectionReason ?? null,
      },
    });
    return items;
  }

  items.push({
    type: "approved",
    userId: args.approverId,
    createdAt: offset(2),
    metadata: { fromStatus: "pending_approval", toStatus: "approved" },
  });

  if (args.status === "approved") return items;

  items.push({
    type: "scheduled",
    userId: args.approverId,
    createdAt: offset(1),
    metadata: { fromStatus: "approved", toStatus: "scheduled" },
  });

  if (args.status === "scheduled") return items;

  items.push({
    type: "paid",
    userId: args.approverId,
    createdAt: args.paidDaysAgo != null ? daysAgo(args.paidDaysAgo) : offset(0),
    metadata: { fromStatus: "scheduled", toStatus: "paid" },
  });

  return items;
}

async function seedBill(args: SeedBillArgs) {
  const issueDate = daysAgo(args.baseDaysAgo + 8);
  const createdAt = daysAgo(args.baseDaysAgo + 5);

  let dueDate: Date;
  let paymentDate: Date | null = null;
  let paymentConfirmation: string | null = null;

  if (args.status === "scheduled") {
    paymentDate = daysAhead(args.paymentDaysAhead ?? 7);
    dueDate = paymentDate;
  } else if (args.status === "paid") {
    paymentDate = daysAgo(args.paidDaysAgo ?? 5);
    paymentConfirmation = generateConfirmation();
    dueDate = paymentDate;
  } else {
    dueDate = daysAhead(args.dueDaysFromNow ?? 14);
  }

  const approvedById = ["approved", "scheduled", "paid", "rejected"].includes(
    args.status,
  )
    ? args.approverId
    : null;

  await prisma.bill.create({
    data: {
      vendorId: args.vendorId,
      invoiceNumber: generateInvoiceNumber(),
      amountCents: args.amountCents,
      issueDate,
      dueDate,
      submittedById: args.submitterId,
      approvedById,
      status: args.status,
      paymentDate,
      paymentConfirmation,
      rejectionReason: args.rejectionReason ?? null,
      createdAt,
      activities: { create: buildActivityChain(args) },
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const userCount = await prisma.user.count();
  if (userCount > 0 && process.env.FORCE_SEED !== "1") {
    await ensureDemoUser(passwordHash);
    console.log(
      "[seed] users already exist, skipping. Set FORCE_SEED=1 to wipe and reseed.",
    );
    console.log(`[seed] demo user ensured: ${DEMO_USER_EMAIL}`);
    return;
  }

  console.log("[seed] truncating...");
  await prisma.bill.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();

  console.log("[seed] users...");
  await ensureDemoUser(passwordHash);
  const sara = await prisma.user.create({
    data: {
      name: "Sara",
      email: "sara@harakapay.demo",
      passwordHash,
      role: "submitter",
    },
  });
  const marcus = await prisma.user.create({
    data: {
      name: "Marcus",
      email: "marcus@harakapay.demo",
      passwordHash,
      role: "approver",
    },
  });

  console.log("[seed] vendors...");
  const vendors = await Promise.all(
    VENDORS.map((v) => prisma.vendor.create({ data: v })),
  );

  console.log("[seed] bills + activity history...");

  const submitterId = sara.id;
  const approverId = marcus.id;

  for (let i = 0; i < 4; i++) {
    await seedBill({
      status: "draft",
      vendorId: pick(vendors, i).id,
      submitterId,
      approverId,
      amountCents: 80_000 + i * 12_300,
      baseDaysAgo: 1,
      dueDaysFromNow: 21 + i * 3,
    });
  }

  for (let i = 0; i < 8; i++) {
    await seedBill({
      status: "pending_approval",
      vendorId: pick(vendors, i + 4).id,
      submitterId,
      approverId,
      amountCents: 35_000 + i * 8_700,
      baseDaysAgo: 2 + (i % 3),
      dueDaysFromNow: 3 + i,
    });
  }

  for (let i = 0; i < 6; i++) {
    await seedBill({
      status: "approved",
      vendorId: pick(vendors, i + 1).id,
      submitterId,
      approverId,
      amountCents: 12_000 + i * 22_000,
      baseDaysAgo: 4 + (i % 4),
      dueDaysFromNow: 5 + i * 2,
    });
  }

  for (let i = 0; i < 5; i++) {
    await seedBill({
      status: "scheduled",
      vendorId: pick(vendors, i + 5).id,
      submitterId,
      approverId,
      amountCents: 24_000 + i * 14_500,
      baseDaysAgo: 5,
      paymentDaysAhead: 1 + i * 3,
    });
  }

  for (let i = 0; i < 5; i++) {
    await seedBill({
      status: "paid",
      vendorId: pick(vendors, i + 8).id,
      submitterId,
      approverId,
      amountCents: 8_500 + i * 31_000,
      baseDaysAgo: 25 - i * 5,
      paidDaysAgo: 4 + i * 5,
    });
  }

  for (let i = 0; i < REJECTION_REASONS.length; i++) {
    await seedBill({
      status: "rejected",
      vendorId: pick(vendors, i * 5 + 2).id,
      submitterId,
      approverId,
      amountCents: i === 0 ? 156_000 : 4_780_000,
      baseDaysAgo: 8 - i * 2,
      rejectionReason: REJECTION_REASONS[i],
      dueDaysFromNow: 10,
    });
  }

  const total = await prisma.bill.count();
  console.log(
    `[seed] done. ${total} bills, ${vendors.length} vendors, 3 users`,
  );
  console.log(
    `[seed] login: sara@harakapay.demo / ${DEMO_PASSWORD} (submitter)`,
  );
  console.log(
    `[seed] login: marcus@harakapay.demo / ${DEMO_PASSWORD} (approver)`,
  );
  console.log(
    `[seed] login: ${DEMO_USER_EMAIL} / ${DEMO_PASSWORD} (${DEMO_USER_ROLE})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
