import { useNavigate } from 'react-router';
import { Button, Card } from '@heroui/react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Card variant="secondary">
      <Card.Header>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">404</p>
          <Card.Title>Page Not Found</Card.Title>
          <Card.Description>
            The page you are trying to access does not exist or has been moved.
          </Card.Description>
        </div>
      </Card.Header>
      <Card.Footer>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onPress={() => navigate(-1)}>
            Go Back
          </Button>
          <Button onPress={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </Card.Footer>
    </Card>
  );
}
