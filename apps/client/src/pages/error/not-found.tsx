import { Button } from '@heroui/react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900'>
      <div className='text-center'>
        <h1 className='text-9xl font-bold text-gray-300 dark:text-gray-600'>
          404
        </h1>
        <h2 className='text-3xl font-semibold text-gray-700 dark:text-gray-300 mb-4'>
          Page Not Found
        </h2>
        <p className='text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto'>
          Sorry, the page you are looking for doesn't exist or has been moved.
        </p>
        <Button as={Link} color='primary' size='lg' to='/dashboard'>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default NotFoundPage;
