import type { Prisma } from '../prisma/generated/client';

export type AuditLogJson = Prisma.JsonValue;
type LogDetail = { before: AuditLogJson; after: AuditLogJson };

const isRelationObject = (value: unknown): boolean => {
    return (
        typeof value === 'object' &&
        value !== null &&
        'id' in value &&
        (typeof (value as Record<string, unknown>).id === 'string' || typeof (value as Record<string, unknown>).id === 'number')
    );
};

const isPureRelation = (value: unknown): boolean => {
    if (isRelationObject(value)) return true;
    if (Array.isArray(value) && value.length > 0 && value.every(isRelationObject)) return true;
    return false;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
};

const serializeScalar = (value: unknown): AuditLogJson => {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (value instanceof Date) return value.toISOString();
    return null;
};

const flattenField = (value: unknown): AuditLogJson | undefined => {
    if (isPureRelation(value)) return undefined;
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return serializeScalar(value);
    }
    if (value instanceof Date) {
        return serializeScalar(value);
    }
    if (Array.isArray(value)) {
        if (isPureRelation(value)) return undefined;
        const serialized = value
            .map((item) => flattenField(item))
            .filter((item): item is AuditLogJson => item !== undefined);
        return serialized;
    }
    if (isPlainObject(value)) {
        const normalized: Record<string, AuditLogJson> = {};
        for (const [key, childValue] of Object.entries(value)) {
            const flattened = flattenField(childValue);
            if (flattened !== undefined) {
                normalized[key] = flattened;
            }
        }
        return normalized;
    }
    return undefined;
};

const flattenRecord = (record: unknown): AuditLogJson => {
    if (!isPlainObject(record)) {
        return flattenField(record) ?? null;
    }

    const result: Record<string, AuditLogJson> = {};
    for (const [key, value] of Object.entries(record)) {
        if (isPureRelation(value)) continue;
        if (key === 'items' && Array.isArray(value)) {
            const items = value
                .map((item) => flattenField(item))
                .filter((item): item is AuditLogJson => item !== undefined);
            result[key] = items;
            continue;
        }

        const flattened = flattenField(value);
        if (flattened !== undefined) {
            result[key] = flattened;
        }
    }
    return result;
};

export const buildCreateLogDetail = (after: unknown): LogDetail => ({
    before: null,
    after: flattenRecord(after),
});

export const buildDeleteLogDetail = (before: unknown): LogDetail => ({
    before: flattenRecord(before),
    after: null,
});

export const buildUpdateLogDetail = (before: unknown, after: unknown): LogDetail => {
    if (!isPlainObject(before) || !isPlainObject(after)) {
        return { before: flattenRecord(before), after: flattenRecord(after) };
    }

    const beforeRecord = before as Record<string, unknown>;
    const afterRecord = after as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);

    const diffBefore: Record<string, AuditLogJson> = {};
    const diffAfter: Record<string, AuditLogJson> = {};

    for (const key of allKeys) {
        const bVal = beforeRecord[key];
        const aVal = afterRecord[key];

        if (key === 'items') {
            const hasItems = Array.isArray(bVal) || Array.isArray(aVal);
            if (!hasItems) continue;
            diffBefore[key] = Array.isArray(bVal)
                ? bVal.map((item) => flattenField(item)).filter((item): item is AuditLogJson => item !== undefined)
                : null;
            diffAfter[key] = Array.isArray(aVal)
                ? aVal.map((item) => flattenField(item)).filter((item): item is AuditLogJson => item !== undefined)
                : null;
            continue;
        }

        if (isPureRelation(bVal) || isPureRelation(aVal)) continue;

        const bFlattened = flattenField(bVal);
        const aFlattened = flattenField(aVal);

        if (JSON.stringify(bFlattened) !== JSON.stringify(aFlattened)) {
            diffBefore[key] = bFlattened ?? null;
            diffAfter[key] = aFlattened ?? null;
        }
    }

    return { before: diffBefore, after: diffAfter };
};

const normalizeValue = (value: unknown, key?: string, parentKey?: string): AuditLogJson => {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => normalizeValue(item, undefined, key));
    }

    if (typeof value === 'object' && value !== null && isRelationObject(value)) {
        const objectKeys = Object.keys(value);
        const isIdOnlyObject = objectKeys.length === 1;
        const isTopLevelItems = parentKey === 'items';

        if (isIdOnlyObject || !isTopLevelItems || key === 'items') {
            return String((value as Record<string, unknown>).id);
        }
    }

    if (typeof value === 'object' && value !== null) {
        const normalized: Record<string, AuditLogJson> = {};
        for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
            normalized[childKey] = normalizeValue(childValue, childKey, key);
        }
        return normalized;
    }

    return null;
};

export const normalizeRecordForActivityLog = (record: unknown): AuditLogJson => normalizeValue(record);

export const buildActivityLogDetail = (before: unknown, after: unknown): LogDetail => ({
    before: normalizeRecordForActivityLog(before),
    after: normalizeRecordForActivityLog(after),
});
