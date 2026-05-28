import { useIntl } from 'react-intl';
import { useNavigate, useSearchParams } from 'react-router';
import { Button, Card, Tabs } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useAtomValue } from 'jotai';
import { hasPermissionAtom } from '../../lib/atoms';
import { ShipmentTable } from './shipment/_ShipmentTable';
import { WipIssueTable } from './wip-issue/_WipIssueTable';
import { ReturnToSupplierTable } from './return-to-supplier/_ReturnToSupplierTable';
import { DisposalTable } from './disposal/_DisposalTable';
import { LossTransactionTable } from './loss/_LossTransactionTable';

const TAB_SHIPMENT = 'shipment';
const TAB_WIP = 'wip-issue';
const TAB_RTS = 'return-to-supplier';
const TAB_DISPOSAL = 'disposal';
const TAB_LOSS = 'loss';

function OutboundTransactionIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasPermission = useAtomValue(hasPermissionAtom);

  const activeTab = searchParams.get('tab') ?? TAB_SHIPMENT;

  const canShipment = hasPermission('shipment@read');
  const canWip = hasPermission('wip-issue@read');
  const canRts = hasPermission('return-to-supplier@read');
  const canDisposal = hasPermission('disposal@read');
  const canLoss = hasPermission('loss@read');

  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  const createHref = () => {
    switch (activeTab) {
      case TAB_WIP: return '/outbound-transaction/wip-issue/new';
      case TAB_RTS: return '/outbound-transaction/return-to-supplier/new';
      case TAB_DISPOSAL: return '/outbound-transaction/disposal/new';
      case TAB_LOSS: return '/outbound-transaction/loss/new';
      default: return '/outbound-transaction/shipment/new';
    }
  };

  const canCreate = () => {
    switch (activeTab) {
      case TAB_WIP: return hasPermission('wip-issue@create');
      case TAB_RTS: return hasPermission('return-to-supplier@create');
      case TAB_DISPOSAL: return hasPermission('disposal@create');
      case TAB_LOSS: return hasPermission('loss@create');
      default: return hasPermission('shipment@create');
    }
  };

  return (
    <div
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: 'outbound-transaction-list',
        activeTab,
        visibleTabs: [
          { key: TAB_SHIPMENT, label: 'Shipment', visible: canShipment },
          { key: TAB_WIP, label: 'WIP Issue', visible: canWip },
          { key: TAB_RTS, label: 'Return to Supplier', visible: canRts },
          { key: TAB_DISPOSAL, label: 'Disposal', visible: canDisposal },
          { key: TAB_LOSS, label: 'Loss', visible: canLoss },
        ].filter((tab) => tab.visible).map(({ key, label }) => ({ key, label })),
        canCreate: canCreate(),
      })}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {intl.formatMessage({ id: 'outbound_transaction_index.title', defaultMessage: 'Outbound Transactions' })}
          </h1>
          <p className="text-sm text-muted">
            {intl.formatMessage({ id: 'outbound_transaction_index.description', defaultMessage: 'Manage all outbound transactions by type.' })}
          </p>
        </div>
        {canCreate() && (
          <Button onPress={() => navigate(createHref())}>
            <Icon icon="solar:add-circle-linear" className="size-4" />
            {intl.formatMessage({ id: 'outbound_transaction_index.create', defaultMessage: 'Create' })}
          </Button>
        )}
      </div>

      <Card>
        <Card.Content>
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => handleTabChange(String(key))}
          >
            <Tabs.List aria-label={intl.formatMessage({ id: 'outbound_transaction_index.tabs_aria', defaultMessage: 'Outbound transaction types' })}>
              {canShipment && (
                <Tabs.Tab id={TAB_SHIPMENT}>
                  {intl.formatMessage({ id: 'outbound_transaction_index.tab_shipment', defaultMessage: 'Shipment' })}
                  <Tabs.Indicator />
                </Tabs.Tab>
              )}
              {canWip && (
                <Tabs.Tab id={TAB_WIP}>
                  {intl.formatMessage({ id: 'outbound_transaction_index.tab_wip_issue', defaultMessage: 'WIP Issue' })}
                  <Tabs.Indicator />
                </Tabs.Tab>
              )}
              {canRts && (
                <Tabs.Tab id={TAB_RTS}>
                  {intl.formatMessage({ id: 'outbound_transaction_index.tab_return_to_supplier', defaultMessage: 'Return to Supplier' })}
                  <Tabs.Indicator />
                </Tabs.Tab>
              )}
              {canDisposal && (
                <Tabs.Tab id={TAB_DISPOSAL}>
                  {intl.formatMessage({ id: 'outbound_transaction_index.tab_disposal', defaultMessage: 'Disposal' })}
                  <Tabs.Indicator />
                </Tabs.Tab>
              )}
              {canLoss && (
                <Tabs.Tab id={TAB_LOSS}>
                  {intl.formatMessage({ id: 'outbound_transaction_index.tab_loss', defaultMessage: 'Loss' })}
                  <Tabs.Indicator />
                </Tabs.Tab>
              )}
            </Tabs.List>

            {canShipment && (
              <Tabs.Panel id={TAB_SHIPMENT}>
                <ShipmentTable />
              </Tabs.Panel>
            )}
            {canWip && (
              <Tabs.Panel id={TAB_WIP}>
                <WipIssueTable />
              </Tabs.Panel>
            )}
            {canRts && (
              <Tabs.Panel id={TAB_RTS}>
                <ReturnToSupplierTable />
              </Tabs.Panel>
            )}
            {canDisposal && (
              <Tabs.Panel id={TAB_DISPOSAL}>
                <DisposalTable />
              </Tabs.Panel>
            )}
            {canLoss && (
              <Tabs.Panel id={TAB_LOSS}>
                <LossTransactionTable />
              </Tabs.Panel>
            )}
          </Tabs>
        </Card.Content>
      </Card>
    </div>
  );
}

export { OutboundTransactionIndexPage };
