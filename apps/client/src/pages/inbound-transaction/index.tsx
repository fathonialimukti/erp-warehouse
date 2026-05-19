import { useIntl } from 'react-intl';
import { useNavigate, useSearchParams } from 'react-router';
import { Button, Card, Tabs } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useAtomValue } from 'jotai';
import { hasPermissionAtom } from '../../lib/atoms';
import { ReceivingTransactionTable } from './receiving/_ReceivingTransactionTable';
import { WipCompletionTable } from './wip-completion/_WipCompletionTable';
import { RmaReceiptTable } from './rma-receipt/_RmaReceiptTable';
import { FoundTransactionTable } from './found/_FoundTransactionTable';

const TAB_RECEIVING = 'receiving';
const TAB_WIP = 'wip-completion';
const TAB_RMA = 'rma-receipt';
const TAB_FOUND = 'found';

function InboundTransactionIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasPermission = useAtomValue(hasPermissionAtom);

  const activeTab = searchParams.get('tab') ?? TAB_RECEIVING;

  const canReceiving = hasPermission('receiving@read');
  const canWip = hasPermission('wip-completion@read');
  const canRma = hasPermission('rma-receipt@read');
  const canFound = hasPermission('found@read');

  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  const createHref = () => {
    switch (activeTab) {
      case TAB_WIP: return '/inbound-transaction/wip-completion/new';
      case TAB_RMA: return '/inbound-transaction/rma-receipt/new';
      case TAB_FOUND: return '/inbound-transaction/found/new';
      default: return '/inbound-transaction/receiving/new';
    }
  };

  const canCreate = () => {
    switch (activeTab) {
      case TAB_WIP: return hasPermission('wip-completion@create');
      case TAB_RMA: return hasPermission('rma-receipt@create');
      case TAB_FOUND: return hasPermission('found@create');
      default: return hasPermission('receiving@create');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {intl.formatMessage({ id: 'inbound_transaction_index.title', defaultMessage: 'Inbound Transactions' })}
          </h1>
          <p className="text-sm text-muted">
            {intl.formatMessage({ id: 'inbound_transaction_index.description', defaultMessage: 'Manage all inbound transactions by type.' })}
          </p>
        </div>
        {canCreate() && (
          <Button onPress={() => navigate(createHref())}>
            <Icon icon="solar:add-circle-linear" className="size-4" />
            {intl.formatMessage({ id: 'inbound_transaction_index.create', defaultMessage: 'Create' })}
          </Button>
        )}
      </div>

      <Card>
        <Card.Content>
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => handleTabChange(String(key))}
          >
            <Tabs.List aria-label={intl.formatMessage({ id: 'inbound_transaction_index.tabs_aria', defaultMessage: 'Inbound transaction types' })}>
              {canReceiving && (
                <Tabs.Tab id={TAB_RECEIVING}>
                  {intl.formatMessage({ id: 'inbound_transaction_index.tab_receiving', defaultMessage: 'Receiving' })}
                  <Tabs.Indicator />
                </Tabs.Tab>
              )}
              {canWip && (
                <Tabs.Tab id={TAB_WIP}>
                  {intl.formatMessage({ id: 'inbound_transaction_index.tab_wip_completion', defaultMessage: 'WIP Completion' })}
                  <Tabs.Indicator />
                </Tabs.Tab>
              )}
              {canRma && (
                <Tabs.Tab id={TAB_RMA}>
                  {intl.formatMessage({ id: 'inbound_transaction_index.tab_rma_receipt', defaultMessage: 'RMA Receipt' })}
                  <Tabs.Indicator />
                </Tabs.Tab>
              )}
              {canFound && (
                <Tabs.Tab id={TAB_FOUND}>
                  {intl.formatMessage({ id: 'inbound_transaction_index.tab_found', defaultMessage: 'Found' })}
                  <Tabs.Indicator />
                </Tabs.Tab>
              )}
            </Tabs.List>

            {canReceiving && (
              <Tabs.Panel id={TAB_RECEIVING}>
                <ReceivingTransactionTable />
              </Tabs.Panel>
            )}
            {canWip && (
              <Tabs.Panel id={TAB_WIP}>
                <WipCompletionTable />
              </Tabs.Panel>
            )}
            {canRma && (
              <Tabs.Panel id={TAB_RMA}>
                <RmaReceiptTable />
              </Tabs.Panel>
            )}
            {canFound && (
              <Tabs.Panel id={TAB_FOUND}>
                <FoundTransactionTable />
              </Tabs.Panel>
            )}
          </Tabs>
        </Card.Content>
      </Card>
    </div>
  );
}

export { InboundTransactionIndexPage };
