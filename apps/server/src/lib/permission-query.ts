import type { DbClient } from './prisma.js';

/**
 * Return IDs of all users whose role has a specific permission.
 * Useful for targeting notifications to users who can act on a resource.
 *
 * @example
 * const approverIds = await getUserIdsWithPermission(db, 'inbound_transaction@approve');
 */
export const getUserIdsWithPermission = async (
    db: DbClient,
    permissionName: string,
): Promise<string[]> => {
    const users = await db.user.findMany({
        where: {
            role: {
                permissions: {
                    some: {
                        permission: {
                            name: permissionName,
                        },
                    },
                },
            },
        },
        select: { id: true },
    });
    return users.map((u) => u.id);
};
