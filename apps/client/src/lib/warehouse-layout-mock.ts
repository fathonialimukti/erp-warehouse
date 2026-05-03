export type MockLokasiRow = {
  id: string;
  palletId: string | null;
  palletTypeId: string | null;
  storageLocationId: string | null;
  inboundTransactionItemId: string | null;
  inboundTransactionId: string | null;
};

/** Change this to `'carton_on_pallet'` if you want carton visuals for mock pallet slots. */
export const WAREHOUSE_LAYOUT_MOCK_PALLET_TYPE = 'cement_on_pallet' as const;

export const WAREHOUSE_LAYOUT_MOCK_ROWS: MockLokasiRow[] = Array.from({ length: 216 }, (_, i) => {
  const slot = String(i + 1).padStart(3, '0');
  return {
    id: slot,
    palletId: `PAL-${slot}`,
    palletTypeId: WAREHOUSE_LAYOUT_MOCK_PALLET_TYPE,
    storageLocationId: `pallet_placeholder.${slot}`,
    inboundTransactionItemId: null,
    inboundTransactionId: null,
  };
});

