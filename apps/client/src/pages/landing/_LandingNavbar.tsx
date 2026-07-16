import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useIntl } from 'react-intl';
import { Button } from '@heroui/react';
import { BuildingsIcon, HamburgerIcon, CloseIcon, ChatIcon, PlayIcon } from './_LandingIcons';

const NAV_ITEMS = [
  { labelKey: 'landing.nav.portfolio', id: 'portfolio' },
  { labelKey: 'landing.nav.process', id: 'process' },
  { labelKey: 'landing.nav.services', id: 'services' },
  { labelKey: 'landing.nav.about', id: 'about' },
  { labelKey: 'landing.nav.contact', id: 'contact' },
  { labelKey: 'landing.nav.faq', id: 'faq' },
];

function LandingNavbar() {
  const intl = useIntl();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      const sections = NAV_ITEMS.map((n) => document.getElementById(n.id)).filter(Boolean);
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = sections[i]!;
        if (el.getBoundingClientRect().top <= 120) {
          setActiveSection(NAV_ITEMS[i]!.id);
          return;
        }
      }
      setActiveSection('');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToId = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? 'border-gray-200/50 bg-white/95 shadow-sm backdrop-blur-lg'
          : 'border-gray-200/80 bg-white/90 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 lg:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-900">
            <BuildingsIcon className="size-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">
            {intl.formatMessage({ id: 'landing.nav.logo_alt', defaultMessage: 'FAM Studio' })}
          </span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToId(item.id)}
              className={`text-sm font-medium transition-colors ${
                activeSection === item.id ? 'text-blue-900' : 'text-gray-600 hover:text-blue-900'
              }`}
            >
              {intl.formatMessage({ id: item.labelKey, defaultMessage: item.id })}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button
            variant="secondary"
            className="border-blue-200 text-blue-800 hover:bg-blue-50"
            onPress={() => scrollToId('contact')}
          >
            <ChatIcon className="size-4" />
            {intl.formatMessage({ id: 'landing.nav.hire_me', defaultMessage: "Let's Talk" })}
          </Button>
          <Button variant="primary" onPress={() => navigate('/login')}>
            <PlayIcon className="size-4" />
            {intl.formatMessage({ id: 'landing.nav.try_demo', defaultMessage: 'Try the Demo' })}
          </Button>
        </div>

        {/* Mobile menu button */}
        <button
          className="flex size-9 items-center justify-center rounded-lg border border-gray-200 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <CloseIcon className="size-5 text-gray-700" /> : <HamburgerIcon className="size-5 text-gray-700" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToId(item.id)}
                className="text-left text-sm font-medium text-gray-700 transition-colors hover:text-blue-900"
              >
                {intl.formatMessage({ id: item.labelKey, defaultMessage: item.id })}
              </button>
            ))}
            <Button variant="secondary" className="mt-1 w-full border-blue-200 text-blue-800" onPress={() => scrollToId('contact')}>
              <ChatIcon className="size-4" />
              {intl.formatMessage({ id: 'landing.nav.hire_me', defaultMessage: "Let's Talk" })}
            </Button>
            <Button variant="primary" className="mt-1 w-full" onPress={() => navigate('/login')}>
              <PlayIcon className="size-4" />
              {intl.formatMessage({ id: 'landing.nav.try_demo', defaultMessage: 'Try the Demo' })}
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}

export { LandingNavbar };
