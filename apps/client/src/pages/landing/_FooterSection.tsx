import { useNavigate } from 'react-router';
import { useIntl } from 'react-intl';
import appLogoUrl from '../../assets/erp-warehouse-appimage.webp?url';

export function FooterSection() {
  const intl = useIntl();
  const navigate = useNavigate();

  return (
    <footer className="border-t border-gray-200 bg-white py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 sm:flex-row lg:px-10">
        <div className="flex items-center gap-2">
          <img src={appLogoUrl} alt="WMS" className="size-6 rounded-md object-contain" />
          <span className="font-semibold text-gray-700">
            {intl.formatMessage({ id: 'landing.nav.logo_alt', defaultMessage: 'WMS' })}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          {intl.formatMessage({ id: 'landing.footer.copyright', defaultMessage: '© 2025 Fathoni Ali Mukti · All rights reserved.' })}
        </p>
        <button
          onClick={() => navigate('/login')}
          className="text-sm font-medium text-blue-800 transition hover:text-blue-900"
        >
          {intl.formatMessage({ id: 'landing.footer.try_demo', defaultMessage: 'Try the Demo →' })}
        </button>
      </div>
    </footer>
  );
}