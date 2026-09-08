import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { protectedProcedure, router } from '../trpc.js';

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
}

const PER_GROUP = 5;

type TxDelegate = {
  findMany: (args: {
    where: { documentNumber: { contains: string; mode: 'insensitive' } };
    select: { id: true; documentNumber: true };
    orderBy: { createdAt: 'desc' };
    take: number;
  }) => Promise<Array<{ id: string; documentNumber: string | null }>>;
};

const txSearch = async (
  delegate: 'receivingTransaction' | 'wipCompletion' | 'rmaReceipt' | 'wipIssue' | 'shipment' | 'returnToSupplier' | 'disposal' | 'lossTransaction' | 'foundTransaction' | 'subinventoryTransfer',
  type: string,
  urlPrefix: string,
  q: string,
): Promise<SearchResult[]> => {
  const rows = await (prisma[delegate] as unknown as TxDelegate).findMany({
    where: { documentNumber: { contains: q, mode: 'insensitive' } },
    select: { id: true, documentNumber: true },
    orderBy: { createdAt: 'desc' },
    take: PER_GROUP,
  });
  return rows.map((row) => ({
    type,
    id: row.id,
    title: row.documentNumber ?? row.id,
    subtitle: null,
    url: `${urlPrefix}/${row.id}`,
  }));
};

/**
 * Global search for the Cmd+K command palette. Every resource is searched
 * with a case-insensitive contains on its primary identifier, top 5 per
 * group. Groups are filtered by the caller's read permissions.
 */
export const searchRouter = router({
  global: protectedProcedure
    .input(z.object({ q: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const q = input.q.trim();
      if (!q) return { groups: [] as { type: string; results: SearchResult[] }[] };

      const user = await prisma.user.findUnique({
        where: { id: ctx.user.userId },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      const permissions = new Set(user?.role?.permissions.map((rp) => rp.permission.name) ?? []);
      const can = (permission: string) =>
        permissions.has(permission) ||
        permissions.has(`${permission.split('@')[0] ?? ''}@*`) ||
        permissions.has('*');

      const groups: { type: string; results: SearchResult[] }[] = [];
      const addGroup = async (type: string, allowed: boolean, fn: () => Promise<SearchResult[]>) => {
        if (!allowed) return;
        try {
          const results = await fn();
          if (results.length > 0) groups.push({ type, results });
        } catch {
          // skip failed group (e.g. table not yet migrated) — never break search
        }
      };

      await Promise.all([
        addGroup('Receiving', can('receiving@read'), () => txSearch('receivingTransaction', 'Receiving', '/inbound-transaction/receiving', q)),
        addGroup('WIP Completion', can('wip-completion@read'), () => txSearch('wipCompletion', 'WIP Completion', '/inbound-transaction/wip-completion', q)),
        addGroup('RMA Receipt', can('rma-receipt@read'), () => txSearch('rmaReceipt', 'RMA Receipt', '/inbound-transaction/rma-receipt', q)),
        addGroup('Found', can('found@read'), () => txSearch('foundTransaction', 'Found', '/inbound-transaction/found', q)),
        addGroup('Shipment', can('shipment@read'), () => txSearch('shipment', 'Shipment', '/outbound-transaction/shipment', q)),
        addGroup('WIP Issue', can('wip-issue@read'), () => txSearch('wipIssue', 'WIP Issue', '/outbound-transaction/wip-issue', q)),
        addGroup('Return to Supplier', can('return-to-supplier@read'), () => txSearch('returnToSupplier', 'Return to Supplier', '/outbound-transaction/return-to-supplier', q)),
        addGroup('Disposal', can('disposal@read'), () => txSearch('disposal', 'Disposal', '/outbound-transaction/disposal', q)),
        addGroup('Loss', can('loss@read'), () => txSearch('lossTransaction', 'Loss', '/outbound-transaction/loss', q)),
        addGroup('Transfer', can('subinventory-transfer@read'), () => txSearch('subinventoryTransfer', 'Transfer', '/subinventory-transfer', q)),
        addGroup('SKU', can('sku@read'), async () => {
          const rows = await prisma.sku.findMany({
            where: { OR: [{ code: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] },
            select: { id: true, code: true, name: true },
            orderBy: { createdAt: 'desc' },
            take: PER_GROUP,
          });
          return rows.map((row) => ({ type: 'SKU', id: row.id, title: row.name, subtitle: row.code, url: `/skus/${row.id}` }));
        }),
        addGroup('Pallet', can('pallet@read'), async () => {
          const rows = await prisma.pallet.findMany({
            where: { palletNumber: { contains: q, mode: 'insensitive' } },
            select: { id: true, palletNumber: true },
            orderBy: { createdAt: 'desc' },
            take: PER_GROUP,
          });
          return rows.map((row) => ({
            type: 'Pallet',
            id: row.id,
            title: row.palletNumber ?? row.id,
            subtitle: null,
            url: `/pallets/${row.id}`,
          }));
        }),
        addGroup('Warehouse', can('warehouse@read'), async () => {
          const rows = await prisma.warehouse.findMany({
            where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }] },
            select: { id: true, name: true, code: true },
            take: PER_GROUP,
          });
          return rows.map((row) => ({ type: 'Warehouse', id: row.id, title: row.name, subtitle: row.code, url: `/warehouse/${row.id}` }));
        }),
        addGroup('Supplier', can('supplier@read'), async () => {
          const rows = await prisma.supplier.findMany({
            where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }] },
            select: { id: true, name: true, code: true },
            take: PER_GROUP,
          });
          return rows.map((row) => ({ type: 'Supplier', id: row.id, title: row.name, subtitle: row.code, url: `/suppliers/${row.id}` }));
        }),
        addGroup('Product', can('product@read'), async () => {
          const rows = await prisma.sku.findMany({
            where: {
              type: 'FINISHED_GOOD',
              OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }],
            },
            select: { id: true, name: true, code: true },
            take: PER_GROUP,
          });
          return rows.map((row) => ({ type: 'Product', id: row.id, title: row.name, subtitle: row.code, url: `/products/${row.id}` }));
        }),
        addGroup('Cycle Count', can('stock_count@read'), async () => {
          const rows = await prisma.stockCount.findMany({
            where: { documentNumber: { contains: q, mode: 'insensitive' } },
            select: { id: true, documentNumber: true },
            orderBy: { createdAt: 'desc' },
            take: PER_GROUP,
          });
          return rows.map((row) => ({ type: 'Cycle Count', id: row.id, title: row.documentNumber ?? row.id, subtitle: null, url: `/stock-count/${row.id}` }));
        }),
        addGroup('Purchase Order', can('purchase_order@read'), async () => {
          const rows = await prisma.purchaseOrder.findMany({
            where: { documentNumber: { contains: q, mode: 'insensitive' } },
            select: { id: true, documentNumber: true },
            orderBy: { createdAt: 'desc' },
            take: PER_GROUP,
          });
          return rows.map((row) => ({ type: 'Purchase Order', id: row.id, title: row.documentNumber ?? row.id, subtitle: null, url: `/purchase-order/${row.id}` }));
        }),
      ]);

      return { groups };
    }),
});
