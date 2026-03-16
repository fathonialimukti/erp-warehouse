import { Outlet } from 'react-router';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
        <Outlet />
      </main>
    </div>
  );
}
