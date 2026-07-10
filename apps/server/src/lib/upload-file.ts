import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';

export type UploadImageErrorCode = 'INVALID_IMAGE_FORMAT' | 'UNSUPPORTED_IMAGE_FORMAT';

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
        this.name = 'UploadImageError';
        this.code = code;
    }
}

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const UPLOADS_URL_PREFIX = '/uploads';

const IMAGE_EXTENSION_BY_MIME = {
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
} as const;

const CONTENT_TYPE_BY_EXTENSION = {
    '.bin': 'application/octet-stream',
    '.csv': 'text/csv; charset=utf-8',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.gif': 'image/gif',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip',
};

const DATA_URL_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;
const GENERIC_DATA_URL_REGEX = /^data:([^;]+);base64,(.+)$/;
const DEFAULT_GENERIC_EXTENSION_BY_MIME = {
    'application/json': '.json',
    'application/msword': '.doc',
    'application/pdf': '.pdf',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/zip': '.zip',
    'text/csv': '.csv',
    'text/plain': '.txt',
} as const;
const MAX_PREFIX_LENGTH = 48;
const MAX_FILE_STEM_LENGTH = 24;

const sanitizeFileSegment = (value: string, maxLength: number, fallback: string) => {
    const normalized = value
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
        .slice(0, maxLength);

    return normalized || fallback;
};

const getExtensionFromFileName = (fileName: string) => {
    const extension = path.extname(fileName).toLowerCase();

    if (!extension || extension.length > 10) {
        return '';
    }

    return extension;
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

    return DEFAULT_GENERIC_EXTENSION_BY_MIME[mimeType as keyof typeof DEFAULT_GENERIC_EXTENSION_BY_MIME] ?? '.bin';
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
    const fileStem = sanitizeFileSegment(path.basename(originalFileName, path.extname(originalFileName)), MAX_FILE_STEM_LENGTH, 'file');
    const safePrefix = sanitizeFileSegment(prefix, MAX_PREFIX_LENGTH, 'transaction');

    return `${safePrefix}-${fileStem}${extension}`;
};

const ensureUploadsDir = async (folder: string) => {
    const dirPath = path.join(UPLOADS_DIR, folder);
    await fs.mkdir(dirPath, { recursive: true });
    return dirPath;
};

const getRequestOrigin = (req: Request) => {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = Array.isArray(forwardedProto)
        ? forwardedProto[0]
        : forwardedProto ?? req.protocol;
    const host = req.headers.host ?? 'localhost:10012';
    return `${protocol}://${host}`;
};

const toUploadUrl = (req: Request, folder: string, fileName: string) => {
    return `${getRequestOrigin(req)}${UPLOADS_URL_PREFIX}/${folder}/${fileName}`;
};

const toManagedUploadPath = (fileUrl: string) => {
    const pathname = (() => {
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
            return new URL(fileUrl).pathname;
        }

        return fileUrl;
    })();

    if (!pathname.startsWith(`${UPLOADS_URL_PREFIX}/`)) {
        return null;
    }

    const relativePath = pathname.slice(UPLOADS_URL_PREFIX.length + 1);
    const resolvedPath = path.resolve(UPLOADS_DIR, relativePath);
    if (!resolvedPath.startsWith(UPLOADS_DIR)) {
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
        throw new UploadImageError('INVALID_IMAGE_FORMAT', 'Format foto tidak valid');
    }

    const extension = IMAGE_EXTENSION_BY_MIME[mimeType as keyof typeof IMAGE_EXTENSION_BY_MIME];
    if (!extension) {
        throw new UploadImageError('UNSUPPORTED_IMAGE_FORMAT', 'Format foto tidak didukung');
    }

    const targetDir = await ensureUploadsDir(folder);
    const fileName = `${randomUUID()}.${extension}`;
    const filePath = path.join(targetDir, fileName);
    await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'));

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
            throw new Error('Attachment data is incomplete.');
        }

        return {
            name: attachment.name,
            type: attachment.type ?? 'application/octet-stream',
            size: attachment.size,
            url: attachment.url,
            storedName: attachment.storedName,
        } satisfies StoredAttachment;
    }

    const match = GENERIC_DATA_URL_REGEX.exec(attachment.dataUrl);
    if (!match) {
        throw new Error('Invalid attachment format.');
    }

    const mimeType = match[1] ?? attachment.type ?? 'application/octet-stream';
    const base64Data = match[2];
    if (!base64Data) {
        throw new Error('Invalid attachment payload.');
    }

    const targetDir = await ensureUploadsDir(folder);
    const storedName = buildStoredFileName({
        prefix: fileNamePrefix,
        originalFileName: attachment.name,
        mimeType,
    });
    const filePath = path.join(targetDir, storedName);

    await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'));

    return {
        name: attachment.name,
        type: mimeType,
        size: attachment.size,
        url: toUploadUrl(req, folder, storedName),
        storedName,
    } satisfies StoredAttachment;
};

export const serveUpload = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith(UPLOADS_URL_PREFIX)) {
        next();
        return;
    }

    const relativePath = decodeURIComponent(req.path.slice(UPLOADS_URL_PREFIX.length + 1));
    const filePath = path.resolve(UPLOADS_DIR, relativePath);
    if (!filePath.startsWith(UPLOADS_DIR)) {
        res.status(403).send('Forbidden');
        return;
    }

    try {
        const fileBuffer = await fs.readFile(filePath);
        const contentType = CONTENT_TYPE_BY_EXTENSION[path.extname(filePath).toLowerCase() as keyof typeof CONTENT_TYPE_BY_EXTENSION] ?? 'application/octet-stream';
        res.status(200);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.end(fileBuffer);
    } catch {
        res.status(404).send('Not Found');
    }
};