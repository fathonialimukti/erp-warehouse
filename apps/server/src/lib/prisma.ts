import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../prisma/generated/client";

if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
  process.noDeprecation = true;
  process.on("warning", (warning) => {
    if (
      warning.name === "DeprecationWarning" &&
      warning.message.includes(
        "Calling client.query() when the client is already executing a query",
      )
    ) {
      return;
    }
    console.warn(warning);
  });
}

const connectionString = process.env.DATABASE_URL!;
const maxConnections = Number(process.env.DB_POOL_MAX ?? 10);
const idleTimeoutMillis = Number(process.env.DB_POOL_IDLE_MS ?? 10000);
const connectionTimeoutMillis = Number(
  process.env.DB_POOL_CONNECT_TIMEOUT_MS ?? 2000,
);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
    max: maxConnections,
    idleTimeoutMillis,
    connectionTimeoutMillis,
  });

const adapter = new PrismaPg(pool);
const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

export type DbClient = PrismaClient | Prisma.TransactionClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
  globalForPrisma.prisma = prisma;
}

export { prisma, pool };
