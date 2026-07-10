import { TRPCError } from '@trpc/server';
import type { Request } from 'express';
import { getMessage, type ServerLocale } from './locale.js';
import { createPhotoValue, resolveUpdatedPhotoValue } from './photo-lifecycle.js';
import type { DbClient } from './prisma.js';

export const getWarehouseOrThrow = async ({
    db,
    id,
    locale,
}: {
    db: DbClient;
    id: string;
    locale: ServerLocale;
}) => {
    const warehouse = await db.warehouse.findUnique({
        where: { id },
    });

    if (!warehouse) {
        throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(locale, 'warehouse.notFound') });
    }

    return warehouse;
};

export const buildCreateWarehouseData = async ({
    input,
    req,
    locale,
}: {
    input: {
        id?: string;
        code?: string;
        objectId?: string;
        name: string;
        address: string;
        totalCapacity?: number;
        photo?: string;
    };
    req: Request;
    locale: ServerLocale;
}) => {
    const photo = await createPhotoValue({ photo: input.photo, folder: 'warehouses', req, locale });

    const trimmedId = input.id?.trim();
    const trimmedCode = input.code?.trim() || trimmedId;

    return {
        ...(trimmedId ? { id: trimmedId } : {}),
        ...(trimmedCode ? { code: trimmedCode } : {}),
        objectId: input.objectId?.trim() || null,
        name: input.name,
        address: input.address,
        totalCapacity: input.totalCapacity ?? null,
        photo,
    };
};

export const buildUpdateWarehouseData = async ({
    input,
    existingPhoto,
    req,
    locale,
}: {
    input: {
        code: string;
        objectId?: string;
        name: string;
        address: string;
        totalCapacity?: number;
        photo?: string;
    };
    existingPhoto?: string | null;
    req: Request;
    locale: ServerLocale;
}) => {
    const photo = await resolveUpdatedPhotoValue({
        nextPhoto: input.photo,
        existingPhoto,
        folder: 'warehouses',
        req,
        locale,
    });

    return {
        code: input.code.trim(),
        objectId: input.objectId?.trim() || null,
        name: input.name,
        address: input.address,
        totalCapacity: input.totalCapacity ?? null,
        ...(photo !== undefined ? { photo } : {}),
    };
};