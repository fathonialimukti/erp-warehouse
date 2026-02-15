import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@heroui/react';

import { LoadingSpinner } from '@/components/shared-ui';
import { departemenRepository } from '@/repositories/departemen';
import { DefaultLayout } from '@/layouts/default';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PageHeader } from '@/components/page-header';

type Departemen = Awaited<ReturnType<typeof departemenRepository.detail>>;

const DepartemenDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [departemen, setDepartemen] = useState<Departemen | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDepartemen = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await departemenRepository.detail(id);

      setDepartemen(data);
    } catch {
      setDepartemen(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDepartemen();
  }, [loadDepartemen]);

  const breadcrumbItems = [
    { label: 'Departemen', href: '/departemen' },
    { label: 'Detail' },
  ];

  return (
    <DefaultLayout>
      <div className='container mx-auto px-4 py-6'>
        <Breadcrumbs items={breadcrumbItems} />
        <PageHeader
          backTo='/departemen'
          title={`Detail Departemen${departemen ? `: ${departemen.nama}` : ''}`}
        />

        {loading ? (
          <LoadingSpinner />
        ) : departemen ? (
          <div className='space-y-6'>
            <Card className='bg-linear-to-r from-orange-500 to-red-500 text-white'>
              <div className='card__header flex items-center gap-3'>
                <div className='p-2 backdrop-blur-sm rounded-lg'>
                  <svg
                    className='w-5 h-5 text-white'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'>
                    <path
                      d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                    />
                  </svg>
                </div>
                <h3 className='text-lg font-bold text-white'>
                  Informasi Departemen
                </h3>
              </div>
            </Card>

            <Card className='p-6'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-1'>
                  <label className='font-semibold text-gray-500'>
                    Kode Departemen
                  </label>
                  <p className='text-base font-semibold text-gray-900'>
                    {departemen.id}
                  </p>
                </div>
                <div className='space-y-1'>
                  <label className='font-semibold text-gray-500'>
                    Nama Departemen
                  </label>
                  <p className='text-base font-semibold text-gray-900'>
                    {departemen.nama}
                  </p>
                </div>
                <div className='space-y-1 md:col-span-2'>
                  <label className='font-semibold text-gray-500'>
                    Deskripsi
                  </label>
                  <p className='text-base font-semibold text-gray-900'>
                    {departemen.deskripsi || '-'}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center min-h-100'>
            <div className='text-center space-y-4'>
              <p className='text-gray-500 font-semibold text-lg'>
                Data departemen tidak ditemukan
              </p>
            </div>
          </div>
        )}
      </div>
    </DefaultLayout>
  );
};

export default DepartemenDetailPage;
