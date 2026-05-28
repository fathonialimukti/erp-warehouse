import { useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { useAtomValue, useSetAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { AiAssistant } from '../components/AiAssistant/AiAssistant';
import { sidebarOpenAtom } from '../lib/atoms';
import { useNotificationStream } from '../lib/useNotificationStream';
import { requestPushPermission, setupTauriNotifications } from '../lib/push-notification';
import { trpcClient } from '../lib/trpc';

function PrivateLayout() {
  const sidebarOpen = useAtomValue(sidebarOpenAtom);
  const setSidebarOpen = useSetAtom(sidebarOpenAtom);
  const navigate = useNavigate();
  const cleanupRef = useRef<(() => void) | undefined>(undefined);
  const queryClient = useQueryClient();

  useNotificationStream();

  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: ['warehouseListForFilter'],
      queryFn: () => trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 200 }),
      staleTime: 5 * 60 * 1000,
    });
    void queryClient.prefetchQuery({
      queryKey: ['skuListForFilter'],
      queryFn: () => trpcClient.sku.list.query({ page: 1, limit: 500 }),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  useEffect(() => {
    void requestPushPermission();
    void setupTauriNotifications((url) => navigate(url)).then((cleanup) => {
      cleanupRef.current = cleanup;
    });
    return () => {
      cleanupRef.current?.();
    };
  }, []);

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
      <AiAssistant />
    </div>
  );
}

export { PrivateLayout };
