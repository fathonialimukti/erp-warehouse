import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';

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
    '.gif': 'image/gif',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
};

const DATA_URL_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;

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
    const host = req.headers.host ?? 'localhost:2022';
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
        throw new Error('Format foto tidak valid');
    }

    const extension = IMAGE_EXTENSION_BY_MIME[mimeType as keyof typeof IMAGE_EXTENSION_BY_MIME];
    if (!extension) {
        throw new Error('Format foto tidak didukung');
    }

    const targetDir = await ensureUploadsDir(folder);
    const fileName = `${randomUUID()}.${extension}`;
    const filePath = path.join(targetDir, fileName);
    await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'));

    return toUploadUrl(req, folder, fileName);
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