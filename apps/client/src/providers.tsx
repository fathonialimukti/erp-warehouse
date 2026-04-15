import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { IntlProvider } from 'react-intl';
import { useLocale } from './lib/useLocale';
import { getLocaleMessages } from './lib/i18n';

type IntlProviderCompatProps = Omit<React.ComponentProps<typeof IntlProvider>, 'children'> & {
  children?: React.ReactNode;
};

const IntlProviderCompat = IntlProvider as unknown as React.ComponentType<IntlProviderCompatProps>;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      refetchOnMount: 'always',
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
  },
});

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const { locale } = useLocale();
  const messages = getLocaleMessages(locale);

  return (
    <QueryClientProvider client={queryClient}>
      <IntlProviderCompat locale={locale} messages={messages} defaultLocale="en">
        {children}
      </IntlProviderCompat>
    </QueryClientProvider>
  );
}
