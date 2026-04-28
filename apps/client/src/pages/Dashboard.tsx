import { Card } from '@heroui/react';

const dashboardStats = [
  { label: 'Total Warehouses', tone: 'text-blue-600', value: '0' },
  { label: 'Total Pallets', tone: 'text-green-600', value: '0' },
  { label: 'Pending Approvals', tone: 'text-orange-600', value: '0' },
] as const;

function Dashboard() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Welcome to your warehouse management system
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {dashboardStats.map((stat) => (
          <Card key={stat.label} variant="secondary">
            <Card.Header>
              <Card.Title className="text-sm">{stat.label}</Card.Title>
            </Card.Header>
            <Card.Content>
              <p className={`text-4xl font-bold ${stat.tone}`}>{stat.value}</p>
            </Card.Content>
          </Card>
        ))}
      </div>
    </section>
  );
}

export { Dashboard };
