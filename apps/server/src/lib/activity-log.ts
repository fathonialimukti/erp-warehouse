import { type Prisma } from "../prisma/generated/client";
import { type DbClient } from "./prisma.js";

type LogActivityInput = {
  action:
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "APPROVE"
    | "REJECT"
    | "LOGIN"
    | "LOGOUT"
    | "EXPORT"
    | "IMPORT";
  userId: string;
  resource: string;
  resourceId: string;
  message: string;
  detail?: Prisma.InputJsonValue;
};

export const logActivity = async (db: DbClient, input: LogActivityInput) => {
  return db.activityLog.create({
    data: {
      action: input.action,
      userId: input.userId,
      resource: input.resource,
      resourceId: input.resourceId,
      message: input.message,
      detail: input.detail,
    },
  });
};
