import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useIntl } from 'react-intl';
import { Button } from '@heroui/react';
import { HamburgerIcon, CloseIcon, PlayIcon } from './_LandingIcons';
import appLogoUrl from '../../assets/logo.svg?url';

const NAV_ITEMS = [
  { labelKey: 'landing.nav.features', id: 'features' },
  { labelKey: 'landing.nav.ai', id: 'ai' },
  { labelKey: 'landing.nav.trust', id: 'tech-stack' },
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
          ? 'border-border bg-surface/95 shadow-sm backdrop-blur-lg'
          : 'border-border/80 bg-surface/90 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 lg:px-10">
        <div className="flex items-center gap-2.5">
          <img src={appLogoUrl} alt="WMS" className="size-8" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            {intl.formatMessage({ id: 'landing.nav.logo_alt', defaultMessage: 'WMS' })}
          </span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToId(item.id)}
              className={`text-sm font-medium transition-colors ${
                activeSection === item.id ? 'text-accent' : 'text-muted hover:text-accent'
              }`}
            >
              {intl.formatMessage({ id: item.labelKey, defaultMessage: item.id })}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="primary" onPress={() => navigate('/login')}>
            <PlayIcon className="size-4" />
            {intl.formatMessage({ id: 'landing.nav.try_demo', defaultMessage: 'Try the Demo' })}
          </Button>
        </div>

        {/* Mobile menu button */}
        <button
          className="flex size-9 items-center justify-center rounded-lg border border-border md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <CloseIcon className="size-5 text-muted" /> : <HamburgerIcon className="size-5 text-muted" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border bg-surface px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToId(item.id)}
                className="text-left text-sm font-medium text-muted transition-colors hover:text-accent"
              >
                {intl.formatMessage({ id: item.labelKey, defaultMessage: item.id })}
              </button>
            ))}
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
