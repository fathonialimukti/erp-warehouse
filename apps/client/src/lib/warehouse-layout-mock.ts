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

export const WAREHOUSE_LAYOUT_MOCK_ROWS: MockLokasiRow[] = [
  {
    id: '001',
    status: 'AKTIF',
    palet: { id: 'PAL-001', jenisPalet: { nama: 'Barrels', namaKemasan: 'barrels' } },
  },
  {
    id: '004',
    status: 'AKTIF',
    palet: { id: 'PAL-004', jenisPalet: { nama: 'Carton', namaKemasan: 'carton' } },
  },
  {
    id: '008',
    status: 'AKTIF',
    palet: { id: 'PAL-008', jenisPalet: { nama: 'Carton Danger', namaKemasan: 'carton_danger' } },
  },
  {
    id: '015',
    status: 'AKTIF',
    palet: { id: 'PAL-015', jenisPalet: { nama: 'Cement', namaKemasan: 'cement' } },
  },
  {
    id: '019',
    status: 'PENUH',
    palet: { id: 'PAL-019', jenisPalet: { nama: 'Concrete', namaKemasan: 'concrete' } },
  },
  {
    id: '024',
    status: 'AKTIF',
    palet: { id: 'PAL-024', jenisPalet: { nama: 'Gypsum', namaKemasan: 'gypsum' } },
  },
  {
    id: '032',
    status: 'MAINTENANCE',
    palet: null,
  },
  {
    id: '041',
    status: 'AKTIF',
    palet: { id: 'PAL-041', jenisPalet: { nama: 'Barrels', namaKemasan: 'barrels' } },
  },
  {
    id: '056',
    status: 'AKTIF',
    palet: { id: 'PAL-056', jenisPalet: { nama: 'Carton', namaKemasan: 'carton' } },
  },
  {
    id: '083',
    status: 'AKTIF',
    palet: { id: 'PAL-083', jenisPalet: { nama: 'Cement', namaKemasan: 'cement' } },
  },
  {
    id: '101',
    status: 'PENUH',
    palet: { id: 'PAL-101', jenisPalet: { nama: 'Gypsum', namaKemasan: 'gypsum' } },
  },
  {
    id: '140',
    status: 'AKTIF',
    palet: { id: 'PAL-140', jenisPalet: { nama: 'Concrete', namaKemasan: 'concrete' } },
  },
];
