/**
 * Date and Time Formatting Utilities
 */

export function formatDate(date: string | Date | null | undefined): string {
    if (!date) return "-";

    try {
        const dateObj = typeof date === "string" ? new Date(date) : date;
        return new Intl.DateTimeFormat("id-ID", {
            year: "numeric",
            month: "long",
            day: "numeric",
        }).format(dateObj);
    } catch {
        return "-";
    }
}

export function formatDateTime(date: string | Date | null | undefined): string {
    if (!date) return "-";

    try {
        const dateObj = typeof date === "string" ? new Date(date) : date;
        return new Intl.DateTimeFormat("id-ID", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(dateObj);
    } catch {
        return "-";
    }
}

export function formatDateShort(date: string | Date | null | undefined): string {
    if (!date) return "-";

    try {
        const dateObj = typeof date === "string" ? new Date(date) : date;
        return new Intl.DateTimeFormat("id-ID", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(dateObj);
    } catch {
        return "-";
    }
}

/**
 * Currency Formatting Utilities
 */

export function formatCurrency(amount: number | string | null | undefined): string {
    if (amount === null || amount === undefined) return "Rp 0";

    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

    if (isNaN(numAmount)) return "Rp 0";

    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(numAmount);
}

export function formatNumber(value: number | string | null | undefined): string {
    if (value === null || value === undefined) return "0";

    const numValue = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(numValue)) return "0";

    return new Intl.NumberFormat("id-ID").format(numValue);
}

/**
 * Status Color Utilities
 */

export type StatusColorConfig = {
    bg: string;
    text: string;
    border: string;
};

export function getStatusColor(status: string): StatusColorConfig {
    const statusLower = status.toLowerCase();

    const statusMap: Record<string, StatusColorConfig> = {
        draft: {
            bg: "bg-cyan-400",
            text: "text-white",
            border: "border-cyan-500",
        },
        pending: {
            bg: "bg-amber-500",
            text: "text-white",
            border: "border-amber-600",
        },
        approved: {
            bg: "bg-emerald-500",
            text: "text-white",
            border: "border-emerald-600",
        },
        rejected: {
            bg: "bg-red-500",
            text: "text-white",
            border: "border-red-600",
        },
        released: {
            bg: "bg-purple-600",
            text: "text-white",
            border: "border-purple-700",
        },
        verified: {
            bg: "bg-blue-500",
            text: "text-white",
            border: "border-blue-600",
        },
        submitted: {
            bg: "bg-indigo-500",
            text: "text-white",
            border: "border-indigo-600",
        },
        active: {
            bg: "bg-emerald-500",
            text: "text-white",
            border: "border-emerald-600",
        },
        inactive: {
            bg: "bg-gray-400",
            text: "text-white",
            border: "border-gray-500",
        },
    };

    return statusMap[statusLower] || {
        bg: "bg-default-200",
        text: "text-default-700",
        border: "border-default-300",
    };
}

/**
 * String Utilities
 */

export function truncate(str: string, length: number = 50): string {
    if (!str) return "";
    if (str.length <= length) return str;
    return str.substring(0, length) + "...";
}

export function capitalize(str: string): string {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
