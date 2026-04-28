import {
  isRouteErrorResponse,
  useNavigate,
  useRouteError,
} from 'react-router';
import { Button, Card } from '@heroui/react';

function getErrorDetail(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return {
      title: `${error.status} ${error.statusText}`,
      detail: typeof error.data === 'string' ? error.data : JSON.stringify(error.data, null, 2),
    };
  }

  if (error instanceof Error) {
    return {
      title: 'Unexpected Error',
      detail: error.message,
      stack: error.stack,
    };
  }

  return {
    title: 'Unknown Error',
    detail: 'An unknown error occurred while loading this page.',
  };
}

function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { title, detail, stack } = getErrorDetail(error) as {
    title: string;
    detail: string;
    stack?: string;
  };

  return (
    <Card variant="secondary">
      <Card.Header>
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">Route Error</p>
            <Card.Title>{title}</Card.Title>
          </div>
          <Card.Description>{detail}</Card.Description>
        </div>
      </Card.Header>

      {stack ? (
        <Card.Content>
          <pre className="max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            {stack}
          </pre>
        </Card.Content>
      ) : null}

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

export { RouteErrorPage };
