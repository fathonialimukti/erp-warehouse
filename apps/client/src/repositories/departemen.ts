import { trpcVanilla } from "@/lib/trpc";
import type { DepartemenInput } from "@/types/model";

export const departemenRepository = {
    table: async (
        search?: string,
        page: number = 1,
        limit: number = 10,
        _sort?: string // Sorting not implemented yet in tRPC router
    ) => {
        const result = await trpcVanilla.departemen.list.query({
            search,
            page,
            limit,
        });

        return {
            data: result.data,
            totalPages: result.meta.totalPages,
        };
    },

    detail: async (id: string) => {
        return trpcVanilla.departemen.detail.query({ id });
    },

    create: async (data: DepartemenInput) => {
        return trpcVanilla.departemen.create.mutate(data);
    },

    update: async (id: string, data: DepartemenInput) => {
        return trpcVanilla.departemen.update.mutate({ id, ...data });
    },

    delete: async (id: string) => {
        return trpcVanilla.departemen.delete.mutate({ id });
    },

    downloadTemplate: async () => {
        // TODO: Implement template download
        console.warn("downloadTemplate not implemented yet");
    },

    exportToExcel: async () => {
        // TODO: Implement Excel export
        console.warn("exportToExcel not implemented yet");
    },
};
