import { initTRPC } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

const t = initTRPC.create();

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";

export const authRouter = t.router({
    login: t.procedure
        .input(
            z.object({
                email: z.string().email("Invalid email address"),
                password: z.string().min(1, "Password is required"),
            })
        )
        .mutation(async ({ input }) => {
            const { email, password } = input;

            // Find user by email
            const user = await prisma.user.findUnique({
                where: { email },
                include: {
                    userHasRoles: {
                        include: {
                            role: {
                                include: {
                                    permissions: {
                                        include: {
                                            permission: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            if (!user) {
                throw new Error("Invalid email or password");
            }

            // Compare password
            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (!isPasswordValid) {
                throw new Error("Invalid email or password");
            }

            // Create JWT token
            const token = jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    name: user.name,
                },
                JWT_SECRET,
                { expiresIn: "7d" }
            );

            // Return user data with roles and permissions
            return {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    roles: user.userHasRoles.map((ur) => ({
                        id: ur.role.id,
                        name: ur.role.name,
                        permissions: ur.role.permissions.map((p) => p.permission.name),
                    })),
                },
            };
        }),

    verifyToken: t.procedure
        .input(z.object({ token: z.string() }))
        .query(({ input }) => {
            try {
                const decoded = jwt.verify(input.token, JWT_SECRET) as {
                    userId: string;
                    email: string;
                    name: string | null;
                };
                return { valid: true, user: decoded };
            } catch (error) {
                return { valid: false, user: null };
            }
        }),
});
