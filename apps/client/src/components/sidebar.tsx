import { Card, Link, Button, Separator } from '@heroui/react';
import clsx from 'clsx';
import {
  LayoutDashboard,
  LogOut,
  Settings,
  User as UserIcon,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { navigationItems } from '@/config/navigation';
import { useAuth } from '@/contexts/auth-context';

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <Card className='w-64 flex-col sticky top-26 h-[calc(100vh-8rem)] shadow-lg dark:shadow-gray-900 border-0 bg-background/95 backdrop-blur-md hidden lg:block'>
      <div className='card__header px-6 py-4 border-b border-divider/50 bg-linear-to-r from-secondary/5 to-danger/5 shrink-0'>
        <div className='flex items-center gap-3'>
          <div className='w-8 h-8 rounded-lg bg-primary flex items-center justify-center'>
            <LayoutDashboard className='w-4 h-4 text-primary-foreground' />
          </div>
          <h2 className='text-lg font-semibold text-foreground'>
            Menu Navigasi
          </h2>
        </div>
      </div>

      <div className='card__content p-4 overflow-y-auto flex-1'>
        <div className='space-y-2'>
          {navigationItems.map((item, index) => {
            const IconComponent = item.icon;
            const isActive = location.pathname === item.href;

            return (
              <Button
                key={index}
                as={Link}
                className={clsx(
                  'w-full justify-start gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium',
                  'hover:scale-[1.02] hover:shadow-md active:scale-[0.98]',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
                    : 'text-foreground/80 hover:bg-default-100 dark:hover:bg-default-50 hover:text-foreground',
                )}
                href={item.href}
                size='sm'
                variant={isActive ? 'primary' : 'ghost'}>
                <IconComponent className='shrink-0' size={20} />
                <span className='truncate text-left'>{item.label}</span>
                {isActive && (
                  <div className='ml-auto w-2 h-2 rounded-full bg-primary-foreground/80' />
                )}
              </Button>
            );
          })}
        </div>
      </div>
      <div className='absolute bottom-0 w-full'>
        <Separator />
        <div className='card__footer p-4 mt-auto shrink-0'>
          <button className='w-full text-left flex items-center gap-3 p-2 rounded-xl transition-all hover:bg-default-100 dark:hover:bg-default-50'>
            <div className='w-9 h-9 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0'>
              {user?.name?.[0]?.toUpperCase() || 'G'}
            </div>
            <div className='flex flex-col flex-1'>
              <p className='text-left font-semibold'>
                {user?.name || 'Guest User'}
              </p>
              <p className='text-left text-sm text-default-500'>
                {user?.email || 'guest@example.com'}
              </p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className='w-full mt-2 px-4 py-2 text-left rounded-lg hover:bg-danger/10 text-danger transition-colors flex items-center gap-2'>
            <LogOut size={18} />
            Log Out
          </button>
        </div>
      </div>
    </Card>
  );
};
