import { parse } from 'cookie';

export type ServerLocale = 'en' | 'id';
export const DEFAULT_LOCALE: ServerLocale = 'en';
export const SUPPORTED_LOCALES: ServerLocale[] = ['en', 'id'];
export const LOCALE_COOKIE_NAME = 'app-locale';

type MessageParams = Record<string, string | number | boolean | null | undefined>;

const messages: Record<ServerLocale, Record<string, string>> = {
  en: {
    // Auth
    'auth.invalidCredentials': 'Invalid email or password',
    'auth.authenticationRequired': 'Authentication required',
    'auth.noRoleAssigned': 'No role assigned',
    'auth.insufficientPermissions': 'Insufficient permissions',
    'auth.accountLocked': 'Account temporarily locked due to too many failed attempts. Try again later.',
    'auth.tokenRevoked': 'Session revoked. Please sign in again.',
    'auth.currentPasswordIncorrect': 'Current password is incorrect',
    'auth.passwordTooShort': 'Password must be at least {min} characters',
    'auth.resetTokenInvalid': 'Password reset link is invalid or has expired',

    // Notification
    'notification.notFound': 'Notification not found',
    'notification.noAccess': 'You do not have access to this notification',
    'notification.noRecipients': 'No recipients specified.',

    // Upload
    'upload.invalidImageFormat': 'Invalid image format.',
    'upload.unsupportedImageFormat': 'Unsupported image format.',

    // Backup
    'backup.notFound': 'Backup file not found.',
    'backup.invalidFormat': 'Invalid backup file format.',
    'backup.versionMismatch': 'Backup schema version does not match the current app version. Use force to restore anyway.',

    // SKU
    'sku.notFound': 'SKU not found',
    'sku.codeTaken': 'SKU code is already taken',
    'sku.hasStock': 'Cannot delete SKU because it has stock on-hand (available pallets)',

    // Product
    'product.notFound': 'Product not found',
    'product.codeTaken': 'Product code is already taken',
    'product.deleteHasPallets': 'Cannot delete product because it still has pallets on-hand',

    // Pallet
    'pallet.notFound': 'Pallet not found',

    // Storage Location
    'storageLocation.notFound': 'Storage location not found',
    'storageLocation.importRowMissingId': 'All rows must have an ID.',
    'storageLocation.importDuplicateIds': 'Duplicate IDs found in import file: {ids}',
    'storageLocation.importCannotDeleteFilled': 'Import failed. Locations with pallets cannot be deleted: {ids}',

    // Activity Log
    'activityLog.notFound': 'Activity log not found',

    // Role
    'role.notFound': 'Role not found',

    // Permission
    'permission.notFound': 'Permission not found',

    // User
    'user.notFound': 'User not found',
    'user.emailExists': 'Email already exists',
    'user.cannotDeleteLastAdmin': 'Cannot delete the last system admin',

    // Warehouse
    'warehouse.notFound': 'Warehouse not found',

    // Supplier
    'supplier.notFound': 'Supplier not found',
    'supplier.codeTaken': 'Supplier code is already taken',

    // Knowledge Base
    'knowledge.notFound': 'Knowledge document not found',
    'knowledge.slugTaken': 'Knowledge document slug is already taken',

    // Stock Movement
    'stockMovement.notFound': 'Stock movement not found',

    // Outbound Transaction (dispatch)
    'outboundTransaction.notFound': 'Outbound transaction not found',
    'outboundTransaction.notDispatchable': 'This transaction type does not support dispatch picking.',
    'outboundTransaction.notApproved': 'Transaction must be approved before dispatch.',
    'outboundTransaction.palletNotInTransaction': 'Pallet {palletId} is not part of this transaction.',

    // Generic Transaction
    'transaction.notFound': 'Transaction not found.',
    'transaction.cannotDeleteGeneratedPallets': 'Cannot delete transaction because pallets have already been generated.',
    'transaction.insufficientStock': 'Insufficient stock for SKU {skuId}: need {needed}, available {available}.',
    'transaction.notPutawayType': 'This transaction type does not support putaway.',
    'transaction.notDispatchType': 'This transaction type does not support dispatch picking.',
    'transaction.notApproved': 'Transaction must be approved before processing.',
    'transaction.palletNotInTransaction': 'Pallet {palletId} is not part of this transaction.',
    'transaction.locationWrongWarehouse': 'Storage location does not belong to this warehouse.',
    'transaction.locationOccupied': 'Storage location {locationId} is already occupied by another pallet.',

    // Found Transaction
    'foundTransaction.notFound': 'Found transaction not found.',
    'foundTransaction.duplicateItem': 'Duplicate SKU item is not allowed.',
    'foundTransaction.skuNotFound': 'SKU {skuId} not found.',
    'foundTransaction.cannotUpdate': 'Cannot update found transaction.',
    'foundTransaction.cannotDelete': 'Cannot delete found transaction.',
    'foundTransaction.cannotUpdateGeneratedPallets': 'Item cannot be changed because pallets have already been generated.',
    'foundTransaction.cannotDeleteGeneratedPallets': 'Cannot delete transaction because pallets have already been generated.',
    'foundTransaction.emptyItems': 'Found transaction items cannot be empty.',
    'foundTransaction.alreadyGenerated': 'Pallets for this transaction have already been generated.',

    // Receiving Transaction
    'receivingTransaction.notFound': 'Receiving transaction not found.',
    'receivingTransaction.cannotUpdate': 'Cannot update receiving transaction.',
    'receivingTransaction.cannotDelete': 'Cannot delete receiving transaction.',
    'receivingTransaction.emptyItems': 'Receiving transaction items cannot be empty.',
    'receivingTransaction.duplicateItem': 'Duplicate SKU item is not allowed.',
    'receivingTransaction.skuNotFound': 'SKU {skuId} not found.',
    'receivingTransaction.alreadyGenerated': 'Pallets for this transaction have already been generated.',
    'receivingTransaction.cannotUpdateGeneratedPallets': 'Item cannot be changed because pallets have already been generated.',
    'receivingTransaction.cannotDeleteGeneratedPallets': 'Cannot delete transaction because pallets have already been generated.',

    // RMA Receipt
    'rmaReceipt.notFound': 'RMA receipt not found.',
    'rmaReceipt.cannotUpdate': 'Cannot update RMA receipt.',
    'rmaReceipt.cannotDelete': 'Cannot delete RMA receipt.',
    'rmaReceipt.emptyItems': 'RMA receipt items cannot be empty.',
    'rmaReceipt.alreadyGenerated': 'Pallets for this transaction have already been generated.',
    'rmaReceipt.cannotUpdateGeneratedPallets': 'Item cannot be changed because pallets have already been generated.',
    'rmaReceipt.cannotDeleteGeneratedPallets': 'Cannot delete transaction because pallets have already been generated.',

    // WIP Completion
    'wipCompletion.notFound': 'WIP completion not found.',
    'wipCompletion.cannotUpdate': 'Cannot update WIP completion.',
    'wipCompletion.cannotDelete': 'Cannot delete WIP completion.',
    'wipCompletion.emptyItems': 'WIP completion items cannot be empty.',
    'wipCompletion.alreadyGenerated': 'Pallets for this transaction have already been generated.',
    'wipCompletion.cannotUpdateGeneratedPallets': 'Item cannot be changed because pallets have already been generated.',
    'wipCompletion.cannotDeleteGeneratedPallets': 'Cannot delete transaction because pallets have already been generated.',

    // Shipment
    'shipment.notFound': 'Shipment not found.',
    'shipment.cannotUpdate': 'Cannot update shipment.',
    'shipment.cannotDelete': 'Cannot delete shipment.',
    'shipment.emptyItems': 'Shipment items cannot be empty.',
    'shipment.alreadyReserved': 'Pallets are already reserved for this shipment.',
    'shipment.cannotUpdateReservedPallets': 'Cannot update shipment because pallets have already been reserved.',
    'shipment.cannotDeleteReservedPallets': 'Cannot delete shipment because pallets have already been reserved.',

    // Return to Supplier
    'returnToSupplier.notFound': 'Return to supplier not found.',
    'returnToSupplier.cannotUpdate': 'Cannot update return to supplier.',
    'returnToSupplier.cannotDelete': 'Cannot delete return to supplier.',
    'returnToSupplier.emptyItems': 'Return to supplier items cannot be empty.',
    'returnToSupplier.alreadyReserved': 'Pallets are already reserved for this return to supplier.',
    'returnToSupplier.cannotUpdateReservedPallets': 'Cannot update return to supplier because pallets have already been reserved.',
    'returnToSupplier.cannotDeleteReservedPallets': 'Cannot delete return to supplier because pallets have already been reserved.',

    // Disposal
    'disposal.notFound': 'Disposal not found.',
    'disposal.cannotUpdate': 'Cannot update disposal.',
    'disposal.cannotDelete': 'Cannot delete disposal.',
    'disposal.emptyItems': 'Disposal items cannot be empty.',
    'disposal.alreadyReserved': 'Pallets are already reserved for this disposal.',
    'disposal.cannotUpdateReservedPallets': 'Cannot update disposal because pallets have already been reserved.',
    'disposal.cannotDeleteReservedPallets': 'Cannot delete disposal because pallets have already been reserved.',

    // WIP Issue
    'wipIssue.notFound': 'WIP issue not found.',
    'wipIssue.cannotUpdate': 'Cannot update WIP issue.',
    'wipIssue.cannotDelete': 'Cannot delete WIP issue.',
    'wipIssue.emptyItems': 'WIP issue items cannot be empty.',

    // Loss Transaction
    'lossTransaction.notFound': 'Loss transaction not found.',
    'lossTransaction.cannotUpdate': 'Cannot update loss transaction.',
    'lossTransaction.cannotDelete': 'Cannot delete loss transaction.',
    'lossTransaction.emptyItems': 'Loss transaction items cannot be empty.',
    'lossTransaction.emptyPallets': 'Loss transaction pallet list cannot be empty.',
    'lossTransaction.duplicatePalletIds': 'Duplicate pallet IDs are not allowed.',
    'lossTransaction.palletsNotFound': 'Some pallets were not found.',
    'lossTransaction.palletsInvalid': 'Some pallets cannot be used for loss transactions.',

    // Subinventory Transfer
    'subinventoryTransfer.notFound': 'Subinventory transfer not found.',
    'subinventoryTransfer.cannotUpdate': 'Cannot update subinventory transfer.',
    'subinventoryTransfer.cannotDelete': 'Cannot delete subinventory transfer.',
    'subinventoryTransfer.emptyItems': 'Subinventory transfer items cannot be empty.',
    'subinventoryTransfer.palletNotFound': 'Pallet not found for this subinventory transfer.',
    'subinventoryTransfer.palletNotAvailable': 'Pallet is not available for this subinventory transfer.',

    // Putaway
    'putaway.notFound': 'Putaway not found.',
    'putaway.locationNotFound': 'Storage location not found for putaway.',
    'putaway.alreadyCompleted': 'Putaway has already been completed.',
    'putaway.transactionMustBeApproved': 'Putaway can only be processed for approved inbound transactions.',
    'putaway.noPendingPallets': 'No pending pallets are available for putaway.',

    // Pick (outbound line completion)
    'pick.notFound': 'Pick line not found.',
    'pick.alreadyCompleted': 'Pick line has already been completed.',
    'putaway.assignmentCountMismatch': 'Assignment count mismatch. Expected {expected}, received {actual}.',
    'putaway.palletNotAssignable': 'One or more pallets are not assignable for this putaway request.',
    'putaway.locationNotAssignable': 'One or more storage locations are not assignable for this putaway request.',
    'putaway.duplicatePalletAssignment': 'Duplicate pallet assignment is not allowed.',
    'putaway.duplicateLocationAssignment': 'Duplicate storage location assignment is not allowed.',
  },
  id: {
    // Auth
    'auth.invalidCredentials': 'Email atau kata sandi salah',
    'auth.authenticationRequired': 'Autentikasi diperlukan',
    'auth.noRoleAssigned': 'Tidak ada peran yang ditetapkan',
    'auth.insufficientPermissions': 'Izin tidak mencukupi',
    'auth.accountLocked': 'Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi nanti.',
    'auth.tokenRevoked': 'Sesi dicabut. Silakan masuk kembali.',
    'auth.currentPasswordIncorrect': 'Kata sandi saat ini salah',
    'auth.passwordTooShort': 'Kata sandi minimal {min} karakter',
    'auth.resetTokenInvalid': 'Tautan atur ulang kata sandi tidak valid atau sudah kedaluwarsa',

    // Notification
    'notification.notFound': 'Notifikasi tidak ditemukan',
    'notification.noAccess': 'Anda tidak memiliki akses ke notifikasi ini',
    'notification.noRecipients': 'Tidak ada penerima yang ditentukan.',

    // Upload
    'upload.invalidImageFormat': 'Format gambar tidak valid.',
    'upload.unsupportedImageFormat': 'Format gambar tidak didukung.',

    // Backup
    'backup.notFound': 'File backup tidak ditemukan.',
    'backup.invalidFormat': 'Format file backup tidak valid.',
    'backup.versionMismatch': 'Versi skema backup tidak sesuai dengan versi aplikasi saat ini. Gunakan paksa untuk tetap memulihkan.',

    // SKU
    'sku.notFound': 'SKU tidak ditemukan',
    'sku.codeTaken': 'Kode SKU sudah digunakan',
    'sku.hasStock': 'Tidak dapat menghapus SKU karena masih memiliki stok (palet tersedia)',

    // Product
    'product.notFound': 'Produk tidak ditemukan',
    'product.codeTaken': 'Kode produk sudah digunakan',
    'product.deleteHasPallets': 'Tidak dapat menghapus produk karena masih memiliki palet',

    // Pallet
    'pallet.notFound': 'Pallet tidak ditemukan',

    // Storage Location
    'storageLocation.notFound': 'Lokasi penyimpanan tidak ditemukan',
    'storageLocation.importRowMissingId': 'Semua baris wajib memiliki ID.',
    'storageLocation.importDuplicateIds': 'ID duplikat dalam file import: {ids}',
    'storageLocation.importCannotDeleteFilled': 'Import gagal. Lokasi yang terisi palet tidak boleh terhapus: {ids}',

    // Activity Log
    'activityLog.notFound': 'Activity log tidak ditemukan',

    // Role
    'role.notFound': 'Role tidak ditemukan',

    // Permission
    'permission.notFound': 'Permission tidak ditemukan',

    // User
    'user.notFound': 'User tidak ditemukan',
    'user.emailExists': 'Email sudah ada',
    'user.cannotDeleteLastAdmin': 'Tidak dapat menghapus admin sistem terakhir',

    // Warehouse
    'warehouse.notFound': 'Gudang tidak ditemukan',

    // Supplier
    'supplier.notFound': 'Pemasok tidak ditemukan',
    'supplier.codeTaken': 'Kode pemasok sudah digunakan',

    // Knowledge Base
    'knowledge.notFound': 'Dokumen knowledge tidak ditemukan',
    'knowledge.slugTaken': 'Slug dokumen knowledge sudah digunakan',

    // Stock Movement
    'stockMovement.notFound': 'Pergerakan stok tidak ditemukan',

    // Outbound Transaction (dispatch)
    'outboundTransaction.notFound': 'Transaksi outbound tidak ditemukan',
    'outboundTransaction.notDispatchable': 'Tipe transaksi ini tidak mendukung pemilihan dispatch.',
    'outboundTransaction.notApproved': 'Transaksi harus disetujui sebelum dispatch.',
    'outboundTransaction.palletNotInTransaction': 'Palet {palletId} bukan bagian dari transaksi ini.',

    // Generic Transaction
    'transaction.notFound': 'Transaksi tidak ditemukan.',
    'transaction.cannotDeleteGeneratedPallets': 'Tidak dapat menghapus transaksi karena palet sudah tergenerate.',
    'transaction.insufficientStock': 'Stok tidak cukup untuk SKU {skuId}: dibutuhkan {needed}, tersedia {available}.',
    'transaction.notPutawayType': 'Tipe transaksi ini tidak mendukung putaway.',
    'transaction.notDispatchType': 'Tipe transaksi ini tidak mendukung pemilihan dispatch.',
    'transaction.notApproved': 'Transaksi harus disetujui sebelum diproses.',
    'transaction.palletNotInTransaction': 'Palet {palletId} bukan bagian dari transaksi ini.',
    'transaction.locationWrongWarehouse': 'Lokasi penyimpanan bukan milik gudang ini.',
    'transaction.locationOccupied': 'Lokasi penyimpanan {locationId} sudah ditempati palet lain.',

    // Found Transaction
    'foundTransaction.notFound': 'Transaksi temuan tidak ditemukan.',
    'foundTransaction.duplicateItem': 'Item SKU duplikat tidak diperbolehkan.',
    'foundTransaction.skuNotFound': 'SKU {skuId} tidak ditemukan.',
    'foundTransaction.cannotUpdate': 'Tidak dapat memperbarui transaksi temuan.',
    'foundTransaction.cannotDelete': 'Tidak dapat menghapus transaksi temuan.',
    'foundTransaction.cannotUpdateGeneratedPallets': 'Item tidak dapat diubah karena palet sudah tergenerate.',
    'foundTransaction.cannotDeleteGeneratedPallets': 'Tidak dapat menghapus transaksi karena palet sudah tergenerate.',
    'foundTransaction.emptyItems': 'Item transaksi temuan tidak boleh kosong.',
    'foundTransaction.alreadyGenerated': 'Palet untuk transaksi ini sudah pernah digenerate.',

    // Receiving Transaction
    'receivingTransaction.notFound': 'Transaksi penerimaan tidak ditemukan.',
    'receivingTransaction.cannotUpdate': 'Tidak dapat memperbarui transaksi penerimaan.',
    'receivingTransaction.cannotDelete': 'Tidak dapat menghapus transaksi penerimaan.',
    'receivingTransaction.emptyItems': 'Item transaksi penerimaan tidak boleh kosong.',
    'receivingTransaction.duplicateItem': 'Item SKU duplikat tidak diperbolehkan.',
    'receivingTransaction.skuNotFound': 'SKU {skuId} tidak ditemukan.',
    'receivingTransaction.alreadyGenerated': 'Palet untuk transaksi ini sudah pernah digenerate.',
    'receivingTransaction.cannotUpdateGeneratedPallets': 'Item tidak dapat diubah karena palet sudah tergenerate.',
    'receivingTransaction.cannotDeleteGeneratedPallets': 'Tidak dapat menghapus transaksi karena palet sudah tergenerate.',

    // RMA Receipt
    'rmaReceipt.notFound': 'Tanda terima RMA tidak ditemukan.',
    'rmaReceipt.cannotUpdate': 'Tidak dapat memperbarui tanda terima RMA.',
    'rmaReceipt.cannotDelete': 'Tidak dapat menghapus tanda terima RMA.',
    'rmaReceipt.emptyItems': 'Item tanda terima RMA tidak boleh kosong.',
    'rmaReceipt.alreadyGenerated': 'Palet untuk transaksi ini sudah pernah digenerate.',
    'rmaReceipt.cannotUpdateGeneratedPallets': 'Item tidak dapat diubah karena palet sudah tergenerate.',
    'rmaReceipt.cannotDeleteGeneratedPallets': 'Tidak dapat menghapus transaksi karena palet sudah tergenerate.',

    // WIP Completion
    'wipCompletion.notFound': 'Penyelesaian WIP tidak ditemukan.',
    'wipCompletion.cannotUpdate': 'Tidak dapat memperbarui penyelesaian WIP.',
    'wipCompletion.cannotDelete': 'Tidak dapat menghapus penyelesaian WIP.',
    'wipCompletion.emptyItems': 'Item penyelesaian WIP tidak boleh kosong.',
    'wipCompletion.alreadyGenerated': 'Palet untuk transaksi ini sudah pernah digenerate.',
    'wipCompletion.cannotUpdateGeneratedPallets': 'Item tidak dapat diubah karena palet sudah tergenerate.',
    'wipCompletion.cannotDeleteGeneratedPallets': 'Tidak dapat menghapus transaksi karena palet sudah tergenerate.',

    // Shipment
    'shipment.notFound': 'Pengiriman tidak ditemukan.',
    'shipment.cannotUpdate': 'Tidak dapat memperbarui pengiriman.',
    'shipment.cannotDelete': 'Tidak dapat menghapus pengiriman.',
    'shipment.emptyItems': 'Item pengiriman tidak boleh kosong.',
    'shipment.alreadyReserved': 'Palet sudah direservasi untuk pengiriman ini.',
    'shipment.cannotUpdateReservedPallets': 'Tidak dapat memperbarui pengiriman karena palet sudah direservasi.',
    'shipment.cannotDeleteReservedPallets': 'Tidak dapat menghapus pengiriman karena palet sudah direservasi.',

    // Return to Supplier
    'returnToSupplier.notFound': 'Pengembalian ke pemasok tidak ditemukan.',
    'returnToSupplier.cannotUpdate': 'Tidak dapat memperbarui pengembalian ke pemasok.',
    'returnToSupplier.cannotDelete': 'Tidak dapat menghapus pengembalian ke pemasok.',
    'returnToSupplier.emptyItems': 'Item pengembalian ke pemasok tidak boleh kosong.',
    'returnToSupplier.alreadyReserved': 'Palet sudah direservasi untuk pengembalian ke pemasok ini.',
    'returnToSupplier.cannotUpdateReservedPallets': 'Tidak dapat memperbarui pengembalian ke pemasok karena palet sudah direservasi.',
    'returnToSupplier.cannotDeleteReservedPallets': 'Tidak dapat menghapus pengembalian ke pemasok karena palet sudah direservasi.',

    // Disposal
    'disposal.notFound': 'Pembuangan tidak ditemukan.',
    'disposal.cannotUpdate': 'Tidak dapat memperbarui pembuangan.',
    'disposal.cannotDelete': 'Tidak dapat menghapus pembuangan.',
    'disposal.emptyItems': 'Item pembuangan tidak boleh kosong.',
    'disposal.alreadyReserved': 'Palet sudah direservasi untuk pembuangan ini.',
    'disposal.cannotUpdateReservedPallets': 'Tidak dapat memperbarui pembuangan karena palet sudah direservasi.',
    'disposal.cannotDeleteReservedPallets': 'Tidak dapat menghapus pembuangan karena palet sudah direservasi.',

    // WIP Issue
    'wipIssue.notFound': 'Pengeluaran WIP tidak ditemukan.',
    'wipIssue.cannotUpdate': 'Tidak dapat memperbarui pengeluaran WIP.',
    'wipIssue.cannotDelete': 'Tidak dapat menghapus pengeluaran WIP.',
    'wipIssue.emptyItems': 'Item pengeluaran WIP tidak boleh kosong.',

    // Loss Transaction
    'lossTransaction.notFound': 'Transaksi kehilangan tidak ditemukan.',
    'lossTransaction.cannotUpdate': 'Tidak dapat memperbarui transaksi kehilangan.',
    'lossTransaction.cannotDelete': 'Tidak dapat menghapus transaksi kehilangan.',
    'lossTransaction.emptyItems': 'Item transaksi kehilangan tidak boleh kosong.',
    'lossTransaction.emptyPallets': 'Daftar palet transaksi kehilangan kosong.',
    'lossTransaction.duplicatePalletIds': 'ID palet duplikat tidak diperbolehkan.',
    'lossTransaction.palletsNotFound': 'Beberapa palet tidak ditemukan.',
    'lossTransaction.palletsInvalid': 'Beberapa palet tidak dapat digunakan untuk transaksi kehilangan.',

    // Subinventory Transfer
    'subinventoryTransfer.notFound': 'Transfer subinventori tidak ditemukan.',
    'subinventoryTransfer.cannotUpdate': 'Tidak dapat memperbarui transfer subinventori.',
    'subinventoryTransfer.cannotDelete': 'Tidak dapat menghapus transfer subinventori.',
    'subinventoryTransfer.emptyItems': 'Item transfer subinventori tidak boleh kosong.',
    'subinventoryTransfer.palletNotFound': 'Palet tidak ditemukan untuk transfer subinventori ini.',
    'subinventoryTransfer.palletNotAvailable': 'Palet tidak tersedia untuk transfer subinventori ini.',

    // Putaway
    'putaway.notFound': 'Putaway tidak ditemukan.',
    'putaway.locationNotFound': 'Lokasi penyimpanan tidak ditemukan untuk putaway.',
    'putaway.alreadyCompleted': 'Putaway sudah selesai.',
    'putaway.transactionMustBeApproved': 'Putaway hanya dapat diproses untuk transaksi masuk yang sudah disetujui.',
    'putaway.noPendingPallets': 'Tidak ada palet tertunda yang dapat diproses putaway.',

    // Pick (outbound line completion)
    'pick.notFound': 'Pick line tidak ditemukan.',
    'pick.alreadyCompleted': 'Pick line sudah selesai.',
    'putaway.assignmentCountMismatch': 'Jumlah assignment tidak sesuai. Diharapkan {expected}, diterima {actual}.',
    'putaway.palletNotAssignable': 'Satu atau lebih palet tidak dapat diproses untuk putaway ini.',
    'putaway.locationNotAssignable': 'Satu atau lebih lokasi penyimpanan tidak dapat dipakai untuk putaway ini.',
    'putaway.duplicatePalletAssignment': 'Assignment palet duplikat tidak diperbolehkan.',
    'putaway.duplicateLocationAssignment': 'Assignment lokasi penyimpanan duplikat tidak diperbolehkan.',
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
