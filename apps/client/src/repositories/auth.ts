import type { LoginCredentials, RegisterCredentials, AuthUser } from "@/types/model";
import { trpcVanilla } from "@/lib/trpc";

export const authRepository = {
    login: async (credentials: LoginCredentials): Promise<{ user: AuthUser; token?: string }> => {
        const result = await trpcVanilla.auth.login.mutate(credentials);

        // Store token and user
        if (result.token) {
            localStorage.setItem("auth_token", result.token);
        }
        localStorage.setItem("auth_user", JSON.stringify(result.user));

        return result;
    },

    register: async (
        _userData: RegisterCredentials
    ): Promise<{ user: AuthUser; token?: string }> => {
        // TODO: Implement register mutation on server
        // For now, throw not implemented
        throw new Error("Register not implemented yet");
    },

    logout: async (): Promise<void> => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
    },

    verifyToken: async (token: string) => {
        return trpcVanilla.auth.verifyToken.query({ token });
    },
};
