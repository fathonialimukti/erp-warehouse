export type MockLokasiRow = {
  id: string;
  palletId: string | null;
  palletTypeId: string | null;
};

export const WAREHOUSE_LAYOUT_MOCK_ROWS: MockLokasiRow[] = Array.from({ length: 216 }, (_, i) => {
  const slot = String(i + 1).padStart(3, '0');
  return {
    id: slot,
    palletId: `PAL-${slot}`,
    palletTypeId: 'carton_on_pallet',
  };
});

