import { prisma } from "./prisma";

/** Persist an in-app notification. (Hook SMS/email here later.) */
export async function notify(
  userId: string,
  message: string,
  ticketId?: string,
) {
  return prisma.notification.create({
    data: { userId, message, ticketId },
  });
}
