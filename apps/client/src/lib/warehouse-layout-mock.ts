export type MockJenisPalet = {
  nama: string;
  namaKemasan?: string | null;
};

export type MockPalet = {
  id: string;
  jenisPalet: MockJenisPalet;
};

export type MockLokasiRow = {
  id: string;
  status: 'AKTIF' | 'MAINTENANCE' | 'PENUH';
  palet: MockPalet | null;
};

export const WAREHOUSE_LAYOUT_MOCK_ROWS: MockLokasiRow[] = Array.from({ length: 216 }, (_, i) => {
  const slot = String(i + 1).padStart(3, '0');
  return {
    id: slot,
    status: 'AKTIF',
    palet: {
      id: `PAL-${slot}`,
      jenisPalet: { nama: 'Cement', namaKemasan: 'cement' },
    },
  };
});

