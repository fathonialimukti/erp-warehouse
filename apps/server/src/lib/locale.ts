import { parse } from 'cookie';

export type ServerLocale = 'en' | 'id';
export const DEFAULT_LOCALE: ServerLocale = 'en';
export const SUPPORTED_LOCALES: ServerLocale[] = ['en', 'id'];
export const LOCALE_COOKIE_NAME = 'app-locale';

type MessageParams = Record<string, string | number | boolean | null | undefined>;

const messages: Record<ServerLocale, Record<string, string>> = {
  en: {
    'auth.invalidCredentials': 'Invalid email or password',
    'auth.authenticationRequired': 'Authentication required',
    'transaction.statusDraftOnly': 'Operation can only be performed on DRAFT status.',
    'transaction.statusPendingOnly': 'Operation can only be performed on PROPOSED status.',
    'notification.notFound': 'Notification not found',
    'notification.noAccess': 'You do not have access to this notification',
    'upload.invalidImageFormat': 'Invalid image format.',
    'upload.unsupportedImageFormat': 'Unsupported image format.',
    'sku.notFound': 'SKU not found',
    'palletType.notFound': 'Pallet type not found',
    'pallet.notFound': 'Pallet not found',
    'storageLocation.notFound': 'Storage location not found',
    'storageLocation.importRowMissingId': 'All rows must have an ID.',
    'storageLocation.importDuplicateIds': 'Duplicate IDs found in import file: {ids}',
    'storageLocation.importCannotDeleteFilled': 'Import failed. Locations with pallets cannot be deleted: {ids}',
    'activityLog.notFound': 'Activity log not found',
    'role.notFound': 'Role not found',
    'permission.notFound': 'Permission not found',
    'user.notFound': 'User not found',
    'user.emailExists': 'Email already exists',
    'user.cannotDeleteLastAdmin': 'Cannot delete the last system admin',
    'warehouse.notFound': 'Warehouse not found',
    'foundTransaction.notFound': 'Found transaction not found.',
    'foundTransaction.duplicateItem': 'Duplicate item for SKU and pallet type is not allowed.',
    'foundTransaction.palletTypeNotFound': 'Pallet type {palletTypeId} not found.',
    'foundTransaction.palletTypeMismatch': 'Pallet type {palletTypeId} does not match SKU {skuId}.',
    'foundTransaction.cannotUpdateGeneratedPallets': 'Item cannot be changed because pallets have already been generated.',
    'foundTransaction.cannotDeleteGeneratedPallets': 'Cannot delete transaction because pallets have already been generated.',
    'foundTransaction.emptyItems': 'Found transaction items cannot be empty.',
    'foundTransaction.alreadyGenerated': 'Pallets for this transaction have already been generated.',
    'inboundTransaction.notFound': 'Inbound transaction not found.',
    'inboundTransaction.emptyItems': 'Inbound transaction items cannot be empty.',
    'inboundTransaction.palletTypeNotFound': 'Pallet type {palletTypeId} not found.',
    'inboundTransaction.palletTypeMismatch': 'Pallet type {palletTypeId} does not match SKU {skuId}.',
    'inboundTransaction.duplicateItem': 'Duplicate item for SKU and pallet type is not allowed.',
    'inboundTransaction.alreadyGenerated': 'Pallets for this transaction have already been generated.',
    'inboundTransaction.cannotUpdateGeneratedPallets': 'Item cannot be changed because pallets have already been generated.',
    'inboundTransaction.cannotDeleteGeneratedPallets': 'Cannot delete transaction because pallets have already been generated.',
    'outboundTransaction.notFound': 'Outbound transaction not found.',
    'outboundTransaction.emptyPallets': 'Outbound pallet list cannot be empty.',
    'outboundTransaction.duplicatePalletIds': 'Duplicate pallet IDs are not allowed.',
    'outboundTransaction.palletsNotFound': 'Some pallets were not found.',
    'outboundTransaction.palletsInvalid': 'Some pallets cannot be used for outbound transactions.',
    'lossTransaction.notFound': 'Loss transaction not found.',
    'lossTransaction.emptyPallets': 'Loss transaction pallet list cannot be empty.',
    'lossTransaction.duplicatePalletIds': 'Duplicate pallet IDs are not allowed.',
    'lossTransaction.palletsNotFound': 'Some pallets were not found.',
    'lossTransaction.palletsInvalid': 'Some pallets cannot be used for loss transactions.',
    'transaction.notFound': 'Transaction not found.',
    'transaction.cannotDeleteGeneratedPallets': 'Cannot delete transaction because pallets have already been generated.',
  },
  id: {
    'auth.invalidCredentials': 'Email atau kata sandi salah',
    'auth.authenticationRequired': 'Autentikasi diperlukan',
    'transaction.statusDraftOnly': 'Operasi hanya dapat dilakukan saat status DRAFT.',
    'transaction.statusPendingOnly': 'Operasi hanya dapat dilakukan saat status PROPOSED.',
    'notification.notFound': 'Notifikasi tidak ditemukan',
    'notification.noAccess': 'Anda tidak memiliki akses ke notifikasi ini',
    'upload.invalidImageFormat': 'Format gambar tidak valid.',
    'upload.unsupportedImageFormat': 'Format gambar tidak didukung.',
    'sku.notFound': 'SKU tidak ditemukan',
    'palletType.notFound': 'Jenis palet tidak ditemukan',
    'pallet.notFound': 'Pallet tidak ditemukan',
    'storageLocation.notFound': 'Lokasi penyimpanan tidak ditemukan',
    'storageLocation.importRowMissingId': 'Semua baris wajib memiliki ID.',
    'storageLocation.importDuplicateIds': 'ID duplikat dalam file import: {ids}',
    'storageLocation.importCannotDeleteFilled': 'Import gagal. Lokasi yang terisi palet tidak boleh terhapus: {ids}',
    'activityLog.notFound': 'Activity log tidak ditemukan',
    'role.notFound': 'Role tidak ditemukan',
    'permission.notFound': 'Permission tidak ditemukan',
    'user.notFound': 'User tidak ditemukan',
    'user.emailExists': 'Email sudah ada',
    'user.cannotDeleteLastAdmin': 'Tidak dapat menghapus admin sistem terakhir',
    'warehouse.notFound': 'Gudang tidak ditemukan',
    'foundTransaction.notFound': 'Transaksi temuan tidak ditemukan.',
    'foundTransaction.duplicateItem': 'Item untuk SKU dan jenis palet yang sama tidak diperbolehkan.',
    'foundTransaction.palletTypeNotFound': 'Jenis palet {palletTypeId} tidak ditemukan.',
    'foundTransaction.palletTypeMismatch': 'Jenis palet {palletTypeId} tidak sesuai dengan SKU {skuId}.',
    'foundTransaction.cannotUpdateGeneratedPallets': 'Item tidak dapat diubah karena palet sudah tergenerate.',
    'foundTransaction.cannotDeleteGeneratedPallets': 'Tidak dapat menghapus transaksi karena palet sudah tergenerate.',
    'foundTransaction.emptyItems': 'Item transaksi temuan tidak boleh kosong.',
    'foundTransaction.alreadyGenerated': 'Palet untuk transaksi ini sudah pernah digenerate.',
    'inboundTransaction.notFound': 'Transaksi masuk tidak ditemukan.',
    'inboundTransaction.emptyItems': 'Item transaksi masuk tidak boleh kosong.',
    'inboundTransaction.palletTypeNotFound': 'Jenis palet {palletTypeId} tidak ditemukan.',
    'inboundTransaction.palletTypeMismatch': 'Jenis palet {palletTypeId} tidak sesuai dengan SKU {skuId}.',
    'inboundTransaction.duplicateItem': 'Item duplikat untuk kombinasi SKU dan jenis palet tidak diperbolehkan.',
    'inboundTransaction.alreadyGenerated': 'Palet untuk transaksi ini sudah pernah digenerate.',
    'inboundTransaction.cannotUpdateGeneratedPallets': 'Item tidak dapat diubah karena palet sudah tergenerate.',
    'inboundTransaction.cannotDeleteGeneratedPallets': 'Tidak dapat menghapus transaksi karena palet sudah tergenerate.',
    'outboundTransaction.notFound': 'Transaksi keluar tidak ditemukan.',
    'outboundTransaction.emptyPallets': 'Daftar palet transaksi keluar kosong.',
    'outboundTransaction.duplicatePalletIds': 'ID palet duplikat tidak diperbolehkan.',
    'outboundTransaction.palletsNotFound': 'Beberapa palet tidak ditemukan.',
    'outboundTransaction.palletsInvalid': 'Beberapa palet tidak dapat digunakan untuk transaksi keluar.',
    'lossTransaction.notFound': 'Transaksi kehilangan tidak ditemukan.',
    'lossTransaction.emptyPallets': 'Daftar palet transaksi kehilangan kosong.',
    'lossTransaction.duplicatePalletIds': 'ID palet duplikat tidak diperbolehkan.',
    'lossTransaction.palletsNotFound': 'Beberapa palet tidak ditemukan.',
    'lossTransaction.palletsInvalid': 'Beberapa palet tidak dapat digunakan untuk transaksi kehilangan.',
    'transaction.notFound': 'Transaksi tidak ditemukan.',
    'transaction.cannotDeleteGeneratedPallets': 'Tidak dapat menghapus transaksi karena palet sudah tergenerate.',
  },
};

export const parseLocaleCookie = (cookieHeader?: string): ServerLocale => {
  if (!cookieHeader) return DEFAULT_LOCALE;
  const cookies = parse(cookieHeader);
  const candidate = cookies[LOCALE_COOKIE_NAME];
  if (candidate === 'id') return 'id';
  return DEFAULT_LOCALE;
};

export const getMessage = (locale: ServerLocale, key: string, params?: MessageParams): string => {
  const template = messages[locale]?.[key] ?? messages[DEFAULT_LOCALE]?.[key] ?? key;
  if (!params) return template;
  return Object.entries(params).reduce((message, [paramName, paramValue]) => {
    return message.replace(new RegExp(`\\{${paramName}\\}`, 'g'), String(paramValue ?? ''));
  }, template);
};
