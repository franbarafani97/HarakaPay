import { randomBytes } from "node:crypto";
import type { Response } from "express";
import type { ExtractedFields, ScanSessionStatus } from "@harakapay/shared";

export type ScanSession = {
  id: string;
  userId: string;
  status: ScanSessionStatus;
  result: ExtractedFields | null;
  error: string | null;
  createdAt: Date;
  expiresAt: Date;
  uploadedFilePath: string | null;
};

const TTL_MS = 5 * 60 * 1000;

const sessions = new Map<string, ScanSession>();
const subscribers = new Map<string, Set<Response>>();

export function createSession(userId: string): ScanSession {
  const id = randomBytes(16).toString("hex");
  const now = new Date();
  const session: ScanSession = {
    id,
    userId,
    status: "pending",
    result: null,
    error: null,
    createdAt: now,
    expiresAt: new Date(now.getTime() + TTL_MS),
    uploadedFilePath: null,
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): ScanSession | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  if (session.expiresAt < new Date()) {
    sessions.delete(id);
    return undefined;
  }
  return session;
}

export function updateSession(id: string, partial: Partial<ScanSession>) {
  const session = sessions.get(id);
  if (!session) return;
  Object.assign(session, partial);
}

export function subscribe(sessionId: string, res: Response): () => void {
  let set = subscribers.get(sessionId);
  if (!set) {
    set = new Set();
    subscribers.set(sessionId, set);
  }
  set.add(res);
  return () => {
    const current = subscribers.get(sessionId);
    if (!current) return;
    current.delete(res);
    if (current.size === 0) subscribers.delete(sessionId);
  };
}

type Event = {
  status: ScanSessionStatus;
  result?: ExtractedFields | null;
  error?: string;
};

export function publish(sessionId: string, event: Event) {
  const set = subscribers.get(sessionId);
  if (!set) return;
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of set) {
    res.write(data);
  }
}

setInterval(() => {
  const now = new Date();
  for (const [id, session] of sessions) {
    if (session.expiresAt < now) {
      sessions.delete(id);
    }
  }
}, 60_000).unref();
