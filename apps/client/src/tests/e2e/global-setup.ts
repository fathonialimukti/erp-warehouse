import { PrismaClient } from "@prisma/client";
import { seedTestData } from "./helpers/seed";

const prisma = new PrismaClient();

export default async function globalSetup() {
  console.log("🌍 Global E2E setup...");

  // Ensure test database is ready — apply migrations
  try {
    await prisma.$connect();
    console.log("✓ Database connected");
  } catch (e) {
    console.error("❌ Database connection failed:", e);
    process.exit(1);
  }

  // Seed baseline test data (idempotent — only creates if missing)
  await seedTestData(prisma);

  // Ensure demo admin user exists for auth tests
  const adminExists = await prisma.user.findUnique({
    where: { email: "admin@mail.com" },
  });
  if (!adminExists) {
    console.log("⚠️  Demo admin user not found — auth tests will fail");
    console.log('   Run "bun run db:seed" to create demo users');
  }

  console.log("✅ Global setup complete");
  await prisma.$disconnect();
}
