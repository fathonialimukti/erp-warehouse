import type { Client, PoolClient } from "pg";
import { hashSync } from "bcrypt";
import { randomBytes } from "node:crypto";
import {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  matchesPattern,
} from "../catalog/rbac.js";
import { DEMO_PASSWORD, SEED_USERS } from "../catalog/users.js";

/** Returns { [roleName]: roleId }; clears old roles/permissions and re-inserts. */
export async function seedPermissionsAndRoles(
  client: Client | PoolClient,
): Promise<Record<string, string>> {
  await client.query(
    "UPDATE users SET role_id = NULL WHERE role_id IS NOT NULL",
  );
  await client.query("DELETE FROM role_has_permissions");
  await client.query("DELETE FROM permissions");
  await client.query("DELETE FROM roles");

  await client.query(`
    ALTER TABLE permissions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE roles ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  `);

  for (const p of PERMISSIONS) {
    await client.query(
      "INSERT INTO permissions (name, description, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())",
      [p.name, p.description],
    );
  }
  const roleIds: Record<string, string> = {};
  for (const r of ROLES) {
    const { rows } = await client.query<{ id: string }>(
      "INSERT INTO roles (name, description, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id",
      [r.name, r.description],
    );
    roleIds[r.name] = rows[0]!.id;
  }

  const { rows: perms } = await client.query<{ id: string; name: string }>(
    "SELECT id, name FROM permissions",
  );
  for (const [roleName, patterns] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleIds[roleName];
    if (!roleId) continue;
    for (const perm of perms) {
      if (matchesPattern(perm.name, patterns)) {
        await client.query(
          "INSERT INTO role_has_permissions (role_id, permission_id, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())",
          [roleId, perm.id],
        );
      }
    }
  }
  return roleIds;
}

/** Creates all SEED_USERS with the shared demo password; roles assigned.
 *  The AI System user (role null) gets role_id NULL + a random password so it
 *  stays in the DB for background jobs but can never log in. Any stray `n8n`
 *  integration user from an older seed is deleted (never seeded here). */
export async function seedUsers(
  client: Client | PoolClient,
  roleIds: Record<string, string>,
): Promise<Record<string, string>> {
  const demoHash = hashSync(DEMO_PASSWORD, 10);
  const out: Record<string, string> = {};
  for (const u of SEED_USERS) {
    const password =
      u.role === null
        ? hashSync(randomBytes(32).toString("hex"), 10)
        : demoHash;
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO users (email, name, password, role_id, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password, role_id = EXCLUDED.role_id,
         description = EXCLUDED.description, updated_at = NOW()
       RETURNING id`,
      [
        u.email,
        u.name,
        password,
        u.role ? (roleIds[u.role] ?? null) : null,
        u.description,
      ],
    );
    out[u.email] = rows[0]!.id;
  }
  // Contract: no `n8n` seed — remove any row an older seed may have left.
  await client.query("DELETE FROM users WHERE email ILIKE '%n8n%'");
  return out;
}
