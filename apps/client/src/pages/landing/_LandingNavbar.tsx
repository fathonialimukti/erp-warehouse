import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';

const NAV_LINKS = [
  { label: 'Portfolio', id: 'portfolio' },
  { label: 'Process', id: 'process' },
  { label: 'Services', id: 'services' },
  { label: 'About', id: 'about' },
  { label: 'Contact', id: 'contact' },
];

function LandingNavbar() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 lg:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-900">
            <Icon icon="solar:buildings-3-bold" className="size-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">FAM Studio</span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-blue-900"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button variant="primary" onPress={() => navigate('/login')}>
            <Icon icon="solar:play-bold" className="size-4" />
            Try the Demo
          </Button>
        </div>

        {/* Mobile menu button */}
        <button
          className="flex size-9 items-center justify-center rounded-lg border border-gray-200 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Icon icon={mobileOpen ? 'solar:close-line-bold' : 'solar:hamburger-menu-linear'} className="size-5 text-gray-700" />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {NAV_LINKS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-gray-700 transition-colors hover:text-blue-900"
              >
                {item.label}
              </a>
            ))}
            <Button variant="primary" className="mt-2 w-full" onPress={() => navigate('/login')}>
              <Icon icon="solar:play-bold" className="size-4" />
              Try the Demo
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}

export { LandingNavbar };
