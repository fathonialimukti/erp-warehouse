import { faker } from '@faker-js/faker';

/**
 * Generate a unique test prefix so parallel runs don't collide.
 * Use `faker.string.alphanumeric(6)` for short unique IDs.
 */
export function createTestPrefix(suite: string): string {
  const ts = faker.string.alphanumeric(6).toUpperCase();
  return `E2E-${suite}-${ts}`;
}

/** Random Indonesian-style company name */
export function randomCompanyName(): string {
  return `PT ${faker.company.name()} ${faker.string.alphanumeric(3).toUpperCase()}`;
}

/** Random Indonesian address */
export function randomAddress(): string {
  return `Jl. ${faker.location.street()} No. ${faker.number.int({ min: 1, max: 200 })}, ${faker.location.city()}`;
}

/** Random warehouse code */
export function randomWarehouseCode(): string {
  return `WH-${faker.string.alphanumeric(6).toUpperCase()}`;
}

/** Random warehouse name */
export function randomWarehouseName(): string {
  return `Gudang ${faker.location.city()} ${faker.string.alphanumeric(3).toUpperCase()}`;
}

/** Random SKU code like SKU-A1B2C3 */
export function randomSkuCode(): string {
  return `SKU-${faker.string.alphanumeric(6).toUpperCase()}`;
}

/** Random product name */
export function randomSkuName(): string {
  return `${faker.commerce.productName()} ${faker.string.alphanumeric(3).toUpperCase()}`;
}

/** Random supplier code */
export function randomSupplierCode(): string {
  return `SUP-${faker.string.alphanumeric(6).toUpperCase()}`;
}

/** Random supplier name */
export function randomSupplierName(): string {
  return `${faker.company.name()} Suppliers`;
}

/** Random email */
export function randomEmail(): string {
  return faker.internet.email().toLowerCase();
}

/** Random phone */
export function randomPhone(): string {
  return faker.phone.number();
}

/** Random person name */
export function randomPersonName(): string {
  return faker.person.fullName();
}

/** Random document number (e.g., RCV-20260608-A1B2C3) */
export function randomDocNumber(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${date}-${faker.string.alphanumeric(6).toUpperCase()}`;
}

/** Random notes */
export function randomNotes(): string {
  return faker.lorem.sentence();
}

/** Pick a random element from an array */
export function randomPick<T>(arr: T[]): T {
  return arr[faker.number.int({ min: 0, max: arr.length - 1 })];
}