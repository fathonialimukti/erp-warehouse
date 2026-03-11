import { prisma } from './lib/prisma';
import { hashPassword } from './lib/password';

async function main() {
    console.log('Starting seed...');

    // Create roles
    const adminRole = await prisma.role.upsert({
        where: { name: 'Admin' },
        update: {},
        create: {
            name: 'Admin',
            description: 'Administrator role with full access',
        },
    });

    const userRole = await prisma.role.upsert({
        where: { name: 'User' },
        update: {},
        create: {
            name: 'User',
            description: 'Regular user role',
        },
    });

    // Create permissions for all modules
    const modules = ['role', 'permission'];
    const actions = ['read', 'create', 'update', 'delete'];
    const permissions = [] as Array<{ id: string; name: string; action: string }>;

    for (const moduleName of modules) {
        for (const action of actions) {
            const name = `${moduleName}:${action}`;
            const permission = await prisma.permission.upsert({
                where: { name },
                update: {},
                create: {
                    name,
                    description: `Can ${action} ${moduleName}`,
                },
            });

            permissions.push({ id: permission.id, name, action });
        }
    }

    // Assign permissions to roles
    for (const permission of permissions) {
        await prisma.roleHasPermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: adminRole.id,
                    permissionId: permission.id,
                },
            },
            update: {},
            create: {
                roleId: adminRole.id,
                permissionId: permission.id,
            },
        });

        if (permission.action === 'read') {
            await prisma.roleHasPermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: userRole.id,
                        permissionId: permission.id,
                    },
                },
                update: {},
                create: {
                    roleId: userRole.id,
                    permissionId: permission.id,
                },
            });
        }
    }

    // Create test users
    const hashedPassword = await hashPassword('password123');

    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {},
        create: {
            email: 'admin@example.com',
            name: 'Admin User',
            password: hashedPassword,
        },
    });

    const normalUser = await prisma.user.upsert({
        where: { email: 'user@example.com' },
        update: {},
        create: {
            email: 'user@example.com',
            name: 'Normal User',
            password: hashedPassword,
        },
    });

    // Assign roles to users
    await prisma.userHasRole.upsert({
        where: {
            userId_roleId: {
                userId: adminUser.id,
                roleId: adminRole.id,
            },
        },
        update: {},
        create: {
            userId: adminUser.id,
            roleId: adminRole.id,
        },
    });

    await prisma.userHasRole.upsert({
        where: {
            userId_roleId: {
                userId: normalUser.id,
                roleId: userRole.id,
            },
        },
        update: {},
        create: {
            userId: normalUser.id,
            roleId: userRole.id,
        },
    });

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
