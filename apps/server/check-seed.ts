import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSeed() {
    try {
        console.log('Checking seeded data...\n');

        const roles = await prisma.role.findMany({
            include: {
                permissions: {
                    include: { permission: true }
                }
            }
        });

        console.log('Roles created:');
        roles.forEach(role => {
            console.log(`- ${role.name}: ${role.permissions.length} permissions`);
            role.permissions.slice(0, 3).forEach(rp => {
                console.log(`  • ${rp.permission.name}`);
            });
            if (role.permissions.length > 3) {
                console.log(`  ... and ${role.permissions.length - 3} more`);
            }
        });

        const permissions = await prisma.permission.findMany();
        console.log(`\nTotal permissions: ${permissions.length}`);

        const users = await prisma.user.findMany({
            include: {
                roles: {
                    include: { role: true }
                }
            }
        });

        console.log('\nUsers created:');
        users.forEach(user => {
            console.log(`- ${user.email}: ${user.roles.map(ur => ur.role.name).join(', ')}`);
        });

    } catch (error) {
        console.error('Error checking data:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkSeed();