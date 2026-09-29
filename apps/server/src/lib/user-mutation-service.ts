import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { logActivity } from "./activity-log.js";
import { getMessage, type ServerLocale } from "./locale.js";
import {
  createPhotoValue,
  resolveUpdatedPhotoValue,
} from "./photo-lifecycle.js";
import { hashPassword } from "./password.js";
import type { DbClient } from "./prisma.js";
import type { Prisma } from "../prisma/generated/client";

const SYSTEM_ADMIN_ROLE_NAME = "System Admin";

export const userMutationSelect = {
  id: true,
  name: true,
  email: true,
  photo: true,
  role: {
    select: {
      id: true,
      name: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;

export const userDetailSelect = {
  ...userMutationSelect,
  roleId: true,
} as const;

export const getUserDetailOrThrow = async ({
  db,
  id,
  locale,
}: {
  db: DbClient;
  id: string;
  locale: ServerLocale;
}) => {
  const user = await db.user.findUnique({
    where: { id },
    select: userDetailSelect,
  });

  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: getMessage(locale, "user.notFound"),
    });
  }

  return user;
};

export const getUserPhotoStateOrThrow = async ({
  db,
  id,
  locale,
}: {
  db: DbClient;
  id: string;
  locale: ServerLocale;
}) => {
  const user = await db.user.findUnique({
    where: { id },
    select: { photo: true },
  });

  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: getMessage(locale, "user.notFound"),
    });
  }

  return user;
};

export const getUserDeletionStateOrThrow = async ({
  db,
  id,
  locale,
}: {
  db: DbClient;
  id: string;
  locale: ServerLocale;
}) => {
  const user = await db.user.findUnique({
    where: { id },
    include: { role: true },
  });

  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: getMessage(locale, "user.notFound"),
    });
  }

  return user;
};

export const ensureUserDeletionAllowed = async ({
  db,
  locale,
  user,
}: {
  db: DbClient;
  locale: ServerLocale;
  user: Awaited<ReturnType<typeof getUserDeletionStateOrThrow>>;
}) => {
  if (user.role?.name !== SYSTEM_ADMIN_ROLE_NAME) {
    return;
  }

  const adminCount = await db.user.count({
    where: {
      role: {
        name: SYSTEM_ADMIN_ROLE_NAME,
      },
    },
  });

  if (adminCount <= 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: getMessage(locale, "user.cannotDeleteLastAdmin"),
    });
  }
};

export const ensureUserEmailAvailable = async ({
  db,
  email,
  locale,
  excludeUserId,
}: {
  db: DbClient;
  email: string;
  locale: ServerLocale;
  excludeUserId?: string;
}) => {
  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser && existingUser.id !== excludeUserId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: getMessage(locale, "user.emailExists"),
    });
  }
};

export const buildCreateUserData = async ({
  input,
  req,
  locale,
}: {
  input: {
    name: string;
    email: string;
    password: string;
    roleId: string;
    photo?: string;
  };
  req: Request;
  locale: ServerLocale;
}) => {
  const password = await hashPassword(input.password);
  const photo = await createPhotoValue({
    photo: input.photo,
    folder: "users",
    req,
    locale,
  });

  return {
    name: input.name,
    email: input.email,
    password,
    roleId: input.roleId,
    photo,
  };
};

export const buildUpdateUserData = async ({
  input,
  existingPhoto,
  req,
  locale,
}: {
  input: {
    name?: string;
    email?: string;
    password?: string;
    roleId?: string;
    photo?: string;
  };
  existingPhoto?: string | null;
  req: Request;
  locale: ServerLocale;
}) => {
  const { password, photo, ...data } = input;

  const updateData: {
    name?: string;
    email?: string;
    roleId?: string;
    password?: string;
    photo?: string | null;
  } = { ...data };

  if (password) {
    updateData.password = await hashPassword(password);
  }

  const resolvedPhoto = await resolveUpdatedPhotoValue({
    nextPhoto: photo,
    existingPhoto,
    folder: "users",
    req,
    locale,
  });

  if (resolvedPhoto !== undefined) {
    updateData.photo = resolvedPhoto;
  }

  return updateData;
};

export const logUserMutation = async ({
  db,
  action,
  actorUserId,
  targetUserId,
  targetUserName,
  detail,
}: {
  db: DbClient;
  action: "CREATE" | "UPDATE" | "DELETE";
  actorUserId: string;
  targetUserId: string;
  targetUserName: string;
  detail?: Prisma.InputJsonValue;
}) => {
  const actionLabelByType = {
    CREATE: "Created",
    UPDATE: "Updated",
    DELETE: "Deleted",
  } as const;

  await logActivity(db, {
    action,
    userId: actorUserId,
    resource: "user",
    resourceId: targetUserId,
    message: `${actionLabelByType[action]} user ${targetUserName}`,
    detail,
  });
};
