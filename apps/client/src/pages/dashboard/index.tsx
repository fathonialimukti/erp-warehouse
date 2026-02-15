import { useState, useEffect } from 'react';
import { Card, Spinner, Button } from '@heroui/react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  FileText,
  Wallet,
  AlertTriangle,
  Database,
  Building,
  Receipt,
  CreditCard,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { DefaultLayout } from '@/layouts/default';
import { title } from '@/components/primitives';
import { ThreeDemo } from '@/components/three-demo';

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Dummy data for prototype
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalVendors: 0,
    totalProducts: 0,
    totalKaryawan: 0,
    totalInvoices: 0,
    totalPembayaran: 0,
    lowStockProducts: 0,
    pendingInvoices: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    currentBalance: 0,
    todayIncome: 0,
    todayExpense: 0,
  });

  // Dummy revenue data for chart
  const revenueData = [
    { month: 'Jan', pendapatan: 15000000, pengeluaran: 12000000 },
    { month: 'Feb', pendapatan: 18000000, pengeluaran: 13500000 },
    { month: 'Mar', pendapatan: 22000000, pengeluaran: 15000000 },
    { month: 'Apr', pendapatan: 20000000, pengeluaran: 14000000 },
    { month: 'Mei', pendapatan: 25000000, pengeluaran: 16500000 },
    { month: 'Jun', pendapatan: 28000000, pengeluaran: 18000000 },
  ];

  useEffect(() => {
    loadDummyStats();
  }, []);

  const loadDummyStats = async () => {
    try {
      setLoading(true);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Dummy data for prototype
      setStats({
        totalCustomers: 45,
        totalVendors: 12,
        totalProducts: 89,
        totalKaryawan: 23,
        totalInvoices: 156,
        totalPembayaran: 98,
        lowStockProducts: 5,
        pendingInvoices: 8,
        totalRevenue: 125000000,
        totalExpenses: 87500000,
        currentBalance: 37500000,
        todayIncome: 2500000,
        todayExpense: 1800000,
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <DefaultLayout>
      <div className='flex flex-col gap-4 p-4 max-w-7xl mx-auto'>
        {/* Header */}
        <div className='flex flex-col gap-2'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className={title()}>Dasbor</h1>
              <p className='text-default-500'>
                Ringkasan sistem manajemen karyawan
              </p>
              <p className='text-xs text-default-400 mt-1'>
                Terakhir diperbarui:{' '}
                {format(lastUpdated, 'dd MMMM yyyy, HH:mm', {
                  locale: idLocale,
                })}
              </p>
            </div>
            <Button
              color='primary'
              startContent={<Database className='w-4 h-4' />}
              variant='danger'
              onPress={() => alert('Seed Database - Prototype feature')}>
              Seed Database
            </Button>
          </div>
        </div>

        {loading ? (
          <div className='flex justify-center py-8'>
            <Spinner size='lg' />
          </div>
        ) : (
          <>
            {/* Cash Balance Card */}
            <Card className='bg-linear-to-br from-primary to-primary-600'>
              <div className='card__content p-6'>
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='text-white/80 text-sm mb-1'>
                      Saldo Kas Saat Ini
                    </p>
                    <h2 className='text-3xl font-bold text-white'>
                      {formatCurrency(stats.currentBalance)}
                    </h2>
                  </div>
                  <div className='w-12 h-12 rounded-full bg-white/20 flex items-center justify-center'>
                    <Wallet className='w-6 h-6 text-white' />
                  </div>
                </div>

                <div className='flex gap-4 mt-4'>
                  <div className='flex items-center gap-2'>
                    <TrendingUp className='w-4 h-4 text-white/80' />
                    <div>
                      <p className='text-xs text-white/60'>
                        Pemasukan Hari Ini
                      </p>
                      <p className='text-sm font-semibold text-white'>
                        {formatCurrency(stats.todayIncome)}
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <TrendingDown className='w-4 h-4 text-white/80' />
                    <div>
                      <p className='text-xs text-white/60'>
                        Pengeluaran Hari Ini
                      </p>
                      <p className='text-sm font-semibold text-white'>
                        {formatCurrency(stats.todayExpense)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Stats Grid */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              <Card>
                <div className='card__content p-4'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center'>
                      <Users className='w-5 h-5 text-primary' />
                    </div>
                    <div>
                      <p className='text-xs text-default-500'>Karyawan</p>
                      <p className='text-xl font-bold'>{stats.totalKaryawan}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className='card__content p-4'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center'>
                      <Building className='w-5 h-5 text-secondary' />
                    </div>
                    <div>
                      <p className='text-xs text-default-500'>Departemen</p>
                      <p className='text-xl font-bold'>8</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className='card__content p-4'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-full bg-success/10 flex items-center justify-center'>
                      <Package className='w-5 h-5 text-success' />
                    </div>
                    <div>
                      <p className='text-xs text-default-500'>Produk</p>
                      <p className='text-xl font-bold'>{stats.totalProducts}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className='card__content p-4'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center'>
                      <AlertTriangle className='w-5 h-5 text-warning' />
                    </div>
                    <div>
                      <p className='text-xs text-default-500'>Stok Rendah</p>
                      <p className='text-xl font-bold'>
                        {stats.lowStockProducts}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Business Stats Grid */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              <Card>
                <div className='card__content p-4'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center'>
                      <Users className='w-5 h-5 text-blue-500' />
                    </div>
                    <div>
                      <p className='text-xs text-default-500'>Pelanggan</p>
                      <p className='text-xl font-bold'>
                        {stats.totalCustomers}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className='card__content p-4'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center'>
                      <FileText className='w-5 h-5 text-green-500' />
                    </div>
                    <div>
                      <p className='text-xs text-default-500'>Vendor</p>
                      <p className='text-xl font-bold'>{stats.totalVendors}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className='card__content p-4'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center'>
                      <Receipt className='w-5 h-5 text-purple-500' />
                    </div>
                    <div>
                      <p className='text-xs text-default-500'>Invoice</p>
                      <p className='text-xl font-bold'>{stats.totalInvoices}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className='card__content p-4'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center'>
                      <CreditCard className='w-5 h-5 text-orange-500' />
                    </div>
                    <div>
                      <p className='text-xs text-default-500'>Pembayaran</p>
                      <p className='text-xl font-bold'>
                        {stats.totalPembayaran}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Financial Summary */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <Card>
                <div className='card__header'>
                  <h3 className='font-semibold'>Total Pendapatan</h3>
                </div>
                <div className='card__content pt-0'>
                  <p className='text-2xl font-bold text-success'>
                    {formatCurrency(stats.totalRevenue)}
                  </p>
                  <p className='text-sm text-default-500 mt-1'>
                    Total pendapatan bulan ini
                  </p>
                </div>
              </Card>

              <Card>
                <div className='card__header'>
                  <h3 className='font-semibold'>Total Pengeluaran</h3>
                </div>
                <div className='card__content pt-0'>
                  <p className='text-2xl font-bold text-danger'>
                    {formatCurrency(stats.totalExpenses)}
                  </p>
                  <p className='text-sm text-default-500 mt-1'>
                    Total pengeluaran bulan ini
                  </p>
                </div>
              </Card>

              <Card>
                <div className='card__header'>
                  <h3 className='font-semibold'>Faktur Tertunda</h3>
                </div>
                <div className='card__content pt-0'>
                  <p className='text-2xl font-bold text-primary'>
                    {stats.pendingInvoices}
                  </p>
                  <p className='text-sm text-default-500 mt-1'>
                    Faktur menunggu pembayaran
                  </p>
                </div>
              </Card>
            </div>

            {/* Revenue Chart */}
            <Card>
              <div className='card__header'>
                <h3 className='font-semibold'>
                  Grafik Pendapatan & Pengeluaran
                </h3>
              </div>
              <div className='card__content'>
                <ResponsiveContainer width='100%' height={300}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray='3 3' />
                    <XAxis dataKey='month' />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => formatCurrency(value as number)}
                    />
                    <Legend />
                    <Bar
                      dataKey='pendapatan'
                      fill='#10b981'
                      name='Pendapatan'
                    />
                    <Bar
                      dataKey='pengeluaran'
                      fill='#ef4444'
                      name='Pengeluaran'
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* 3D Demo */}
            <Card>
              <div className='card__header'>
                <h3 className='font-semibold'>Demo 3D Interaktif</h3>
              </div>
              <div className='card__content'>
                <ThreeDemo />
                <p className='text-xs text-default-500 mt-3'>
                  Demo React Three Fiber dengan Drei dan Postprocessing. Gunakan
                  mouse untuk merotasi view.
                </p>
              </div>
            </Card>

            {/* Recent Activity Placeholder */}
            <Card>
              <div className='card__header'>
                <h3 className='font-semibold'>Aktivitas Terbaru</h3>
              </div>
              <div className='card__content'>
                <div className='space-y-3'>
                  <div className='flex items-center gap-3 p-3 bg-default-50 rounded-lg'>
                    <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center'>
                      <Users className='w-4 h-4 text-primary' />
                    </div>
                    <div className='flex-1'>
                      <p className='text-sm font-medium'>
                        Karyawan baru ditambahkan
                      </p>
                      <p className='text-xs text-default-500'>
                        Ahmad Surya - IT Department
                      </p>
                    </div>
                    <span className='text-xs text-default-400'>
                      {format(
                        new Date(Date.now() - 2 * 60 * 60 * 1000),
                        'HH:mm',
                      )}
                    </span>
                  </div>

                  <div className='flex items-center gap-3 p-3 bg-default-50 rounded-lg'>
                    <div className='w-8 h-8 rounded-full bg-success/10 flex items-center justify-center'>
                      <Receipt className='w-4 h-4 text-success' />
                    </div>
                    <div className='flex-1'>
                      <p className='text-sm font-medium'>Invoice dibuat</p>
                      <p className='text-xs text-default-500'>
                        INV-2025-001 - PT. Maju Jaya
                      </p>
                    </div>
                    <span className='text-xs text-default-400'>
                      {format(
                        new Date(Date.now() - 4 * 60 * 60 * 1000),
                        'HH:mm',
                      )}
                    </span>
                  </div>

                  <div className='flex items-center gap-3 p-3 bg-default-50 rounded-lg'>
                    <div className='w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center'>
                      <Package className='w-4 h-4 text-warning' />
                    </div>
                    <div className='flex-1'>
                      <p className='text-sm font-medium'>Stok produk rendah</p>
                      <p className='text-xs text-default-500'>
                        Laptop Gaming XYZ - sisa 2 unit
                      </p>
                    </div>
                    <span className='text-xs text-default-400'>
                      {format(
                        new Date(Date.now() - 6 * 60 * 60 * 1000),
                        'HH:mm',
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Alerts */}
            {stats.lowStockProducts > 0 && (
              <Card className='border-warning'>
                <div className='card__content flex items-center gap-3'>
                  <AlertTriangle className='w-5 h-5 text-warning shrink-0' />
                  <div>
                    <p className='font-semibold'>Peringatan Stok Rendah</p>
                    <p className='text-sm text-default-500'>
                      {stats.lowStockProducts} produk stok hampir habis. Periksa
                      inventori.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </DefaultLayout>
  );
};

export default DashboardPage;
