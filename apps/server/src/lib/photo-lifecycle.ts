import type { Request } from "express";
import type { ServerLocale } from "./locale.js";
import { deleteManagedUpload } from "./upload-file.js";
import { persistUploadedImageOrThrow } from "./upload-service.js";

export type PhotoFolder = "users" | "skus" | "warehouses";

export const createPhotoValue = async ({
  photo,
  folder,
  req,
  locale,
}: {
  photo?: string;
  folder: PhotoFolder;
  req: Request;
  locale: ServerLocale;
}) => {
  return photo
    ? await persistUploadedImageOrThrow({ image: photo, folder, req, locale })
    : null;
};

export const resolveUpdatedPhotoValue = async ({
  nextPhoto,
  existingPhoto,
  folder,
  req,
  locale,
}: {
  nextPhoto?: string;
  existingPhoto?: string | null;
  folder: PhotoFolder;
  req: Request;
  locale: ServerLocale;
}) => {
  if (nextPhoto === undefined) {
    return undefined;
  }

  const resolvedPhoto = nextPhoto
    ? await persistUploadedImageOrThrow({
        image: nextPhoto,
        folder,
        req,
        locale,
      })
    : null;

  if (existingPhoto && existingPhoto !== resolvedPhoto) {
    await deleteManagedUpload(existingPhoto);
  }

  return resolvedPhoto;
};

export const removePhotoValue = async (photo?: string | null) => {
  await deleteManagedUpload(photo ?? null);
};
