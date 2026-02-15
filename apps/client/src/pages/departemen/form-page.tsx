import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { Button, Card, toast } from '@heroui/react';

import { departemenRepository } from '@/repositories/departemen';
import {
  InputField,
  TextareaField,
  getFieldError,
} from '@/components/form-fields';
import { DefaultLayout } from '@/layouts/default';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PageHeader } from '@/components/page-header';

const departemenSchema = z.object({
  kode_departemen: z.string(),
  nama: z.string().min(1, 'Nama departemen wajib diisi'),
  deskripsi: z.string(),
});

const DepartemenFormPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(!!id);

  const isEdit = !!id;

  const form = useForm({
    defaultValues: {
      kode_departemen: '',
      nama: '',
      deskripsi: '',
    },
    validators: {
      onChange: departemenSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        setLoading(true);
        const submitData = {
          kode_departemen: value.kode_departemen?.trim() || undefined,
          nama: value.nama.trim(),
          deskripsi: value.deskripsi.trim() || undefined,
        };

        if (isEdit && id) {
          await departemenRepository.update(id, submitData);
          toast.success('Berhasil', {
            description: 'Departemen berhasil diperbarui',
          });
        } else {
          await departemenRepository.create(submitData);
          toast.success('Berhasil', {
            description: 'Departemen berhasil ditambahkan',
          });
        }
        navigate('/departemen');
      } catch (error: any) {
        toast.danger('Gagal', {
          description:
            error.message ||
            `Gagal ${isEdit ? 'memperbarui' : 'menambahkan'} departemen`,
        });
      } finally {
        setLoading(false);
      }
    },
  });

  useEffect(() => {
    const fetchDepartemen = async () => {
      if (!id) return;
      try {
        setFetchLoading(true);
        const data = await departemenRepository.detail(id);

        // Set kode_departemen dari id jika tidak ada
        form.setFieldValue('kode_departemen', data.kode_departemen || data.id);
        form.setFieldValue('nama', data.nama || '');
        form.setFieldValue('deskripsi', data.deskripsi || '');
      } catch (error: any) {
        toast.danger('Gagal', {
          description: 'Gagal memuat data departemen',
        });
        navigate('/departemen');
      } finally {
        setFetchLoading(false);
      }
    };

    fetchDepartemen();
  }, [id]);

  const breadcrumbItems = [
    { label: 'Departemen', href: '/departemen' },
    { label: isEdit ? 'Edit' : 'Tambah' },
  ];

  if (fetchLoading) {
    return (
      <DefaultLayout>
        <div className='container mx-auto px-4 py-6'>
          <div className='flex items-center justify-center min-h-100'>
            <div className='text-center space-y-4'>
              <div className='relative w-16 h-16 mx-auto'>
                <div className='absolute inset-0 border-4 border-orange-200 rounded-full animate-ping' />
                <div className='absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin' />
              </div>
              <p className='text-orange-600 font-semibold text-lg'>
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
          backTo='/departemen'
          title={`${isEdit ? 'Edit' : 'Tambah'} Departemen`}
        />

        <Card className='p-6'>
          <form
            className='space-y-4'
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}>
            <form.Field name='kode_departemen'>
              {(field) => (
                <InputField
                  description={
                    isEdit
                      ? 'Kode departemen diisi otomatis dari ID'
                      : 'Kode departemen akan diisi otomatis setelah disimpan'
                  }
                  error={getFieldError(field.state)}
                  label='Kode Departemen'
                  readOnly={isEdit}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </form.Field>

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

            <form.Field name='deskripsi'>
              {(field) => (
                <TextareaField
                  error={getFieldError(field.state)}
                  label='Deskripsi'
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </form.Field>

            <div className='flex gap-2 justify-end pt-4'>
              <Button
                isDisabled={loading}
                variant="ghost"
                onPress={() => navigate('/departemen')}>
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

export default DepartemenFormPage;
