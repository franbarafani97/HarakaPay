# HarakaPay - Haraka means "Fast" in Swahili

# Payable Application

#Stack

#Architecture

# Web App - API - PSQL DB

#Web App Stack
#React, Tailwind, Shadcn, Tanstack

#API
#Express.JS, Prisma

#Shared
#Zod

#Others
#Docker

## DATA MODEL

```prisma
generator client {
  provider = "prisma-client"
  output   = "../node_modules/.prisma/client"
}

datasource db {
  provider = "postgresql"
}

// ENUMS:

// We have to roles in the app.
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

//Vendor is the counterparty being paid.
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

// LineItem
// is an optional breakdown of a bill into rows. They don't have to sum to the bill total.
model LineItem {
  id          String  @id @default(cuid())
  billId      String
  description String
  amountCents Int
  glCode      String?

  bill Bill @relation(fields: [billId], references: [id], onDelete: Cascade)
}

//Activity
//Tracks status changes as the bill status updates.
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

#TO-DO

# Create CI/CD Pipeline with github actions

# Search where to host WEB app (Maybe Firebase hosting?)

# Search where to host the API

# Work on Backend

# Work on Front

# Check if possible to add stripe with a dev environment. Apparently there is no free tier, maybe mercadopago could do it as payment example

# Add a human Liveness check before confirming a payment for security. React Faceplugin.
