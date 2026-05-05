export type MockLokasiRow = {
  id: string;
  pallet: {
    id: string;
    inboundTransactionItemId: string | null;
    inboundTransactionItem: { inboundTransactionId: string } | null;
    palletType: { id: string; name: string; objectId: string | null; sku: { name: string } } | null;
  } | null;
};

/** Change objectId to any of: CartonOnPallet, DrumOnPallet, SackOnPallet, CrateOnPallet, BrickOnPallet, IBCOnPallet */
export const WAREHOUSE_LAYOUT_MOCK_OBJECT_ID = 'SackOnPallet' as const;

export const WAREHOUSE_LAYOUT_MOCK_ROWS: MockLokasiRow[] = Array.from({ length: 216 }, (_, i) => {
  const slot = String(i + 1).padStart(3, '0');
  return {
    id: slot,
    pallet: {
      id: `PAL-${slot}`,
      inboundTransactionItemId: null,
      inboundTransactionItem: null,
      palletType: {
        id: 'MOCK',
        name: 'Mock Pallet',
        objectId: WAREHOUSE_LAYOUT_MOCK_OBJECT_ID,
        sku: { name: 'Mock SKU' },
      },
    },
  };
});

