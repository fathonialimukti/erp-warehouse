import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { Button, Card, toast } from '@heroui/react';

import { customerRepository } from '@/repositories/customer';
import { InputField, getFieldError } from '@/components/form-fields';
import { DefaultLayout } from '@/layouts/default';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PageHeader } from '@/components/page-header';

const customerSchema = z.object({
  nama: z.string().min(1, 'Nama wajib diisi'),
  alamat: z.string(),
  no_hp: z.string(),
  email: z.string().email('Format email tidak valid').or(z.literal('')),
});

const CustomerFormPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(!!id);

  const isEdit = !!id;

  const form = useForm({
    defaultValues: {
      nama: '',
      alamat: '',
      no_hp: '',
      email: '',
    },
    validators: {
      onChange: customerSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        setLoading(true);
        const submitData = {
          nama: value.nama.trim(),
          alamat: value.alamat.trim() || undefined,
          no_hp: value.no_hp.trim() || undefined,
          email: value.email.trim() || undefined,
        };

        if (isEdit && id) {
          await customerRepository.update(id, submitData);
          toast.success('Berhasil', {
            description: 'Customer berhasil diperbarui',
          });
        } else {
          await customerRepository.create(submitData);
          toast.success('Berhasil', {
            description: 'Customer berhasil ditambahkan',
          });
        }
        navigate('/customer');
      } catch (error: any) {
        toast.danger('Gagal', {
          description:
            error.message ||
            `Gagal ${isEdit ? 'memperbarui' : 'menambahkan'} customer`,
        });
      } finally {
        setLoading(false);
      }
    },
  });

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!id) return;
      try {
        setFetchLoading(true);
        const data = await customerRepository.detail(id);

        form.setFieldValue('nama', data.nama || '');
        form.setFieldValue('alamat', data.alamat || '');
        form.setFieldValue('no_hp', data.no_hp || '');
        form.setFieldValue('email', data.email || '');
      } catch (error: any) {
        toast.danger('Gagal', {
          description: 'Gagal memuat data customer',
        });
        navigate('/customer');
      } finally {
        setFetchLoading(false);
      }
    };

    fetchCustomer();
  }, [id]);

  const breadcrumbItems = [
    { label: 'Customer', href: '/customer' },
    { label: isEdit ? 'Edit' : 'Tambah' },
  ];

  if (fetchLoading) {
    return (
      <DefaultLayout>
        <div className='container mx-auto px-4 py-6'>
          <div className='flex items-center justify-center min-h-100'>
            <div className='text-center space-y-4'>
              <div className='relative w-16 h-16 mx-auto'>
                <div className='absolute inset-0 border-4 border-blue-200 rounded-full animate-ping' />
                <div className='absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin' />
              </div>
              <p className='text-blue-600 font-semibold text-lg'>
                Memuat data...
              </p>
            </div>
          </div>
        </div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <div className='container mx-auto px-4 py-6'>
        <Breadcrumbs items={breadcrumbItems} />
        <PageHeader
          backTo='/customer'
          title={`${isEdit ? 'Edit' : 'Tambah'} Customer`}
        />

        <Card className='p-6'>
          <form
            className='space-y-4'
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}>
            <form.Field name='nama'>
              {(field) => (
                <InputField
                  required
                  error={getFieldError(field.state)}
                  label='Nama'
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </form.Field>

            <form.Field name='alamat'>
              {(field) => (
                <InputField
                  error={getFieldError(field.state)}
                  label='Alamat'
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </form.Field>

            <form.Field name='no_hp'>
              {(field) => (
                <InputField
                  error={getFieldError(field.state)}
                  label='No HP'
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </form.Field>

            <form.Field name='email'>
              {(field) => (
                <InputField
                  error={getFieldError(field.state)}
                  label='Email'
                  type='email'
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </form.Field>

            <div className='flex gap-2 justify-end pt-4'>
              <Button
                isDisabled={loading}
                variant="ghost"
                onPress={() => navigate('/customer')}>
                Batal
              </Button>
              <Button color='primary' isLoading={loading} type='submit'>
                Simpan
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </DefaultLayout>
  );
};

export default CustomerFormPage;
