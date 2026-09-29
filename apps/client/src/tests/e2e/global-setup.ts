import { prisma } from "../../../../server/src/lib/prisma.js";
import { seedTestData } from "./helpers/seed.js";

/**
 * Playwright `globalSetup`.
 *
 * Prisma comes from the SERVER package. `@prisma/client` is not installed
 * under `apps/client` (Prisma is a server concern), and `prisma.d.ts` declared
 * the module for `tsc` only — at runtime `import { PrismaClient } from
 * "@prisma/client"` fails module resolution, so this file (and the teardown)
 * threw before doing anything. Importing the server's own singleton makes the
 * fixtures real.
 *
 * CI seeds the E2E database with the real seeder
 * (`bun run src/prisma/seed.ts` in apps/server — see
 * `.github/workflows/e2e.yml`), so the demo roster checked below is exactly
 * what a developer gets from `db:seed`. `seedTestData` only tops up a database
 * that was never seeded at all.
 */
export default async function globalSetup() {
  console.log("🌍 Global E2E setup...");

  try {
    await prisma.$connect();
    console.log("✓ Database connected");
  } catch (e) {
    console.error("❌ Database connection failed:", e);
    process.exit(1);
  }

  await seedTestData(prisma);

  const adminExists = await prisma.user.findUnique({
    where: { email: "admin@aetherglo.com" },
  });
  if (!adminExists) {
    console.log(
      "⚠️  Demo admin user not found — auth tests will fail. Seed the database first:",
    );
    console.log("   bun run --cwd apps/server src/prisma/seed.ts");
    process.exitCode = 1;
  } else {
    console.log("✓ Demo admin present (admin@aetherglo.com)");
  }

  console.log("✅ Global setup complete");
  await prisma.$disconnect();
}
