import { useNavigate } from 'react-router';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">404</p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">Page Not Found</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        The page you are trying to access does not exist or has been moved.
      </p>

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
