import { Outlet } from 'react-router';
import { useAtomValue, useSetAtom } from 'jotai';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { sidebarOpenAtom } from '../lib/atoms';

function PrivateLayout() {
  const sidebarOpen = useAtomValue(sidebarOpenAtom);
  const setSidebarOpen = useSetAtom(sidebarOpenAtom);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Navbar />
      <div className="relative mt-2 flex min-h-0 flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
        <main className="h-full min-w-0 flex-1 overflow-y-auto transition-all duration-300 ease-in-out p-4 md:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export { PrivateLayout };
