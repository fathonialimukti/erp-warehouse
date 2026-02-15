import { trpcVanilla } from "@/lib/trpc";
import type { CustomerInput } from "@/types/model";

export const customerRepository = {
    table: async (
        search?: string,
        page: number = 1,
        limit: number = 10,
        _sort?: string // Sorting not implemented yet in tRPC router
    ) => {
        const result = await trpcVanilla.customer.list.query({
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
        return trpcVanilla.customer.detail.query({ id });
    },

    create: async (data: CustomerInput) => {
        return trpcVanilla.customer.create.mutate(data);
    },

    update: async (id: string, data: CustomerInput) => {
        return trpcVanilla.customer.update.mutate({ id, ...data });
    },

    delete: async (id: string) => {
        return trpcVanilla.customer.delete.mutate({ id });
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
