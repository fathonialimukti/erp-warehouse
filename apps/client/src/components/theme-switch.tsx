import { FC, useState, useEffect } from 'react';
import { Switch } from '@heroui/react';
import clsx from 'clsx';

import { SunFilledIcon, MoonFilledIcon } from '@/components/icons';
import { useAppStore } from '@/store/app-store';

export interface ThemeSwitchProps {
  className?: string;
}

export const ThemeSwitch: FC<ThemeSwitchProps> = ({ className }) => {
  const [isMounted, setIsMounted] = useState(false);
  const { theme, setTheme } = useAppStore();

  useEffect(() => {
    setIsMounted(true);
    // Apply initial theme
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Prevent Hydration Mismatch
  if (!isMounted) return <div className='w-6 h-6' />;

  const handleThemeChange = (isSelected: boolean) => {
    const newTheme = isSelected ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <Switch
      isSelected={theme === 'light'}
      onChange={handleThemeChange}
      aria-label={
        theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
      }
      className={clsx('transition-opacity hover:opacity-80', className)}
      size='lg'>
      {({ isSelected }) =>
        isSelected ? <SunFilledIcon size={20} /> : <MoonFilledIcon size={20} />
      }
    </Switch>
  );
};
