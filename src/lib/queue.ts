import { prisma } from "./prisma";
import type { Ticket } from "@prisma/client";

const AVG_HANDLE_MINUTES = Number(process.env.AVG_HANDLE_MINUTES ?? 45);

// Priority weight for ordering — higher priority served first, then FIFO.
const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/** Tickets still waiting in the queue (not yet resolved/closed/cancelled). */
const WAITING = ["OPEN", "ASSIGNED", "IN_PROGRESS"] as const;

/**
 * Compute a ticket's queue position (1-based) and estimated wait.
 * Ordering: priority first, then creation time (FIFO within a priority).
 * A ticket already IN_PROGRESS is position 0 (being served now).
 */
export async function getQueueInfo(ticket: Ticket) {
  if (!WAITING.includes(ticket.status as (typeof WAITING)[number])) {
    return { position: 0, ahead: 0, estimatedWaitMinutes: 0 };
  }

  const waiting = await prisma.ticket.findMany({
    where: { status: { in: [...WAITING] } },
    select: { id: true, priority: true, createdAt: true, status: true },
  });

  const sorted = waiting.sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const index = sorted.findIndex((t) => t.id === ticket.id);
  const position = index + 1; // 1-based
  const ahead = index; // how many customers are ahead

  return {
    position,
    ahead,
    estimatedWaitMinutes: ahead * AVG_HANDLE_MINUTES,
  };
}

/** Generate a human-friendly ticket number, e.g. ETC-20260728-4821. */
export function makeTicketNumber(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ETC-${ymd}-${rand}`;
}
