import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { randomUUID } from "crypto";
import { createCaller } from "../helpers/caller.js";
import { seedRoleWithPermissions, seedTestUser } from "../helpers/seed.js";
import { prisma } from "../../lib/prisma.js";
import { DEFAULT_LOCALE, getMessage } from "../../lib/locale.js";

const require = createRequire(import.meta.url);
const { version: APP_VERSION } = require("../../../package.json") as {
  version: string;
};

const BACKUPS_DIR = path.resolve(process.cwd(), "backups");
const toBase64 = (content: string) =>
  Buffer.from(content, "utf8").toString("base64");

let caller: ReturnType<typeof createCaller>;
let lowPermCaller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let lowPermUserId: string;
let lowPermRoleId: string;

// Files created through the router (create/upload) — removed in afterAll.
const createdFileNames: string[] = [];
let fakeVersionFileName: string;
let snapshotInfo: {
  fileName: string;
  schemaVersion: string;
  createdAt: string;
};
let dependentUserId: string;

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    "backup@read",
    "backup@create",
    "backup@restore",
    "backup@delete",
  ]);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: "Backup Actor",
  });
  actorUserId = actor.id;
  caller = createCaller({
    userId: actor.id,
    email: actor.email,
    name: actor.name,
  });

  const lowPermRole = await seedRoleWithPermissions([]);
  lowPermRoleId = lowPermRole.id;
  const lowPermUser = await seedTestUser({
    roleId: lowPermRoleId,
    email: `low-perm-${randomUUID()}@example.com`,
    name: "Backup NoPerms",
  });
  lowPermUserId = lowPermUser.id;
  lowPermCaller = createCaller({
    userId: lowPermUser.id,
    email: lowPermUser.email,
    name: lowPermUser.name,
  });
});

afterAll(async () => {
  await Promise.all(
    createdFileNames.map((fileName) =>
      fs.rm(path.join(BACKUPS_DIR, fileName), { force: true }),
    ),
  );
  await fs
    .rm(BACKUPS_DIR, { recursive: true, force: true })
    .catch(() => undefined);
  createdFileNames.length = 0;

  // Resilient: a mid-file failure (or a restore that re-created rows) must not
  // cascade into cleanup errors that mask the real failure.
  await prisma.user
    .delete({ where: { id: dependentUserId } })
    .catch(() => undefined);
  await prisma.user
    .delete({ where: { id: actorUserId } })
    .catch(() => undefined);
  await prisma.user
    .delete({ where: { id: lowPermUserId } })
    .catch(() => undefined);
  await prisma.role
    .delete({ where: { id: actorRoleId } })
    .catch(() => undefined);
  await prisma.role
    .delete({ where: { id: lowPermRoleId } })
    .catch(() => undefined);
});

describe("backup router", () => {
  it("create returns sane BackupFileInfo and list includes it", async () => {
    const info = await caller.backup.create();
    createdFileNames.push(info.fileName);

    expect(info.fileName).toMatch(
      /^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/,
    );
    expect(info.schemaVersion).toBe(APP_VERSION);
    expect(Number.isNaN(Date.parse(info.createdAt))).toBe(false);
    expect(Object.keys(info.tableCounts).length).toBeGreaterThan(0);
    expect(info.tableCounts.User).toBeGreaterThanOrEqual(1);

    const list = await caller.backup.list();
    const entry = list.backups.find((item) => item.fileName === info.fileName);
    expect(entry).toBeDefined();
    expect(entry?.schemaVersion).toBe(APP_VERSION);
    expect(entry?.sizeBytes).toBeGreaterThan(0);
    // Contract: list exposes the SERVER app version (the restore-modal comparison
    // source), which equals the schemaVersion stamped into fresh backups.
    expect(list.appVersion).toBe(APP_VERSION);
  });

  it("upload rejects non-JSON content with 400 backup.invalidFormat", async () => {
    await expect(
      caller.backup.upload({ content: toBase64("this is not json") }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: getMessage(DEFAULT_LOCALE, "backup.invalidFormat"),
    });
  });

  it("upload rejects JSON without meta with 400 backup.invalidFormat", async () => {
    await expect(
      caller.backup.upload({ content: toBase64(JSON.stringify({ data: {} })) }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: getMessage(DEFAULT_LOCALE, "backup.invalidFormat"),
    });
  });

  it("upload preserves meta verbatim and the fake version shows up in list", async () => {
    const uploadInfo = await caller.backup.upload({
      fileName: "fake-version-9.9.9",
      content: toBase64(
        JSON.stringify({
          meta: {
            schemaVersion: "9.9.9",
            createdAt: "2026-01-02T03:04:05.000Z",
            tableCounts: {},
          },
          data: {},
        }),
      ),
    });
    createdFileNames.push(uploadInfo.fileName);
    fakeVersionFileName = uploadInfo.fileName;

    // sanitize: bare name -> "backup-" prefixed .json file
    expect(uploadInfo.fileName).toBe("backup-fake-version-9.9.9.json");
    expect(uploadInfo.schemaVersion).toBe("9.9.9");
    expect(uploadInfo.createdAt).toBe("2026-01-02T03:04:05.000Z");

    const list = await caller.backup.list();
    const entry = list.backups.find(
      (item) => item.fileName === uploadInfo.fileName,
    );
    expect(entry).toBeDefined();
    expect(entry?.schemaVersion).toBe("9.9.9");
    expect(entry?.createdAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("upload rejects unknown data table keys with 400 backup.invalidFormat", async () => {
    await expect(
      caller.backup.upload({
        content: toBase64(
          JSON.stringify({
            meta: {
              schemaVersion: APP_VERSION,
              createdAt: "2026-01-02T03:04:05.000Z",
              tableCounts: {},
            },
            data: { NotAModel: [] },
          }),
        ),
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: getMessage(DEFAULT_LOCALE, "backup.invalidFormat"),
    });
  });

  it("restore guards version mismatch (409) unless forced", async () => {
    // Craft a 9.9.9 backup whose data is a faithful snapshot of the current DB,
    // so the forced restore below restores exactly what is already there
    // (content-neutral for the shared dev DB) instead of wiping it to {}.
    const fresh = await caller.backup.create();
    createdFileNames.push(fresh.fileName);
    const { base64 } = await caller.backup.download({
      fileName: fresh.fileName,
    });
    const snapshot = JSON.parse(
      Buffer.from(base64, "base64").toString("utf8"),
    ) as {
      meta: { schemaVersion: string };
      data: Record<string, unknown[]>;
    };
    snapshot.meta.schemaVersion = "9.9.9";
    const forcedInfo = await caller.backup.upload({
      fileName: "force-restore-fake-version",
      content: toBase64(JSON.stringify(snapshot)),
    });
    createdFileNames.push(forcedInfo.fileName);
    expect(forcedInfo.schemaVersion).toBe("9.9.9");

    await expect(
      caller.backup.restore({ fileName: forcedInfo.fileName }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: getMessage(DEFAULT_LOCALE, "backup.versionMismatch"),
    });

    const result = await caller.backup.restore({
      fileName: forcedInfo.fileName,
      force: true,
    });
    expect(result).toEqual({ success: true });

    // The forced restore restored the snapshot: rows are still intact.
    expect(
      await prisma.user.findUnique({ where: { id: actorUserId } }),
    ).not.toBeNull();
    expect(
      await prisma.role.findUnique({ where: { id: actorRoleId } }),
    ).not.toBeNull();
  });

  it("restore roundtrip brings back deleted rows from the snapshot", async () => {
    const dependent = await seedTestUser({
      roleId: actorRoleId,
      email: `dependent-${randomUUID()}@example.com`,
      name: "Backup Dependent",
    });
    dependentUserId = dependent.id;

    snapshotInfo = await caller.backup.create();
    createdFileNames.push(snapshotInfo.fileName);

    await prisma.user.delete({ where: { id: dependent.id } });
    expect(
      await prisma.user.findUnique({ where: { id: dependent.id } }),
    ).toBeNull();

    const result = await caller.backup.restore({
      fileName: snapshotInfo.fileName,
    });
    expect(result).toEqual({ success: true });

    const restored = await prisma.user.findUnique({
      where: { id: dependent.id },
    });
    expect(restored?.email).toBe(dependent.email);
    expect(restored?.name).toBe(dependent.name);
    expect(restored?.roleId).toBe(actorRoleId);
    expect(
      await prisma.user.findUnique({ where: { id: actorUserId } }),
    ).not.toBeNull();
    expect(
      await prisma.role.findUnique({ where: { id: actorRoleId } }),
    ).not.toBeNull();
  });

  it("download returns base64 that decodes to the created backup content", async () => {
    const download = await caller.backup.download({
      fileName: snapshotInfo.fileName,
    });
    expect(download.fileName).toBe(snapshotInfo.fileName);

    const parsed = JSON.parse(
      Buffer.from(download.base64, "base64").toString("utf8"),
    ) as {
      meta: {
        schemaVersion: string;
        createdAt: string;
        tableCounts: Record<string, number>;
      };
    };
    expect(parsed.meta.schemaVersion).toBe(snapshotInfo.schemaVersion);
    expect(parsed.meta.createdAt).toBe(snapshotInfo.createdAt);
    expect(parsed.meta.tableCounts.User).toBeGreaterThanOrEqual(1);
  });

  it("delete removes the file from list and download then 404s", async () => {
    const result = await caller.backup.delete({
      fileName: fakeVersionFileName,
    });
    expect(result).toEqual({ success: true });

    const list = await caller.backup.list();
    expect(
      list.backups.some((item) => item.fileName === fakeVersionFileName),
    ).toBe(false);

    await expect(
      caller.backup.download({ fileName: fakeVersionFileName }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: getMessage(DEFAULT_LOCALE, "backup.notFound"),
    });
  });

  it("denies each procedure without the required permission", async () => {
    await expect(lowPermCaller.backup.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(lowPermCaller.backup.create()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      lowPermCaller.backup.upload({ content: toBase64("{}") }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      lowPermCaller.backup.restore({ fileName: "whatever.json" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      lowPermCaller.backup.download({ fileName: "whatever.json" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      lowPermCaller.backup.delete({ fileName: "whatever.json" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
