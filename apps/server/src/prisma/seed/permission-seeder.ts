import { Client, PoolClient } from 'pg';

const PERMISSIONS = [
    { name: 'user_read', description: 'Read users' },
    { name: 'user_update', description: 'Update users' },
    { name: 'user_delete', description: 'Delete users' },

    // Role permissions
    { name: 'role_create', description: 'Create roles' },
    { name: 'role_read', description: 'Read roles' },
    { name: 'role_update', description: 'Update roles' },
    { name: 'role_delete', description: 'Delete roles' },

    // Permission permissions
    { name: 'permission_create', description: 'Create permissions' },
    { name: 'permission_read', description: 'Read permissions' },
    { name: 'permission_update', description: 'Update permissions' },
    { name: 'permission_delete', description: 'Delete permissions' },

    // Warehouse permissions
    { name: 'warehouse_create', description: 'Create warehouses' },
    { name: 'warehouse_read', description: 'Read warehouses' },
    { name: 'warehouse_update', description: 'Update warehouses' },
    { name: 'warehouse_delete', description: 'Delete warehouses' },

    // SKU permissions
    { name: 'sku_create', description: 'Create SKUs' },
    { name: 'sku_read', description: 'Read SKUs' },
    { name: 'sku_update', description: 'Update SKUs' },
    { name: 'sku_delete', description: 'Delete SKUs' },

    // Pallet Type permissions
    { name: 'pallet_type_create', description: 'Create pallet types' },
    { name: 'pallet_type_read', description: 'Read pallet types' },
    { name: 'pallet_type_update', description: 'Update pallet types' },
    { name: 'pallet_type_delete', description: 'Delete pallet types' },

    // Storage Location permissions
    { name: 'storage_location_create', description: 'Create storage locations' },
    { name: 'storage_location_read', description: 'Read storage locations' },
    { name: 'storage_location_update', description: 'Update storage locations' },
    { name: 'storage_location_delete', description: 'Delete storage locations' },
    { name: 'storage_location_import', description: 'Import storage locations via excel' },

    // Pallet permissions
    { name: 'pallet_create', description: 'Create pallets' },
    { name: 'pallet_read', description: 'Read pallets' },
    { name: 'pallet_update', description: 'Update pallets' },
    { name: 'pallet_delete', description: 'Delete pallets' },

    // Warehouse Transaction permissions
    { name: 'warehouse_transaction_create', description: 'Create warehouse transactions' },
    { name: 'warehouse_transaction_read', description: 'Read warehouse transactions' },
    { name: 'warehouse_transaction_update', description: 'Update warehouse transactions' },
    { name: 'warehouse_transaction_delete', description: 'Delete warehouse transactions' },
    { name: 'warehouse_transaction_approve', description: 'Approve warehouse transactions' },

    // Approval permissions
    { name: 'approval_read', description: 'Read approvals' },
    { name: 'approval_approve', description: 'Approve transactions' },
    { name: 'approval_reject', description: 'Reject transactions' },

    // Putaway permissions
    { name: 'putaway_read', description: 'Read putaway assignment previews' },
    { name: 'putaway_assign', description: 'Assign inbound pallets to storage locations' },

    { name: 'activity_log_read', description: 'Read activity logs' },
];

const ROLES = [
    { name: 'System Admin', description: 'Full system access' },
    { name: 'Warehouse Manager', description: 'Manage warehouse operations and approvals' },
    { name: 'Warehouse Operator', description: 'Perform warehouse daily operations' },
    { name: 'Approver', description: 'Approve warehouse transactions' },
];

const ROLE_PERMISSIONS = {
    'System Admin': ['*'], // All permissions
    'Warehouse Manager': [
        'warehouse_*', 'sku_*', 'pallet_type_*', 'storage_location_*',
        'pallet_*', 'warehouse_transaction_*', 'approval_*', 'putaway_*'
    ],
    'Warehouse Operator': [
        'pallet_read', 'pallet_create', 'pallet_update',
        'warehouse_transaction_read', 'warehouse_transaction_create', 'warehouse_transaction_update',
        'storage_location_read', 'warehouse_read', 'sku_read', 'pallet_type_read',
        'putaway_read', 'putaway_assign'
    ],
    'Approver': [
        'warehouse_transaction_read', 'approval_read', 'approval_approve', 'approval_reject'
    ],
};

async function seedPermissionsAndRoles(client: Client | PoolClient) {
    console.log('Ensuring permission and role IDs have DB defaults...');
    await client.query(`
        ALTER TABLE permissions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE roles ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    `);

    console.log('Seeding permissions...');
    for (const perm of PERMISSIONS) {
        // Upsert permission
        await client.query(`
            INSERT INTO permissions (name, description, created_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
            ON CONFLICT (name) DO UPDATE SET
                description = EXCLUDED.description,
                updated_at = NOW()
        `, [perm.name, perm.description]);
    }
    console.log(`✓ ${PERMISSIONS.length} permissions seeded`);

    console.log('Seeding roles...');
    const roleIds: { [key: string]: string } = {};

    for (const role of ROLES) {
        const result = await client.query(`
            INSERT INTO roles (name, description, created_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
            ON CONFLICT (name) DO UPDATE SET
                description = EXCLUDED.description,
                updated_at = NOW()
            RETURNING id
        `, [role.name, role.description]);
        roleIds[role.name] = result.rows[0].id;
    }
    console.log(`✓ ${ROLES.length} roles seeded`);

    console.log('Assigning permissions to roles...');

    const allPermissions = await client.query('SELECT id, name FROM permissions');
    for (const [roleName, permPatterns] of Object.entries(ROLE_PERMISSIONS)) {
        const roleId = roleIds[roleName];
        if (!roleId) continue;

        for (const perm of allPermissions.rows) {
            const shouldAssign = permPatterns.includes('*') ||
                                 permPatterns.includes(perm.name) ||
                                 permPatterns.some(pattern => {
                                     if (pattern.endsWith('_*')) {
                                         const prefix = pattern.slice(0, -2);
                                         return perm.name.startsWith(prefix + '_');
                                     }
                                     return false;
                                 });

            if (shouldAssign) {
                await client.query(`
                    INSERT INTO role_has_permissions (role_id, permission_id, created_at, updated_at)
                    VALUES ($1, $2, NOW(), NOW())
                    ON CONFLICT (role_id, permission_id) DO NOTHING
                `, [roleId, perm.id]);
            }
        }
    }
    console.log('✓ Permissions assigned to roles');

    return roleIds;
}

export { PERMISSIONS, ROLES, seedPermissionsAndRoles };