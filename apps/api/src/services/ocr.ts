import { createWorker, type Worker } from "tesseract.js";
import type { ExtractedFields } from "@harakapay/shared";

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng");
  }
  return workerPromise;
}

export async function runOcr(filePath: string): Promise<string> {
  const worker = await getWorker();
  const result = await worker.recognize(filePath);
  return result.data.text;
}

export function parseInvoice(text: string): ExtractedFields {
  return {
    invoiceNumber: extractInvoiceNumber(text),
    amountCents: extractAmount(text),
    issueDate: extractIssueDate(text),
    dueDate: extractDueDate(text),
  };
}

const DEMO_AMOUNTS_CENTS = [125000, 248050, 360000, 487525, 612000, 980000];

export function mockInvoiceExtraction(): ExtractedFields {
  const now = new Date();
  const stamp =
    String(now.getFullYear()).slice(-2) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    "-" +
    String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 30);
  const amountCents =
    DEMO_AMOUNTS_CENTS[Math.floor(Math.random() * DEMO_AMOUNTS_CENTS.length)] ??
    250000;
  return {
    invoiceNumber: `INV-DEMO-${stamp}`,
    amountCents,
    issueDate: now.toISOString(),
    dueDate: dueDate.toISOString(),
  };
}

function extractInvoiceNumber(text: string): string | null {
  const patterns = [
    /(?:invoice|inv)[\s.#:]*(?:no\.?|number)?[\s:#]*([A-Z0-9][A-Z0-9-]{2,})/i,
    /\b(INV[-_]?\d+)\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function extractAmount(text: string): number | null {
  const totalRe =
    /(?:total|amount\s*due|balance\s*due)[^\d$]*\$?\s*([\d,]+\.\d{2})/i;
  const totalMatch = text.match(totalRe);
  if (totalMatch && totalMatch[1]) {
    const n = parseFloat(totalMatch[1].replace(/,/g, ""));
    if (!isNaN(n) && n > 0) return Math.round(n * 100);
  }

  const dollarRe = /\$\s*([\d,]+\.\d{2})/g;
  let max = 0;
  let match;
  while ((match = dollarRe.exec(text)) !== null) {
    const n = parseFloat(match[1]!.replace(/,/g, ""));
    if (!isNaN(n) && n > max) max = n;
  }
  return max > 0 ? Math.round(max * 100) : null;
}

function extractIssueDate(text: string): string | null {
  const re =
    /(?:invoice\s*date|date\s*issued|issued\s*on|date)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i;
  const m = text.match(re);
  if (m && m[1]) return parseDate(m[1]);
  return null;
}

function extractDueDate(text: string): string | null {
  const re =
    /(?:due\s*date|due\s*by|payable\s*by|due)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i;
  const m = text.match(re);
  if (m && m[1]) return parseDate(m[1]);
  return null;
}

function parseDate(s: string): string | null {
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}
