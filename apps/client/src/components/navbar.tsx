import { Modal, Avatar } from '@heroui/react';
import { Menu, LogOut, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

import { navigationItems } from '@/config/navigation';
import { siteConfig } from '@/config/site';
import { ThemeSwitch } from '@/components/theme-switch';
import { Logo } from '@/components/icons';
import { useAuth } from '@/contexts/auth-context';

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      setIsMenuOpen(false);
      navigate('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <>
      <nav className='sticky top-0 z-40 border-b border-divider/50 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60'>
        <div className='flex h-16 max-w-full items-center justify-between px-4'>
          <a
            className='flex items-center gap-2 font-bold text-inherit no-underline'
            href='/'>
            <Logo />
            <span className='hidden sm:inline'>{siteConfig.name}</span>
          </a>

          <div className='flex items-center gap-4'>
            <ThemeSwitch />
            <Modal isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <button
                aria-label='Open menu'
                className='lg:hidden px-3 py-2 rounded-lg hover:bg-default-100 transition-colors'>
                <Menu className='w-6 h-6' />
              </button>
              <Modal.Backdrop>
                <Modal.Container>
                  <Modal.Dialog>
                    <Modal.CloseTrigger />
                    <Modal.Header>
                      <div className='flex items-center gap-2'>
                        <Logo />
                        <p className='font-bold text-lg'>{siteConfig.name}</p>
                      </div>
                    </Modal.Header>
                    <Modal.Body>
                      <div className='flex flex-col gap-2'>
                        {navigationItems.map((item, index) => {
                          const IconComponent = item.icon;
                          const isActive = location.pathname === item.href;

                          return (
                            <a
                              key={`${item.label}-${index}`}
                              className={`w-full py-2 px-3 rounded-lg flex items-center gap-3 transition-colors ${
                                isActive
                                  ? 'bg-primary-50 dark:bg-primary-100/10'
                                  : 'hover:bg-default-100'
                              }`}
                              href={item.href}
                              onClick={() => setIsMenuOpen(false)}>
                              <IconComponent className='w-5 h-5' />
                              <span className={isActive ? 'font-semibold' : ''}>
                                {item.label}
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    </Modal.Body>

                    <Modal.Footer className='border-t border-divider/50'>
                      <div className='w-full'>
                        <button className='w-full text-left flex items-center gap-3 p-2 rounded-xl transition-all hover:bg-default-100 dark:hover:bg-default-50'>
                          <Avatar
                            name={user?.name?.[0]?.toUpperCase() || 'G'}
                            className='bg-primary text-primary-foreground'
                          />
                          <div className='flex flex-col flex-1'>
                            <p className='text-left font-semibold'>
                              {user?.name || 'Guest User'}
                            </p>
                            <p className='text-left text-sm text-default-500'>
                              {user?.email || 'guest@example.com'}
                            </p>
                          </div>
                        </button>
                        <button className='w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-default-100 transition-colors mt-2'>
                          <Settings size={18} />
                          Settings
                        </button>
                        <button
                          onClick={handleLogout}
                          className='w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-danger/10 text-danger transition-colors'>
                          <LogOut size={18} />
                          Log Out
                        </button>
                      </div>
                    </Modal.Footer>
                  </Modal.Dialog>
                </Modal.Container>
              </Modal.Backdrop>
            </Modal>
          </div>
        </div>
      </nav>
    </>
  );
};
