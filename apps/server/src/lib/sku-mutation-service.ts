import { TRPCError } from '@trpc/server';
import type { Request } from 'express';
import { getMessage, type ServerLocale } from './locale.js';
import { createPhotoValue, resolveUpdatedPhotoValue } from './photo-lifecycle.js';
import type { DbClient } from './prisma.js';

export const getSkuOrThrow = async ({
    db,
    id,
    locale,
}: {
    db: DbClient;
    id: string;
    locale: ServerLocale;
}) => {
    const sku = await db.sku.findUnique({
        where: { id },
        include: {
            palletTypes: {
                include: {
                    pallets: {
                        where: { status: { in: ['AVAILABLE'] } },
                        select: { id: true },
                    },
                },
            },
        },
    });

    if (!sku) {
        throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(locale, 'sku.notFound') });
    }

    return sku;
};

export const getSkuPhotoStateOrThrow = async ({
    db,
    id,
    locale,
}: {
    db: DbClient;
    id: string;
    locale: ServerLocale;
}) => {
    const sku = await db.sku.findUnique({
        where: { id },
        select: { photo: true },
    });

    if (!sku) {
        throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(locale, 'sku.notFound') });
    }

    return sku;
};

export const buildCreateSkuData = async ({
    input,
    req,
    locale,
}: {
    input: {
        id?: string;
        code?: string;
        name: string;
        description?: string;
        photo?: string;
        baseUnit?: string;
    };
    req: Request;
    locale: ServerLocale;
}) => {
    const photo = await createPhotoValue({ photo: input.photo, folder: 'skus', req, locale });

    const trimmedId = input.id?.trim();
    const trimmedCode = input.code?.trim() || trimmedId;

    return {
        ...(trimmedId ? { id: trimmedId } : {}),
        ...(trimmedCode ? { code: trimmedCode } : {}),
        name: input.name,
        description: input.description ?? null,
        baseUnit: input.baseUnit ?? 'kg',
        photo,
    };
};

export const buildUpdateSkuData = async ({
    input,
    existingPhoto,
    req,
    locale,
}: {
    input: {
        code: string;
        name: string;
        description?: string;
        photo?: string;
        baseUnit?: string;
    };
    existingPhoto?: string | null;
    req: Request;
    locale: ServerLocale;
}) => {
    const photo = await resolveUpdatedPhotoValue({
        nextPhoto: input.photo,
        existingPhoto,
        folder: 'skus',
        req,
        locale,
    });

    return {
        code: input.code.trim(),
        name: input.name,
        description: input.description ?? null,
        ...(input.baseUnit !== undefined ? { baseUnit: input.baseUnit } : {}),
        ...(photo !== undefined ? { photo } : {}),
    };
};