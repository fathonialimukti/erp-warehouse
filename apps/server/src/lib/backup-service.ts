import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { Prisma } from "../prisma/generated/client.js";
import type { DbClient } from "./prisma.js";

export type BackupErrorCode =
  "NOT_FOUND" | "INVALID_FORMAT" | "VERSION_MISMATCH";

export class BackupError extends Error {
  readonly code: BackupErrorCode;

  constructor(code: BackupErrorCode, message: string) {
    super(message);
    this.name = "BackupError";
    this.code = code;
  }
}

export interface BackupFileMeta {
  schemaVersion: string;
  createdAt: string;
  tableCounts: Record<string, number>;
}

export interface BackupFileInfo {
  fileName: string;
  schemaVersion: string;
  createdAt: string;
  sizeBytes: number;
  tableCounts: Record<string, number>;
}

export interface BackupFile {
  meta: BackupFileMeta;
  data: Record<string, Record<string, unknown>[]>;
}

export interface RestoreOptions {
  force?: boolean;
}

const BACKUPS_DIR = path.resolve(process.cwd(), "backups");
const BACKUP_FILE_NAME_REGEX = /^[A-Za-z0-9._-]+\.json$/;
// Stay under the Postgres bind-param limit for large createMany batches.
const RESTORE_CHUNK_SIZE = 200;

// Read at runtime (not import) so it resolves from both src/ and dist/.
const require = createRequire(import.meta.url);
const { version: APP_VERSION } = require("../../package.json") as {
  version: string;
};

// Prisma.dmmf preserves schema.prisma definition order. Fine for dumping
// (order doesn't matter); restore uses resolveRestoreOrder instead, because
// definition order is not reliably FK-topological.
const MODEL_NAMES = Prisma.dmmf.datamodel.models.map((model) => model.name);

interface ModelDelegate {
  findMany: () => Promise<unknown[]>;
  deleteMany: () => Promise<unknown>;
  createMany: (args: { data: Record<string, unknown>[] }) => Promise<unknown>;
}

// PrismaClient indexes delegates by lowerFirst(modelName) ("User" -> "user").
const delegateKey = (modelName: string) =>
  modelName.charAt(0).toLowerCase() + modelName.slice(1);

const delegatesOf = (db: DbClient): Record<string, ModelDelegate> =>
  db as unknown as Record<string, ModelDelegate>;

const delegateFor = (
  dbDelegates: Record<string, ModelDelegate>,
  modelName: string,
): ModelDelegate => {
  const delegate = dbDelegates[delegateKey(modelName)];
  if (!delegate) {
    throw new Error(`Unknown Prisma delegate for model: ${modelName}`);
  }

  return delegate;
};

const ensureBackupsDir = async () => {
  await fs.mkdir(BACKUPS_DIR, { recursive: true });
};

interface ForeignKeyEdge {
  child_table: string;
  parent_table: string;
}

// Unqualified, unquoted table name from a `regclass::text` value ("public.users" -> "users").
const bareTableName = (regclassText: string) =>
  regclassText.slice(regclassText.lastIndexOf(".") + 1).replace(/"/g, "");

// Restore order: delete children before parents, insert parents before children.
// DMMF definition order is NOT reliably topological (schema.prisma defines User
// before Role, so definition-order inserts violate users_role_id_fkey on a real
// database). Derive the FK graph from the database's actual constraints instead.
// Clients without $queryRaw (test mocks, where no constraints exist) fall back
// to definition order.
const resolveRestoreOrder = async (db: DbClient): Promise<string[]> => {
  const dependencies = new Map(
    MODEL_NAMES.map((name) => [name, new Set<string>()]),
  );

  if ("$queryRaw" in db) {
    const tableToModel = new Map(
      Prisma.dmmf.datamodel.models.map((model) => [
        (model.dbName ?? model.name).replace(/"/g, ""),
        model.name,
      ]),
    );

    const edges = await db.$queryRaw<ForeignKeyEdge[]>`
            SELECT con.conrelid::regclass::text AS child_table, con.confrelid::regclass::text AS parent_table
            FROM pg_constraint con
            JOIN pg_class cls ON cls.oid = con.conrelid
            JOIN pg_namespace ns ON ns.oid = cls.relnamespace
            WHERE con.contype = 'f' AND ns.nspname = current_schema()
        `;

    for (const edge of edges) {
      const child = tableToModel.get(bareTableName(edge.child_table));
      const parent = tableToModel.get(bareTableName(edge.parent_table));
      // Self-referencing FKs have no cross-table order constraint.
      if (child && parent && child !== parent) {
        dependencies.get(child)?.add(parent);
      }
    }
  }

  const order: string[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (name: string): void => {
    const mark = state.get(name);
    if (mark === "done") {
      return;
    }
    if (mark === "visiting") {
      throw new Error(
        `Cannot restore models with cyclic foreign keys in one pass: ${name}`,
      );
    }
    state.set(name, "visiting");
    for (const dependency of dependencies.get(name) ?? []) {
      visit(dependency);
    }
    state.set(name, "done");
    order.push(name);
  };
  for (const modelName of MODEL_NAMES) {
    visit(modelName);
  }

  return order;
};

const toFileNameTimestamp = (isoDate: string) => isoDate.split(":").join("-");

// Externally-supplied file names must be a bare safe file name — anything else
// (traversal, slashes, non-.json) is NOT_FOUND so it never leaks existence.
const resolveBackupPath = (fileName: string) => {
  if (!BACKUP_FILE_NAME_REGEX.test(fileName) || fileName.includes("..")) {
    throw new BackupError("NOT_FOUND", `Backup not found: ${fileName}`);
  }

  return path.join(BACKUPS_DIR, fileName);
};

const createBackup = async (
  db: DbClient,
): Promise<BackupFileMeta & { fileName: string }> => {
  await ensureBackupsDir();

  const data: BackupFile["data"] = {};
  const tableCounts: Record<string, number> = {};
  const dbDelegates = delegatesOf(db);

  for (const modelName of MODEL_NAMES) {
    const rows = (await delegateFor(
      dbDelegates,
      modelName,
    ).findMany()) as Record<string, unknown>[];
    data[modelName] = rows;
    tableCounts[modelName] = rows.length;
  }

  const meta: BackupFileMeta = {
    schemaVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
    tableCounts,
  };

  const fileName = `backup-${toFileNameTimestamp(meta.createdAt)}.json`;
  await fs.writeFile(
    path.join(BACKUPS_DIR, fileName),
    JSON.stringify({ meta, data }),
    "utf8",
  );

  return { ...meta, fileName };
};

// ── Bounded meta extraction for listBackups ─────────────────────────────────
// Backups are serialized with meta as the FIRST key: {"meta":{...},"data":{...}}.
// Full-parsing every file just to read meta spiked RSS by ~fileSize per entry,
// so read a bounded head of the file and brace-count from `"meta":{` to its
// balanced close. Only files whose head cannot be extracted (corrupt/legacy)
// fall back to a full parse.
const META_HEAD_BYTES = 64 * 1024;

const readHeadText = async (
  filePath: string,
  bytes: number,
): Promise<string> => {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.toString("utf8", 0, bytesRead);
  } finally {
    await handle.close();
  }
};

// text[start] must be '{'; scan to its balanced close, skipping string literals,
// and parse that fragment. Returns null when it is not a valid meta object.
const parseMetaObject = (
  text: string,
  start: number,
): BackupFileMeta | null => {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index++) {
    const char = text[index]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        try {
          const meta = JSON.parse(
            text.slice(start, index + 1),
          ) as BackupFileMeta;
          if (
            typeof meta?.schemaVersion === "string" &&
            typeof meta?.createdAt === "string"
          ) {
            return meta;
          }
        } catch {
          // not the meta object after all — fall back to a full parse
        }
        return null;
      }
    }
  }
  return null; // unbalanced within the head
};

const extractMetaFromHead = (headText: string): BackupFileMeta | null => {
  const keyIndex = headText.indexOf('"meta"');
  if (keyIndex === -1) {
    return null;
  }

  let cursor = keyIndex + '"meta"'.length;
  while (cursor < headText.length && /\s/.test(headText[cursor]!)) cursor++;
  if (headText[cursor] !== ":") {
    return null;
  }
  cursor++;
  while (cursor < headText.length && /\s/.test(headText[cursor]!)) cursor++;
  if (headText[cursor] !== "{") {
    return null;
  }

  return parseMetaObject(headText, cursor);
};

const readMetaFullParse = async (
  filePath: string,
): Promise<BackupFileMeta | null> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as BackupFile;
    if (
      typeof parsed?.meta?.schemaVersion !== "string" ||
      typeof parsed?.meta?.createdAt !== "string"
    ) {
      return null;
    }
    return parsed.meta;
  } catch {
    return null;
  }
};

const listBackups = async (): Promise<BackupFileInfo[]> => {
  let fileNames: string[];
  try {
    fileNames = await fs.readdir(BACKUPS_DIR);
  } catch {
    return [];
  }

  const infos = await Promise.all(
    fileNames
      .filter(
        (fileName) =>
          BACKUP_FILE_NAME_REGEX.test(fileName) &&
          fileName.startsWith("backup-"),
      )
      .map(async (fileName): Promise<BackupFileInfo | null> => {
        const filePath = path.join(BACKUPS_DIR, fileName);
        let meta: BackupFileMeta | null;
        let sizeBytes: number;
        try {
          sizeBytes = (await fs.stat(filePath)).size;
          meta =
            extractMetaFromHead(
              await readHeadText(filePath, META_HEAD_BYTES),
            ) ?? (await readMetaFullParse(filePath));
        } catch {
          return null;
        }
        if (!meta) {
          return null;
        }

        return {
          fileName,
          schemaVersion: meta.schemaVersion,
          createdAt: meta.createdAt,
          sizeBytes,
          tableCounts: meta.tableCounts ?? {},
        };
      }),
  );

  return infos
    .filter((info): info is BackupFileInfo => info !== null)
    .sort((a, b) => b.fileName.localeCompare(a.fileName));
};

const readBackup = async (fileName: string): Promise<BackupFile> => {
  const filePath = resolveBackupPath(fileName);

  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    throw new BackupError("NOT_FOUND", `Backup not found: ${fileName}`);
  }

  try {
    return JSON.parse(raw) as BackupFile;
  } catch {
    throw new BackupError(
      "INVALID_FORMAT",
      `Backup file is not valid JSON: ${fileName}`,
    );
  }
};

// Shared format validation for restore + upload: every data key must be a known
// Prisma model mapping to an array, and every row must be a plain object —
// anything else would surface as a generic Prisma 500 at restore time instead of
// a clean INVALID_FORMAT.
const validateBackupData = (
  data: Record<string, unknown>,
  source: string,
): void => {
  for (const [modelName, rows] of Object.entries(data)) {
    if (!MODEL_NAMES.includes(modelName) || !Array.isArray(rows)) {
      throw new BackupError(
        "INVALID_FORMAT",
        `Backup contains unknown table "${modelName}": ${source}`,
      );
    }
    for (const row of rows) {
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        throw new BackupError(
          "INVALID_FORMAT",
          `Backup table "${modelName}" contains a row that is not an object: ${source}`,
        );
      }
    }
  }
};

const restoreBackup = async (
  db: DbClient,
  fileName: string,
  options: RestoreOptions = {},
) => {
  const { meta, data } = await readBackup(fileName);

  if (
    typeof meta !== "object" ||
    meta === null ||
    typeof data !== "object" ||
    data === null ||
    Array.isArray(data)
  ) {
    throw new BackupError(
      "INVALID_FORMAT",
      `Backup file has unexpected structure: ${fileName}`,
    );
  }

  validateBackupData(data, fileName);

  if (meta.schemaVersion !== APP_VERSION && !options.force) {
    throw new BackupError(
      "VERSION_MISMATCH",
      `Backup schema version "${meta.schemaVersion}" does not match app version "${APP_VERSION}": ${fileName}`,
    );
  }

  const runRestore = async (tx: DbClient) => {
    const dbDelegates = delegatesOf(tx);
    const restoreOrder = await resolveRestoreOrder(tx);

    // Destructive replace: wipe every model in REVERSE restore order
    // (children before parents), then re-insert in restore order (parents
    // before children).
    for (const modelName of [...restoreOrder].reverse()) {
      await delegateFor(dbDelegates, modelName).deleteMany();
    }

    for (const modelName of restoreOrder) {
      const rows = data[modelName];
      if (!rows?.length) {
        continue;
      }

      const delegate = delegateFor(dbDelegates, modelName);
      // Chunked createMany would break a SELF-referential FK whose parent row
      // lands in a different chunk; no self-FK model exists today, but if one
      // is ever added, un-chunk that table or topo-sort its rows within it.
      for (let index = 0; index < rows.length; index += RESTORE_CHUNK_SIZE) {
        await delegate.createMany({
          data: rows.slice(index, index + RESTORE_CHUNK_SIZE),
        });
      }
    }
  };

  // Run as ONE transaction. If the caller already opened one
  // (transactionalProtectedProcedure passes a TransactionClient), use it as-is.
  if ("$transaction" in db) {
    await db.$transaction(async (tx) => runRestore(tx));
    return;
  }

  await runRestore(db);
};

const deleteBackup = async (fileName: string) => {
  const filePath = resolveBackupPath(fileName);

  try {
    await fs.unlink(filePath);
  } catch {
    throw new BackupError("NOT_FOUND", `Backup not found: ${fileName}`);
  }
};

// Sanitize an externally-supplied name to the lib's safe pattern. The "backup-"
// prefix keeps imported files visible to listBackups' filter. Null → caller falls
// back to a timestamp name.
const sanitizeBackupFileName = (input: string): string | null => {
  const base = path.basename(input.trim());
  if (!base || base.includes("..")) {
    return null;
  }

  const withExtension = base.toLowerCase().endsWith(".json")
    ? base
    : `${base}.json`;
  const cleaned = withExtension.replace(/[^A-Za-z0-9._-]/g, "_");
  const named = cleaned.startsWith("backup-") ? cleaned : `backup-${cleaned}`;
  return BACKUP_FILE_NAME_REGEX.test(named) ? named : null;
};

// Validate + persist an uploaded backup (raw decoded JSON string). The original
// content is written verbatim so meta (schemaVersion/createdAt) is preserved.
const saveBackupFromContent = async (
  content: string,
  fileName?: string,
): Promise<BackupFileInfo> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new BackupError(
      "INVALID_FORMAT",
      "Uploaded backup content is not valid JSON",
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new BackupError(
      "INVALID_FORMAT",
      "Uploaded backup must be a JSON object",
    );
  }

  const { meta, data } = parsed as { meta?: unknown; data?: unknown };
  if (
    typeof meta !== "object" ||
    meta === null ||
    typeof data !== "object" ||
    data === null ||
    Array.isArray(data)
  ) {
    throw new BackupError(
      "INVALID_FORMAT",
      "Uploaded backup is missing meta or data sections",
    );
  }

  const { schemaVersion, createdAt, tableCounts } = meta as {
    schemaVersion?: unknown;
    createdAt?: unknown;
    tableCounts?: Record<string, number>;
  };
  if (typeof schemaVersion !== "string" || typeof createdAt !== "string") {
    throw new BackupError(
      "INVALID_FORMAT",
      "Uploaded backup meta must include schemaVersion and createdAt",
    );
  }

  // Same table/row rules as restore: reject unknown table keys up front so an
  // unusable backup is never persisted, instead of failing later at restore.
  validateBackupData(data as Record<string, unknown>, "uploaded backup");

  const resolvedFileName =
    (fileName ? sanitizeBackupFileName(fileName) : null) ??
    `backup-${toFileNameTimestamp(new Date().toISOString())}.json`;

  await ensureBackupsDir();
  // Overwriting an existing file with the same name is intentional (re-import
  // semantics: uploading a file again replaces the previous copy).
  await fs.writeFile(path.join(BACKUPS_DIR, resolvedFileName), content, "utf8");

  return {
    fileName: resolvedFileName,
    schemaVersion,
    createdAt,
    sizeBytes: Buffer.byteLength(content, "utf8"),
    tableCounts: tableCounts ?? {},
  };
};

// Raw file text for download — goes through resolveBackupPath so traversal is NOT_FOUND.
const readBackupContent = async (fileName: string): Promise<string> => {
  const filePath = resolveBackupPath(fileName);

  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    throw new BackupError("NOT_FOUND", `Backup not found: ${fileName}`);
  }
};

// The server's package version — the schemaVersion the service stamps into
// backups and enforces at restore. Exported so the router can hand it to the
// client (whose package version can drift from the server's).
export {
  createBackup,
  listBackups,
  readBackup,
  restoreBackup,
  deleteBackup,
  saveBackupFromContent,
  readBackupContent,
  APP_VERSION as appVersion,
};
