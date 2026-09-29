import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import type { SkuType } from "../prisma/generated/client.js";
import { getMessage, type ServerLocale } from "./locale.js";
import {
  createPhotoValue,
  resolveUpdatedPhotoValue,
} from "./photo-lifecycle.js";
import type { DbClient } from "./prisma.js";

/** Fetches a SKU by id and throws NOT_FOUND if it does not exist. Includes AVAILABLE pallets. */
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
      pallets: {
        where: { status: { in: ["AVAILABLE"] } },
        select: { id: true },
      },
    },
  });

  if (!sku) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: getMessage(locale, "sku.notFound"),
    });
  }

  return sku;
};

type SkuFieldsInput = {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  photo?: string;
  baseUnit?: string;
  objectId?: string;
  packageName: string;
  packagesPerPallet: number;
  quantityPerPackage: number;
  packageUnit: string;
  length?: number;
  width?: number;
  height?: number;
  maxWeight?: number;
};

/**
 * Builds the Prisma `data` object for a SKU create mutation.
 * Handles photo upload, id/code trimming, and maps all SKU fields.
 */
export const buildCreateSkuData = async ({
  input,
  type,
  req,
  locale,
}: {
  input: SkuFieldsInput;
  type: SkuType;
  req: Request;
  locale: ServerLocale;
}) => {
  const photo = await createPhotoValue({
    photo: input.photo,
    folder: "skus",
    req,
    locale,
  });

  const trimmedId = input.id?.trim();
  const trimmedCode = input.code?.trim() || trimmedId;

  return {
    ...(trimmedId ? { id: trimmedId } : {}),
    ...(trimmedCode ? { code: trimmedCode } : {}),
    type,
    name: input.name,
    description: input.description ?? null,
    baseUnit: input.baseUnit ?? "pcs",
    objectId: input.objectId ?? null,
    packageName: input.packageName,
    packagesPerPallet: input.packagesPerPallet,
    quantityPerPackage: input.quantityPerPackage,
    packageUnit: input.packageUnit,
    length: input.length ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    maxWeight: input.maxWeight ?? null,
    photo,
  };
};

/**
 * Builds the Prisma `data` object for a SKU update mutation.
 * Handles photo swap (removes old photo when replaced) and maps all SKU fields.
 */
export const buildUpdateSkuData = async ({
  input,
  existingPhoto,
  req,
  locale,
}: {
  input: Omit<SkuFieldsInput, "id"> & { code: string };
  existingPhoto?: string | null;
  req: Request;
  locale: ServerLocale;
}) => {
  const photo = await resolveUpdatedPhotoValue({
    nextPhoto: input.photo,
    existingPhoto,
    folder: "skus",
    req,
    locale,
  });

  return {
    code: input.code.trim(),
    name: input.name,
    description: input.description ?? null,
    ...(input.baseUnit !== undefined ? { baseUnit: input.baseUnit } : {}),
    objectId: input.objectId ?? null,
    packageName: input.packageName,
    packagesPerPallet: input.packagesPerPallet,
    quantityPerPackage: input.quantityPerPackage,
    packageUnit: input.packageUnit,
    length: input.length ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    maxWeight: input.maxWeight ?? null,
    ...(photo !== undefined ? { photo } : {}),
  };
};
