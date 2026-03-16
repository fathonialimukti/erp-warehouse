import { Card } from '@heroui/react';

export default function Dashboard() {
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Welcome to your warehouse management system
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-white dark:bg-gray-900 p-6">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
            Total Warehouses
          </p>
          <p className="mt-4 text-4xl font-bold text-blue-600">0</p>
        </Card>

        <Card className="bg-white dark:bg-gray-900 p-6">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
            Total Pallets
          </p>
          <p className="mt-4 text-4xl font-bold text-green-600">0</p>
        </Card>

        <Card className="bg-white dark:bg-gray-900 p-6">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
            Pending Approvals
          </p>
          <p className="mt-4 text-4xl font-bold text-orange-600">0</p>
        </Card>
      </div>
    </>
  );
}
