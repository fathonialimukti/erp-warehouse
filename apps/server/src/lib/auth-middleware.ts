import type { Request } from "express";
import { parse as parseCookie } from "cookie";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export type AuthPayload = {
  userId: string;
  email: string;
  name?: string;
  exp: number;
  /** User.tokenVersion at issue time — mismatch means the token was revoked. */
  ver: number;
};

export const extractToken = (req: Request): string | null => {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = parseCookie(cookieHeader);
    if (cookies.access_token) return cookies.access_token;
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer "))
    return authHeader.slice("Bearer ".length);
  return null;
};

export const verifyToken = (token: string): AuthPayload | null => {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (
      !payload?.userId ||
      !payload?.email ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      name: payload.name ? String(payload.name) : undefined,
      exp: Number(payload.exp),
      ver: typeof payload.ver === "number" ? payload.ver : 0,
    };
  } catch {
    return null;
  }
};

export const authenticateRequest = (req: Request): AuthPayload | null => {
  const token = extractToken(req);
  if (!token) return null;
  return verifyToken(token);
};

/** Like authenticateRequest but also verifies the tokenVersion against the DB (revocation-aware). */
export const authenticateRequestRevocable = async (
  req: Request,
): Promise<AuthPayload | null> => {
  const payload = authenticateRequest(req);
  if (!payload) return null;
  const { prisma } = await import("./prisma.js");
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { tokenVersion: true },
  });
  if (!user || user.tokenVersion !== payload.ver) return null;
  return payload;
};
