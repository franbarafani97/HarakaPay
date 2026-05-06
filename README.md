# HarakaPay - Haraka means "Fast" in Swahili

An MVP Payable product for small and medium size business.

## Demo

Deployed at **https://harakapay-web.onrender.com**

Two seeded accounts:

- Sara — `sara@harakapay.demo` / `demo1234` (submitter)
- Marcus — `marcus@harakapay.demo` / `demo1234` (approver)

Quick tour:

1. Log in as Marcus
2. Approve a few with the `e` key. The inbox supports keyboard nav (`j`/`k` move, `Enter` opens, `e` approves a pending row).
3. On any approved bill click **Schedule payment** → pick a date → **Mark as paid** generates a confirmation number.
4. Log in as Sara → **+ New bill**. The form prefills GL code and last-used amount when you pick a vendor.
5. Sara can also click **Scan from phone** — a QR opens a phone-side page; take a photo of an invoice (or pick a PDF), the form prefills with whatever Tesseract reads.

## Run locally

Prerequisites: Node 22.12+, pnpm, Docker (for Postgres).

```bash
git clone <repo>
cd harakapay
nvm use                            # Node 22.12.0 from .nvmrc
pnpm install
docker compose up -d               # Postgres on host port 5433
pnpm -F @harakapay/api exec prisma migrate deploy
pnpm -F @harakapay/api seed        # 2 users, 12 vendors, 30 bills
bash scripts/dev.sh                # api + web together
```

Web at http://localhost:5173, API at http://localhost:4000.

To use the **scan-from-phone** flow on your LAN: visit the LAN IP shown by Vite (e.g. `http://192.168.1.10:5173`) instead of localhost. The phone scans the QR and hits the same LAN address. CORS allows private-IP origins in dev.

## Bill State Machine

```
draft → pending_approval → approved → scheduled → paid
                       ↘         ↘
                       rejected  (rejected re-editable to draft via "Revise")
```

Basic Flow:

- **Sara creates a bill.** Picks a vendor, enters amount/dates/memo, optionally adds line items and a PDF attachment. Saves as draft → submits for approval.
- **Marcus approves.** Looks at his queue. Approves with one click (or `e`), or rejects with a reason.
- **Marcus schedules and pays.** Approved bills get a payment date → `scheduled`. Marking paid generates a fake confirmation number → `paid`.
- **Both see the state of the world.** Dashboard cards: needs-my-approval, due this week, scheduled this week, paid this month. Bills table below.

## Architecture

Monorepo (pnpm workspaces). Separate React SPA + Node/Express API + shared package.

```
apps/api          Express + Prisma + Postgres + Tesseract + JWT auth
apps/web          Vite + React + TanStack Query + Tailwind v4 + shadcn/ui
packages/shared   Zod schemas
```

## Data model

`User`
`Vendor`: is the counterparty being paid. Every bill belongs to one.
`Bill`: is the core record. Amounts are stored as integer cents. The status enum has six values — `draft`, `pending_approval`, `approved`, `scheduled`, `paid`, and `rejected`.
`LineItem`: is an optional breakdown of a bill into rows. They don't have to sum to the bill total.
`Activity`: is an append-only audit log. Every status change writes one row in the same transaction as the bill update.

```prisma
// ENUMS:
// Two roles in the app.
enum Role {
  submitter
  approver
}

enum PaymentMethod {
  ach
  check
  wire
}

enum BillStatus {
  draft
  pending_approval
  approved
  scheduled
  paid
  rejected
}

enum ActivityType {
  created
  edited
  submitted
  approved
  rejected
  scheduled
  paid
}

// MODELS

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role
  createdAt    DateTime @default(now())

  submittedBills Bill[]     @relation("submitter")
  approvedBills  Bill[]     @relation("approver")
  activities     Activity[]
}

// Vendor is the counterparty being paid.
model Vendor {
  id               String        @id @default(cuid())
  name             String
  email            String?
  paymentMethod    PaymentMethod
  bankAccountLast4 String?
  defaultGlCode    String?
  notes            String?
  createdAt        DateTime      @default(now())

  bills Bill[]

  @@index([name])
}

// Bill:
// It has 6 status: draft, pending_approval, approved, scheduled, paid, and rejected.
model Bill {
  id                  String     @id @default(cuid())
  vendorId            String
  invoiceNumber       String
  amountCents         Int
  currency            String     @default("USD")
  issueDate           DateTime
  dueDate             DateTime
  memo                String?
  glCode              String?
  status              BillStatus @default(draft)
  attachmentUrl       String?
  attachmentFilename  String?

  submittedById       String?
  approvedById        String?
  paymentDate         DateTime?
  paymentConfirmation String?
  rejectionReason     String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  vendor      Vendor     @relation(fields: [vendorId], references: [id])
  submittedBy User?      @relation("submitter", fields: [submittedById], references: [id])
  approvedBy  User?      @relation("approver", fields: [approvedById], references: [id])
  lineItems   LineItem[]
  activities  Activity[]

  @@index([status, dueDate])
  @@index([vendorId])
}

// LineItem is an optional breakdown of a bill into rows. They don't have to sum to the bill total.
model LineItem {
  id          String  @id @default(cuid())
  billId      String
  description String
  amountCents Int
  glCode      String?

  bill Bill @relation(fields: [billId], references: [id], onDelete: Cascade)
}

// Activity tracks every status change. Append-only.
model Activity {
  id        String       @id @default(cuid())
  billId    String
  userId    String?
  type      ActivityType
  metadata  Json?
  createdAt DateTime     @default(now())

  bill Bill  @relation(fields: [billId], references: [id], onDelete: Cascade)
  user User? @relation(fields: [userId], references: [id])

  @@index([billId, createdAt])
}
```

## What was built

| Built                                          | Notes                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| Vendor CRUD + inline create                    | API + UI                                                           |
| Bill draft → submit → approve → schedule → pay | All transitions server-enforced                                    |
| Reject with reason; revise back to draft       |
| Bulk approve from inbox                        | Approver-only; checkbox column appears when there are pending rows |
| Edit bill (draft + rejected)                   |
| Activity log per bill                          | Append-only, with user names and relative timestamps               |
| Dashboard with 4 cards                         | Role-aware "needs my approval"                                     |
| Bills inbox + status filter + keyboard nav     | `j` / `k` / `Enter` / `e`                                          |
| PDF attachment upload + inline link on detail  | Per bill, 10 MB cap                                                |
| CSV export                                     | Human-readable headers, dollar amounts                             |
| Phone scan with OCR prefill                    | Tesseract + SSE; PDFs rendered to PNG on the device                |

What was was cut out of the scope:

| Cut                        | Reason                                              |
| -------------------------- | --------------------------------------------------- |
| Multi-org / tenancy        | Single seeded org → faster review, simpler tests    |
| Multi-step approval chains | Single approver tier covers most real flows         |
| Real ACH / Stripe rails    | Compliance + scope blowup; payment is simulated     |
| Multi-currency             | USD only                                            |
| Email-forward ingestion    | Higher cost / lower signal than the phone-scan path |

## Tests

```bash
pnpm -F @harakapay/api test
```

Test cases cover:

- Auth — register / login / logout / me
- Vendor CRUD + stats rollup
- Bill create / list / get / patch / delete
- Full state machine transition matrix
- Bulk transition
- Attachment upload and serve
- Dashboard summary
- CSV export

There is no frontend tests

## Project layout

```
harakapay/
├── apps/
│   ├── api/                  Express + Prisma + Tesseract
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── routes/       auth, vendors, bills, dashboard, export, scan-sessions
│   │   │   ├── services/     state-machine, scan-sessions, ocr
│   │   │   ├── middleware/   requireAuth, error-handler, upload
│   │   │   ├── lib/          prisma client, jwt, password, api-error
│   │   │   ├── seed.ts
│   │   │   ├── app.ts
│   │   │   └── index.ts
│   │   └── tests/            vitest (103 cases)
│   └── web/
│       └── src/
│           ├── pages/        Login, Signup, Dashboard, BillsInbox, NewBill,
│           │                 EditBill, BillDetail, MobileScan
│           ├── components/   AppHeader, BillForm, BillsListSection, StatusPill,
│           │                 ScanFromPhoneDialog, ui/ (shadcn)
│           ├── hooks/        useAuth, useBills, useVendors, useDashboard
│           └── lib/          api client, pdf-to-image, utils
├── packages/
│   └── shared/               Zod schemas + state machine
│       └── src/              user, vendor, bill, activity, status, dashboard, scan
├── scripts/
│   ├── setup.sh              Bootstrap fresh repo (idempotent)
│   └── dev.sh                Run api + web together
├── docker-compose.yml        Postgres on 5433
├── pnpm-workspace.yaml
└── README.md
```
