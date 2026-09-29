import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { getMessage, type ServerLocale } from "./locale.js";
import { UploadImageError, persistUploadedImage } from "./upload-file.js";

const uploadErrorMessageKeyByCode = {
  INVALID_IMAGE_FORMAT: "upload.invalidImageFormat",
  UNSUPPORTED_IMAGE_FORMAT: "upload.unsupportedImageFormat",
} as const;

export const persistUploadedImageOrThrow = async ({
  image,
  folder,
  req,
  locale,
}: {
  image: string;
  folder: string;
  req: Request;
  locale: ServerLocale;
}) => {
  try {
    return await persistUploadedImage({ image, folder, req });
  } catch (error) {
    if (error instanceof UploadImageError) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: getMessage(locale, uploadErrorMessageKeyByCode[error.code]),
      });
    }

    throw error;
  }
};
