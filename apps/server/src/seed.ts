import { prisma } from './lib/prisma';
import { hashPassword } from './lib/password';
import { seedPermissionsAndRoles } from './prisma/seed/permission-seeder.js';

async function main() {
    console.log('Starting seed...');

    // Seed permissions and roles
    await seedPermissionsAndRoles(prisma);

    // Create test users
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
                username: 'admin',
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
                username: 'user',
                password: hashedPassword,
                roleId: userRole.id,
            },
        });
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
