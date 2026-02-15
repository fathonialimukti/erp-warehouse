import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@heroui/react';

import { LoadingSpinner } from '@/components/shared-ui';
import { customerRepository } from '@/repositories/customer';
import { DefaultLayout } from '@/layouts/default';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PageHeader } from '@/components/page-header';

type Customer = Awaited<ReturnType<typeof customerRepository.detail>>;

const CustomerDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCustomer = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await customerRepository.detail(id);

      setCustomer(data);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  const breadcrumbItems = [
    { label: 'Customer', href: '/customer' },
    { label: 'Detail' },
  ];

  return (
    <DefaultLayout>
      <div className='container mx-auto px-4 py-6'>
        <Breadcrumbs items={breadcrumbItems} />
        <PageHeader backTo='/customer' title='Detail Customer' />

        {loading ? (
          <LoadingSpinner />
        ) : customer ? (
          <Card className='p-6'>
            <div className='space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <p className='text-sm text-default-500'>ID</p>
                  <p className='font-semibold text-foreground'>{customer.id}</p>
                </div>
                <div className='space-y-2'>
                  <p className='text-sm text-default-500'>Nama</p>
                  <p className='font-semibold text-foreground'>
                    {customer.nama}
                  </p>
                </div>
                <div className='space-y-2'>
                  <p className='text-sm text-default-500'>No HP</p>
                  <p className='font-semibold text-foreground'>
                    {customer.no_hp || '-'}
                  </p>
                </div>
                <div className='space-y-2'>
                  <p className='text-sm text-default-500'>Email</p>
                  <p className='font-semibold text-foreground'>
                    {customer.email || '-'}
                  </p>
                </div>
                <div className='space-y-2 md:col-span-2'>
                  <p className='text-sm text-default-500'>Alamat</p>
                  <p className='font-semibold'>{customer.alamat || '-'}</p>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <div className='flex items-center justify-center min-h-100'>
            <div className='text-center space-y-4'>
              <p className='text-gray-500 font-semibold text-lg'>
                Data customer tidak ditemukan
              </p>
            </div>
          </div>
        )}
      </div>
    </DefaultLayout>
  );
};

export default CustomerDetailPage;
