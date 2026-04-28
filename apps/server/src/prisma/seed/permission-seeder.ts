import { Client, PoolClient } from 'pg';

const PERMISSIONS = [
    // User
    { name: 'user@create', description: 'Create users' },
    { name: 'user@read', description: 'Read users' },
    { name: 'user@update', description: 'Update users' },
    { name: 'user@delete', description: 'Delete users' },

    // Role
    { name: 'role@create', description: 'Create roles' },
    { name: 'role@read', description: 'Read roles' },
    { name: 'role@update', description: 'Update roles' },
    { name: 'role@delete', description: 'Delete roles' },

    // Permission
    { name: 'permission@create', description: 'Create permissions' },
    { name: 'permission@read', description: 'Read permissions' },
    { name: 'permission@update', description: 'Update permissions' },
    { name: 'permission@delete', description: 'Delete permissions' },

    // Warehouse
    { name: 'warehouse@create', description: 'Create warehouses' },
    { name: 'warehouse@read', description: 'Read warehouses' },
    { name: 'warehouse@update', description: 'Update warehouses' },
    { name: 'warehouse@delete', description: 'Delete warehouses' },

    // SKU
    { name: 'sku@create', description: 'Create SKUs' },
    { name: 'sku@read', description: 'Read SKUs' },
    { name: 'sku@update', description: 'Update SKUs' },
    { name: 'sku@delete', description: 'Delete SKUs' },

    // Pallet Type
    { name: 'pallet_type@create', description: 'Create pallet types' },
    { name: 'pallet_type@read', description: 'Read pallet types' },
    { name: 'pallet_type@update', description: 'Update pallet types' },
    { name: 'pallet_type@delete', description: 'Delete pallet types' },

    // Storage Location
    { name: 'storage_location@create', description: 'Create storage locations' },
    { name: 'storage_location@read', description: 'Read storage locations' },
    { name: 'storage_location@update', description: 'Update storage locations' },
    { name: 'storage_location@delete', description: 'Delete storage locations' },
    { name: 'storage_location@import', description: 'Import storage locations via Excel' },

    // Pallet
    { name: 'pallet@create', description: 'Create pallets' },
    { name: 'pallet@read', description: 'Read pallets' },
    { name: 'pallet@update', description: 'Update pallets' },
    { name: 'pallet@delete', description: 'Delete pallets' },

    // Inbound Transaction
    { name: 'inbound_transaction@create', description: 'Create inbound transactions' },
    { name: 'inbound_transaction@read', description: 'Read inbound transactions' },
    { name: 'inbound_transaction@update', description: 'Update inbound transactions' },
    { name: 'inbound_transaction@delete', description: 'Delete inbound transactions' },
    { name: 'inbound_transaction@approve', description: 'Approve inbound transactions' },
    { name: 'inbound_transaction@assign', description: 'Assign inbound pallets to storage locations' },

    // Outbound Transaction
    { name: 'outbound_transaction@create', description: 'Create outbound transactions' },
    { name: 'outbound_transaction@read', description: 'Read outbound transactions' },
    { name: 'outbound_transaction@update', description: 'Update outbound transactions' },
    { name: 'outbound_transaction@delete', description: 'Delete outbound transactions' },
    { name: 'outbound_transaction@approve', description: 'Approve outbound transactions' },

    // Transfer Transaction
    { name: 'transfer_transaction@create', description: 'Create transfer transactions' },
    { name: 'transfer_transaction@read', description: 'Read transfer transactions' },
    { name: 'transfer_transaction@update', description: 'Update transfer transactions' },
    { name: 'transfer_transaction@delete', description: 'Delete transfer transactions' },
    { name: 'transfer_transaction@approve', description: 'Approve transfer transactions' },

    // Loss Transaction
    { name: 'loss_transaction@create', description: 'Create loss transactions' },
    { name: 'loss_transaction@read', description: 'Read loss transactions' },
    { name: 'loss_transaction@update', description: 'Update loss transactions' },
    { name: 'loss_transaction@delete', description: 'Delete loss transactions' },
    { name: 'loss_transaction@approve', description: 'Approve loss transactions' },

    // Found Transaction
    { name: 'found_transaction@create', description: 'Create found transactions' },
    { name: 'found_transaction@read', description: 'Read found transactions' },
    { name: 'found_transaction@update', description: 'Update found transactions' },
    { name: 'found_transaction@delete', description: 'Delete found transactions' },
    { name: 'found_transaction@approve', description: 'Approve found transactions' },

    // Activity Log
    { name: 'activity_log@read', description: 'Read activity logs' },
];

const ROLES = [
    { name: 'System Admin', description: 'Full system access' },
    { name: 'Warehouse Manager', description: 'Manage warehouse operations and approvals' },
    { name: 'Warehouse Operator', description: 'Perform warehouse daily operations' },
    { name: 'Approver', description: 'Approve warehouse transactions' },
];

const TRANSACTION_TYPES = ['inbound', 'outbound', 'transfer', 'loss', 'found'] as const;

const ROLE_PERMISSIONS: Record<string, string[]> = {
    'System Admin': ['*'],

    'Warehouse Manager': [
        'warehouse@*',
        'sku@*',
        'pallet_type@*',
        'storage_location@*',
        'pallet@*',
        'activity_log@read',
        ...TRANSACTION_TYPES.flatMap(t => [`${t}_transaction@*`]),
    ],

    'Warehouse Operator': [
        'warehouse@read',
        'sku@read',
        'pallet_type@read',
        'storage_location@read',
        'pallet@read', 'pallet@create', 'pallet@update',
        'inbound_transaction@assign',
        ...TRANSACTION_TYPES.flatMap(t => [
            `${t}_transaction@read`,
            `${t}_transaction@create`,
            `${t}_transaction@update`,
        ]),
    ],

    'Approver': [
        'activity_log@read',
        ...TRANSACTION_TYPES.flatMap(t => [
            `${t}_transaction@read`,
            `${t}_transaction@approve`,
        ]),
    ],
};

function normalizePermissionName(permission: string) {
    if (permission.includes('@')) return permission;
    return permission.replace(/_([^_]+)$/, '@$1');
}

function normalizePattern(pattern: string) {
    if (pattern === '*') return pattern;
    if (pattern.includes('@')) return pattern;
    return normalizePermissionName(pattern);
}

function matchesPattern(permName: string, patterns: string[]): boolean {
    const normalizedPermission = normalizePermissionName(permName);
    return patterns.some((pattern) => {
        if (pattern === '*') return true;
        const normalizedPattern = normalizePattern(pattern);
        if (normalizedPattern === normalizedPermission) return true;
        if (normalizedPattern.endsWith('@*')) {
            const prefix = normalizedPattern.slice(0, -2);
            return normalizedPermission.startsWith(prefix + '@');
        }
        return false;
    });
}

async function seedPermissionsAndRoles(client: Client | PoolClient) {
    console.log('Cleaning existing permissions and roles...');
    await client.query('UPDATE users SET role_id = NULL WHERE role_id IS NOT NULL');
    await client.query('DELETE FROM role_has_permissions');
    await client.query('DELETE FROM permissions');
    await client.query('DELETE FROM roles');
    console.log('✓ Cleaned existing permissions and roles');

    console.log('Ensuring permission and role IDs have DB defaults...');
    await client.query(`
        ALTER TABLE permissions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE roles ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    `);

    console.log('Seeding permissions...');
    for (const perm of PERMISSIONS) {
        await client.query(`
            INSERT INTO permissions (name, description, created_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
        `, [perm.name, perm.description]);
    }
    console.log(`✓ ${PERMISSIONS.length} permissions seeded`);

    console.log('Seeding roles...');
    const roleIds: Record<string, string> = {};
    for (const role of ROLES) {
        const result = await client.query(`
            INSERT INTO roles (name, description, created_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
            RETURNING id
        `, [role.name, role.description]);
        roleIds[role.name] = result.rows[0].id;
    }
    console.log(`✓ ${ROLES.length} roles seeded`);

    console.log('Assigning permissions to roles...');
    const { rows: allPermissions } = await client.query('SELECT id, name FROM permissions');

    for (const [roleName, patterns] of Object.entries(ROLE_PERMISSIONS)) {
        const roleId = roleIds[roleName];
        if (!roleId) continue;

        for (const perm of allPermissions) {
            if (matchesPattern(perm.name, patterns)) {
                await client.query(`
                    INSERT INTO role_has_permissions (role_id, permission_id, created_at, updated_at)
                    VALUES ($1, $2, NOW(), NOW())
                `, [roleId, perm.id]);
            }
        }
    }
    console.log('✓ Permissions assigned to roles');

    return roleIds;
}

export { PERMISSIONS, ROLES, TRANSACTION_TYPES, seedPermissionsAndRoles };