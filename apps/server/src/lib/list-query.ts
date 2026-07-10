import { z } from 'zod';

type InsensitiveContainsFilter = {
    contains: string;
    mode: 'insensitive';
};

type TextSearchCondition<TField extends string> = TField extends string
    ? { [K in TField]: InsensitiveContainsFilter }
    : never;

const createInsensitiveContainsFilter = (search: string): InsensitiveContainsFilter => ({
    contains: search,
    mode: 'insensitive',
});

export const baseListInputSchema = z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(10),
    search: z.string().optional(),
});

export const basePaginationInputSchema = baseListInputSchema.omit({ search: true });

export function createListInputSchema(): z.ZodOptional<typeof baseListInputSchema>;
export function createListInputSchema<T extends z.ZodRawShape>(
    extraShape: T,
): z.ZodOptional<ReturnType<typeof baseListInputSchema.extend<T>>>;
export function createListInputSchema<T extends z.ZodRawShape>(extraShape?: T) {
    if (!extraShape) {
        return baseListInputSchema.optional();
    }

    return baseListInputSchema.extend(extraShape).optional();
}

export function createPaginationInputSchema(): z.ZodOptional<typeof basePaginationInputSchema>;
export function createPaginationInputSchema<T extends z.ZodRawShape>(
    extraShape: T,
): z.ZodOptional<ReturnType<typeof basePaginationInputSchema.extend<T>>>;
export function createPaginationInputSchema<T extends z.ZodRawShape>(extraShape?: T) {
    if (!extraShape) {
        return basePaginationInputSchema.optional();
    }

    return basePaginationInputSchema.extend(extraShape).optional();
}

export const buildPaginationParams = (input?: { page?: number; limit?: number }) => {
    const page = input?.page ?? 1;
    const limit = input?.limit ?? 10;
    const skip = (page - 1) * limit;
    return { page, limit, skip };
};

type SortOrder = 'asc' | 'desc';

/**
 * Normalize sort params from validated list input.
 * Returns undefined when sortBy is absent so callers can apply their own default.
 */
export const buildSortParams = (input?: { sortBy?: string; sortOrder?: SortOrder }): { sortBy: string; sortOrder: SortOrder } | undefined => {
    const sortBy = input?.sortBy?.trim();
    if (!sortBy) return undefined;
    const sortOrder: SortOrder = input?.sortOrder === 'asc' ? 'asc' : 'desc';
    return { sortBy, sortOrder };
};

export const buildPaginationMeta = ({
    page,
    limit,
    total,
}: {
    page: number;
    limit: number;
    total: number;
}) => ({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
});

export const buildTextSearchWhere = <TField extends string>(search: string | undefined, fields: readonly TField[]) => {
    if (!search) {
        return {};
    }

    return {
        OR: fields.map((field) => ({
            [field]: createInsensitiveContainsFilter(search),
        })) as TextSearchCondition<TField>[],
    };
};