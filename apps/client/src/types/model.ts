// Auth types
export type AuthUser = {
    id: string;
    email: string;
    name: string | null;
    roles?: Array<{
        id: string;
        name: string;
        permissions: string[];
    }>;
};

export type LoginCredentials = {
    email: string;
    password: string;
};

export type RegisterCredentials = {
    email: string;
    password: string;
    name?: string;
};

// Customer types
export type Customer = {
    id: string;
    nama: string;
    no_hp: string | null;
    email: string | null;
    alamat: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
};

export type CustomerInput = {
    nama: string;
    no_hp?: string;
    email?: string;
    alamat?: string;
};

// Departemen types
export type Departemen = {
    id: string;
    nama: string;
    deskripsi: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
};

export type DepartemenInput = {
    nama: string;
    deskripsi?: string;
};

// Pagination types
export type PaginationMeta = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

export type PaginatedResponse<T> = {
    data: T[];
    meta: PaginationMeta;
};
