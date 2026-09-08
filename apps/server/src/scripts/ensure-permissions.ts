// Idempotently syncs Permission rows (and catalog role grants) from the RBAC
// catalog into an existing database. Additive only — never deletes.
// Run after `prisma migrate deploy` so new features' permissions exist on live DBs.
// Usage: bun src/scripts/ensure-permissions.ts
import 'dotenv/config';
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, matchesPattern } from '../prisma/seed/catalog/rbac.js';
import { prisma } from '../lib/prisma.js';

async function main() {
    console.log(`Syncing ${PERMISSIONS.length} permissions...`);

    for (const perm of PERMISSIONS) {
        await prisma.permission.upsert({
            where: { name: perm.name },
            update: { description: perm.description },
            create: { name: perm.name, description: perm.description },
        });
    }
    console.log('Permissions upserted.');

    const allPermissions = await prisma.permission.findMany();
    let granted = 0;
    let rolesSynced = 0;

    for (const role of ROLES) {
        const existing = await prisma.role.findUnique({
            where: { name: role.name },
            include: { permissions: true },
        });
        if (!existing) continue;
        rolesSynced += 1;

        const patterns = ROLE_PERMISSIONS[role.name] ?? [];
        const owned = new Set(existing.permissions.map((rp) => rp.permissionId));

        for (const perm of allPermissions) {
            if (owned.has(perm.id)) continue;
            if (!matchesPattern(perm.name, patterns)) continue;
            await prisma.roleHasPermission.create({
                data: { roleId: existing.id, permissionId: perm.id },
            });
            granted += 1;
        }
    }

    console.log(`Roles synced: ${rolesSynced}; new grants: ${granted}.`);
    console.log('ensure-permissions complete.');
}

main()
    .catch((error) => {
        console.error('ensure-permissions failed:', error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
