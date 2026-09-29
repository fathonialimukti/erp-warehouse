import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";

export type UploadImageErrorCode =
  "INVALID_IMAGE_FORMAT" | "UNSUPPORTED_IMAGE_FORMAT";

export interface UploadedAttachmentInput {
  name: string;
  type?: string;
  size: number;
  dataUrl?: string;
  url?: string;
  storedName?: string;
}

export interface StoredAttachment {
  name: string;
  type: string;
  size: number;
  url: string;
  storedName: string;
}

export class UploadImageError extends Error {
  readonly code: UploadImageErrorCode;

  constructor(code: UploadImageErrorCode, message: string) {
    super(message);
    this.name = "UploadImageError";
    this.code = code;
  }
}

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
const UPLOADS_URL_PREFIX = "/uploads";

// No `image/svg+xml`: an SVG is an XML document that can carry <script> and
// event handlers. `serveUpload` mounts it on the API's own origin, so an
// uploaded SVG would execute in the app's origin and reach the auth cookie —
// and `lib/sanitize.ts` never sees the file path, so it could not strip it.
const IMAGE_EXTENSION_BY_MIME = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const CONTENT_TYPE_BY_EXTENSION = {
  ".avif": "image/avif",
  ".bin": "application/octet-stream",
  ".csv": "text/csv; charset=utf-8",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
};

// Raster images must be served INLINE: their URL is stored in the `photo`
// column and rendered as `<img src>` across the client (EntityPhoto, image
// upload previews). `Content-Disposition: attachment` on those turns every
// image preview into a forced download, so the browser never renders them.
//
// Inline is safe for this set because every member is a raster format that
// cannot carry script, and because `image/svg+xml` is rejected at upload time
// (see IMAGE_EXTENSION_BY_MIME) *and* excluded here. The `sandbox` CSP below
// is the second, independent barrier: it neuters script execution even for an
// inline response, so no path back to stored XSS exists via `/uploads/**`.
// Do NOT add `.svg`/`.html`/`.xml` here — that reopens the stored-XSS hole.
const INLINE_RASTER_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);

const DATA_URL_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;
const GENERIC_DATA_URL_REGEX = /^data:([^;]+);base64,(.+)$/;
const DEFAULT_GENERIC_EXTENSION_BY_MIME = {
  "application/json": ".json",
  "application/msword": ".doc",
  "application/pdf": ".pdf",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/zip": ".zip",
  "text/csv": ".csv",
  "text/plain": ".txt",
} as const;
const MAX_PREFIX_LENGTH = 48;
const MAX_FILE_STEM_LENGTH = 24;

const sanitizeFileSegment = (
  value: string,
  maxLength: number,
  fallback: string,
) => {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, maxLength);

  return normalized || fallback;
};

const getExtensionFromFileName = (fileName: string) => {
  const extension = path.extname(fileName).toLowerCase();

  if (!extension || extension.length > 10) {
    return "";
  }

  return extension;
};

/**
 * True when `resolvedPath` really lives inside UPLOADS_DIR.
 *
 * A bare `resolvedPath.startsWith(UPLOADS_DIR)` is a string-prefix test with no
 * path boundary, so `/app/uploads/../uploads-evil/x` resolves to
 * `/app/uploads-evil/x` and still passes. Appending `path.sep` restores the
 * boundary; a `path.relative` escape starting with `..` is the other shape a
 * crafted path can take, so reject that too.
 */
const isInsideUploadsDir = (resolvedPath: string): boolean => {
  if (resolvedPath === UPLOADS_DIR) return true;
  if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep)) return false;
  const relative = path.relative(UPLOADS_DIR, resolvedPath);
  return (
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
};

const resolveStoredFileExtension = ({
  originalFileName,
  mimeType,
}: {
  originalFileName: string;
  mimeType: string;
}) => {
  const originalExtension = getExtensionFromFileName(originalFileName);
  if (originalExtension) {
    return originalExtension;
  }

  return (
    DEFAULT_GENERIC_EXTENSION_BY_MIME[
      mimeType as keyof typeof DEFAULT_GENERIC_EXTENSION_BY_MIME
    ] ?? ".bin"
  );
};

const buildStoredFileName = ({
  prefix,
  originalFileName,
  mimeType,
}: {
  prefix: string;
  originalFileName: string;
  mimeType: string;
}) => {
  const extension = resolveStoredFileExtension({ originalFileName, mimeType });
  const fileStem = sanitizeFileSegment(
    path.basename(originalFileName, path.extname(originalFileName)),
    MAX_FILE_STEM_LENGTH,
    "file",
  );
  const safePrefix = sanitizeFileSegment(
    prefix,
    MAX_PREFIX_LENGTH,
    "transaction",
  );

  return `${safePrefix}-${fileStem}${extension}`;
};

const ensureUploadsDir = async (folder: string) => {
  const dirPath = path.join(UPLOADS_DIR, folder);
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
};

const getRequestOrigin = (req: Request) => {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : (forwardedProto ?? req.protocol);
  const host = req.headers.host ?? "localhost:10012";
  return `${protocol}://${host}`;
};

const toUploadUrl = (req: Request, folder: string, fileName: string) => {
  return `${getRequestOrigin(req)}${UPLOADS_URL_PREFIX}/${folder}/${fileName}`;
};

const toManagedUploadPath = (fileUrl: string) => {
  const pathname = (() => {
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      return new URL(fileUrl).pathname;
    }

    return fileUrl;
  })();

  if (!pathname.startsWith(`${UPLOADS_URL_PREFIX}/`)) {
    return null;
  }

  const relativePath = pathname.slice(UPLOADS_URL_PREFIX.length + 1);
  const resolvedPath = path.resolve(UPLOADS_DIR, relativePath);
  if (!isInsideUploadsDir(resolvedPath)) {
    return null;
  }

  return resolvedPath;
};

export const deleteManagedUpload = async (fileUrl: string | null) => {
  if (!fileUrl) {
    return;
  }

  const filePath = toManagedUploadPath(fileUrl);
  if (!filePath) {
    return;
  }

  await fs.rm(filePath, { force: true });
};

export const persistUploadedImage = async ({
  image,
  folder,
  req,
}: {
  image: string;
  folder: string;
  req: Request;
}) => {
  const match = DATA_URL_REGEX.exec(image);
  if (!match) {
    return image;
  }

  const mimeType = match[1];
  const base64Data = match[2];
  if (!mimeType || !base64Data) {
    throw new UploadImageError(
      "INVALID_IMAGE_FORMAT",
      "Format foto tidak valid",
    );
  }

  const extension =
    IMAGE_EXTENSION_BY_MIME[mimeType as keyof typeof IMAGE_EXTENSION_BY_MIME];
  if (!extension) {
    throw new UploadImageError(
      "UNSUPPORTED_IMAGE_FORMAT",
      "Format foto tidak didukung",
    );
  }

  const targetDir = await ensureUploadsDir(folder);
  const fileName = `${randomUUID()}.${extension}`;
  const filePath = path.join(targetDir, fileName);
  await fs.writeFile(filePath, Buffer.from(base64Data, "base64"));

  return toUploadUrl(req, folder, fileName);
};

export const persistUploadedAttachment = async ({
  attachment,
  folder,
  req,
  fileNamePrefix,
}: {
  attachment: UploadedAttachmentInput;
  folder: string;
  req: Request;
  fileNamePrefix: string;
}) => {
  if (!attachment.dataUrl) {
    if (!attachment.url || !attachment.storedName) {
      throw new Error("Attachment data is incomplete.");
    }

    return {
      name: attachment.name,
      type: attachment.type ?? "application/octet-stream",
      size: attachment.size,
      url: attachment.url,
      storedName: attachment.storedName,
    } satisfies StoredAttachment;
  }

  const match = GENERIC_DATA_URL_REGEX.exec(attachment.dataUrl);
  if (!match) {
    throw new Error("Invalid attachment format.");
  }

  const mimeType = match[1] ?? attachment.type ?? "application/octet-stream";
  const base64Data = match[2];
  if (!base64Data) {
    throw new Error("Invalid attachment payload.");
  }

  const targetDir = await ensureUploadsDir(folder);
  const storedName = buildStoredFileName({
    prefix: fileNamePrefix,
    originalFileName: attachment.name,
    mimeType,
  });
  const filePath = path.join(targetDir, storedName);

  await fs.writeFile(filePath, Buffer.from(base64Data, "base64"));

  return {
    name: attachment.name,
    type: mimeType,
    size: attachment.size,
    url: toUploadUrl(req, folder, storedName),
    storedName,
  } satisfies StoredAttachment;
};

export const serveUpload = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.path.startsWith(UPLOADS_URL_PREFIX)) {
    next();
    return;
  }

  try {
    // decodeURIComponent throws URIError on malformed input (e.g. `/uploads/%zz`)
    // — keep it inside the try so a malformed URL is a 404, not a 500.
    const relativePath = decodeURIComponent(
      req.path.slice(UPLOADS_URL_PREFIX.length + 1),
    );
    const filePath = path.resolve(UPLOADS_DIR, relativePath);
    if (!isInsideUploadsDir(filePath)) {
      res.status(403).send("Forbidden");
      return;
    }

    const fileBuffer = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const contentType =
      CONTENT_TYPE_BY_EXTENSION[
        extension as keyof typeof CONTENT_TYPE_BY_EXTENSION
      ] ?? "application/octet-stream";
    res.status(200);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (INLINE_RASTER_EXTENSIONS.has(extension)) {
      res.setHeader("Content-Disposition", "inline");
    } else {
      // Everything else (documents, archives, and `.svg` as defence in
      // depth even though upload rejects it) downloads instead of
      // rendering, so user-supplied markup never executes in our origin.
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${path.basename(filePath).replace(/[^\w.-]/g, "_")}"`,
      );
    }
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(fileBuffer);
  } catch {
    res.status(404).send("Not Found");
  }
};
