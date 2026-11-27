import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createCaller } from "./helpers/caller.js";
import { seedRoleWithPermissions, seedTestUser } from "./helpers/seed.js";
import { prisma } from "../lib/prisma.js";
import { __testHooks } from "../routers/landing.js";

const anonCaller = () => createCaller(null);
const marker = `Probe${randomUUID().slice(0, 8)}`;
const originalNotifyTo = process.env.CONTACT_NOTIFY_TO;

let ownerCaller: ReturnType<typeof createCaller>;
let deniedCaller: ReturnType<typeof createCaller>;
let ownerUserId: string;
let ownerRoleId: string;
let deniedUserId: string;
let deniedRoleId: string;
const submissionIds: string[] = [];

beforeAll(async () => {
  // Exercise the disabled-email path: submissions must still persist.
  delete process.env.CONTACT_NOTIFY_TO;

  const ownerRole = await seedRoleWithPermissions(["landing@read"]);
  ownerRoleId = ownerRole.id;
  const owner = await seedTestUser({
    roleId: ownerRole.id,
    email: `contact-owner-${randomUUID()}@example.com`,
    name: "Contact Owner",
  });
  ownerUserId = owner.id;
  ownerCaller = createCaller({
    userId: owner.id,
    email: owner.email,
    name: owner.name,
  });

  const deniedRole = await seedRoleWithPermissions([]);
  deniedRoleId = deniedRole.id;
  const denied = await seedTestUser({
    roleId: deniedRole.id,
    email: `contact-denied-${randomUUID()}@example.com`,
    name: "Contact Denied",
  });
  deniedUserId = denied.id;
  deniedCaller = createCaller({
    userId: denied.id,
    email: denied.email,
    name: denied.name,
  });

  for (const suffix of ["One", "Two", "Three", "Four"]) {
    const row = await prisma.contactSubmission.create({
      data: {
        name: `${marker} ${suffix}`,
        email: `${marker.toLowerCase()}-${suffix.toLowerCase()}@example.com`,
        company: "Test Co",
        message: `${marker} inquiry ${suffix}`,
      },
      select: { id: true },
    });
    submissionIds.push(row.id);
  }
});

afterAll(async () => {
  if (originalNotifyTo === undefined) delete process.env.CONTACT_NOTIFY_TO;
  else process.env.CONTACT_NOTIFY_TO = originalNotifyTo;

  await prisma.contactSubmission.deleteMany({
    where: { id: { in: submissionIds } },
  });
  await prisma.user.delete({ where: { id: ownerUserId } });
  await prisma.role.delete({ where: { id: ownerRoleId } });
  await prisma.user.delete({ where: { id: deniedUserId } });
  await prisma.role.delete({ where: { id: deniedRoleId } });
});

beforeEach(() => {
  __testHooks.clearContactRateLimits();
});

describe("landing.listContactSubmissions", () => {
  it("requires authentication", async () => {
    await expect(
      anonCaller().landing.listContactSubmissions({}),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires landing@read", async () => {
    await expect(
      deniedCaller.landing.listContactSubmissions({}),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("paginates with a default limit of 50", async () => {
    const result = await ownerCaller.landing.listContactSubmissions({});
    expect(result.pagination).toMatchObject({
      page: 1,
      limit: 50,
      totalPages: Math.ceil(result.pagination.total / 50),
    });
    expect(result.pagination.total).toBeGreaterThanOrEqual(4);
    expect(result.data.length).toBeLessThanOrEqual(50);
  });

  it("paginates by page and limit", async () => {
    const first = await ownerCaller.landing.listContactSubmissions({
      page: 1,
      limit: 2,
    });
    const second = await ownerCaller.landing.listContactSubmissions({
      page: 2,
      limit: 2,
    });

    expect(first.data).toHaveLength(2);
    expect(second.data).toHaveLength(2);
    expect(first.pagination).toMatchObject({ page: 1, limit: 2 });
    expect(second.pagination).toMatchObject({ page: 2, limit: 2 });

    const firstIds = new Set(first.data.map((row) => row.id));
    expect(second.data.some((row) => firstIds.has(row.id))).toBe(false);
  });

  it("searches name/email case-insensitively and returns full fields", async () => {
    const result = await ownerCaller.landing.listContactSubmissions({
      search: marker,
    });
    expect(result.pagination.total).toBe(4);
    expect(result.data).toHaveLength(4);

    const upper = await ownerCaller.landing.listContactSubmissions({
      search: marker.toUpperCase(),
      limit: 100,
    });
    expect(upper.pagination.total).toBe(4);

    const one = result.data.find((row) => row.name === `${marker} One`);
    expect(one).toMatchObject({
      email: `${marker.toLowerCase()}-one@example.com`,
      company: "Test Co",
      message: `${marker} inquiry One`,
    });
    expect(one).toHaveProperty("createdAt");
  });
});

describe("landing.submitContact with email disabled", () => {
  it("persists the inquiry when CONTACT_NOTIFY_TO is unset", async () => {
    expect(process.env.CONTACT_NOTIFY_TO).toBeUndefined();
    const email = `contact-disabled-${randomUUID()}@example.com`;

    const result = await anonCaller().landing.submitContact({
      name: "Disabled Mail",
      email,
      company: "Test Co",
      message: "No email configured.",
    });
    expect(result.success).toBe(true);
    submissionIds.push(result.id);

    const row = await prisma.contactSubmission.findUnique({
      where: { id: result.id },
    });
    expect(row).toMatchObject({
      name: "Disabled Mail",
      email,
      company: "Test Co",
      message: "No email configured.",
    });

    const listed = await ownerCaller.landing.listContactSubmissions({
      search: email,
    });
    expect(listed.pagination.total).toBe(1);
    expect(listed.data[0]?.id).toBe(result.id);
  });
});
