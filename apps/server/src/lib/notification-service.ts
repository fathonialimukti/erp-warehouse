import type { DbClient } from './prisma.js';
import { sseManager } from './sse-manager.js';

export interface NotifyInput {
    /** Recipient user IDs */
    users: string[];
    title: string;
    message: string;
    /** Deep-link URL for the notification action */
    link?: string;
    /** User ID who triggered this notification; null = system */
    causer?: string;
    type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    targetType?: 'SYSTEM' | 'RECEIVING' | 'WIP_COMPLETION' | 'RMA_RECEIPT' | 'WIP_ISSUE' | 'SHIPMENT' | 'RETURN_TO_SUPPLIER' | 'DISPOSAL' | 'SUBINVENTORY_TRANSFER' | 'LOSS' | 'FOUND';
    targetId?: string;
}

/**
 * Create notifications for one or more users, persist to DB, and push via SSE.
 *
 * Usage:
 *   await notify(prisma, {
 *     users: [creatorId],
 *     title: 'Inbound Approved',
 *     message: 'Your inbound transaction was approved.',
 *     link: '/transactions/inbound/01ABC',
 *     causer: ctx.user.userId,
 *     type: 'SUCCESS',
 *     targetType: 'INBOUND',
 *     targetId: transaction.id,
 *   });
 */
export const notify = async (db: DbClient, input: NotifyInput) => {
    const {
        users,
        title,
        message,
        link,
        causer,
        type = 'INFO',
        targetType = 'SYSTEM',
        targetId,
    } = input;

    const created = await Promise.all(
        users.map((userId) =>
            db.notification.create({
                data: {
                    userId,
                    createdById: causer ?? null,
                    title,
                    message,
                    actionUrl: link ?? null,
                    type,
                    targetType,
                    targetId: targetId ?? null,
                },
                include: {
                    createdBy: {
                        select: { id: true, name: true, email: true },
                    },
                },
            })
        )
    );

    for (const notif of created) {
        sseManager.broadcast(notif.userId, { type: 'notification', payload: notif });
    }

    return created;
};
