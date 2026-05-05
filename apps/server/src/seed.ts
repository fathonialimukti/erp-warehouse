import { pool, prisma } from './lib/prisma';
import { hashPassword } from './lib/password';
import { seedAccessControl } from './prisma/seed/access-control-seeder.js';
import { seedSkus, seedPalletTypes } from './prisma/seed/sku-seeder.js';
import { seedWarehouses, seedStorageLocations } from './prisma/seed/warehouse-seeder.js';
import { seedInboundTransactions } from './prisma/seed/inbound-transaction-seeder.js';

async function main() {
    console.log('Starting seed...');

    const client = await pool.connect();
    try {
        await seedAccessControl(client);

        // Create test users after access control is seeded
        const hashedPassword = await hashPassword('password123');
        const adminRole = await prisma.role.findFirst({ where: { name: 'System Admin' } });
        const userRole = await prisma.role.findFirst({ where: { name: 'Warehouse Operator' } });

        if (adminRole) {
            await prisma.user.upsert({
                where: { email: 'admin@example.com' },
                update: {
                    name: 'Admin User',
                    password: hashedPassword,
                    roleId: adminRole.id,
                },
                create: {
                    email: 'admin@example.com',
                    name: 'Admin User',
                    password: hashedPassword,
                    roleId: adminRole.id,
                },
            });
        }

        if (userRole) {
            await prisma.user.upsert({
                where: { email: 'user@example.com' },
                update: {
                    name: 'Regular User',
                    password: hashedPassword,
                    roleId: userRole.id,
                },
                create: {
                    email: 'user@example.com',
                    name: 'Regular User',
                    password: hashedPassword,
                    roleId: userRole.id,
                },
            });
        }

        const warehouseIds = await seedWarehouses(client);
        const lokasiIds = await seedStorageLocations(client, warehouseIds);
        const skuIds = await seedSkus(client);
        const palletTypeIds = await seedPalletTypes(client, skuIds);
        await seedInboundTransactions(client, warehouseIds, lokasiIds, skuIds, palletTypeIds);
    } finally {
        client.release();
    }

    console.log('Seed completed!');
    console.log('Test credentials:');
    console.log('  Admin: admin@example.com / password123');
    console.log('  User: user@example.com / password123');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
