import {
  isRouteErrorResponse,
  useNavigate,
  useRouteError,
} from 'react-router';

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

export default function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { title, detail, stack } = getErrorDetail(error) as {
    title: string;
    detail: string;
    stack?: string;
  };

  return (
    <div className="rounded-xl border border-red-200 bg-white p-6 dark:border-red-900 dark:bg-gray-900">
      <p className="text-sm font-semibold text-red-600 dark:text-red-400">Route Error</p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
      <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{detail}</p>

      {stack ? (
        <pre className="mt-4 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
          {stack}
        </pre>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Go Back
        </button>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
