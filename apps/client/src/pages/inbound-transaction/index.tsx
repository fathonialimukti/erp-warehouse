import { useMemo } from "react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { useSearchParams } from "react-router";
import { Card, Tabs } from "@heroui/react";
import { useAtomValue } from "jotai";
import { hasPermissionAtom } from "../../lib/atoms";
import {
  FoundTypeIcon,
  InboundHeroIcon,
  ReceivingTypeIcon,
  RmaReceiptTypeIcon,
  WipCompletionTypeIcon,
} from "../../assets/IconRegistry";
import { ReceivingTransactionTable } from "./receiving/_ReceivingTransactionTable";
import { WipCompletionTable } from "./wip-completion/_WipCompletionTable";
import { RmaReceiptTable } from "./rma-receipt/_RmaReceiptTable";
import { FoundTransactionTable } from "./found/_FoundTransactionTable";
import { PageTitle } from "../../components/PageTitle";

const TAB_RECEIVING = "receiving";
const TAB_WIP = "wip-completion";
const TAB_RMA = "rma-receipt";
const TAB_FOUND = "found";

interface TabConfig {
  key: string;
  labelKey: string;
  labelFallback: string;
  icon: ReactNode;
  perm: string;
}

const TABS: TabConfig[] = [
  {
    key: TAB_RECEIVING,
    labelKey: "inbound_transaction_index.tab_receiving",
    labelFallback: "Receiving",
    icon: <ReceivingTypeIcon size={20} />,
    perm: "receiving@read",
  },
  {
    key: TAB_WIP,
    labelKey: "inbound_transaction_index.tab_wip_completion",
    labelFallback: "WIP Completion",
    icon: <WipCompletionTypeIcon size={20} />,
    perm: "wip-completion@read",
  },
  {
    key: TAB_RMA,
    labelKey: "inbound_transaction_index.tab_rma_receipt",
    labelFallback: "RMA Receipt",
    icon: <RmaReceiptTypeIcon size={20} />,
    perm: "rma-receipt@read",
  },
  {
    key: TAB_FOUND,
    labelKey: "inbound_transaction_index.tab_found",
    labelFallback: "Found",
    icon: <FoundTypeIcon size={20} />,
    perm: "found@read",
  },
];

function InboundTransactionIndexPage() {
  const intl = useIntl();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasPermission = useAtomValue(hasPermissionAtom);

  const activeTab = searchParams.get("tab") ?? TAB_RECEIVING;
  const visibleTabs = useMemo(
    () => TABS.filter((tab) => hasPermission(tab.perm)),
    [hasPermission],
  );

  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  return (
    <div
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: "inbound-transaction-list",
        activeTab,
        visibleTabs: visibleTabs.map(({ key, labelFallback }) => ({
          key,
          label: labelFallback,
        })),
      })}
    >
      {/* ── Hero header ──────────────────────────────────────────────────── */}
      <Card className="overflow-hidden rounded-3xl border border-border/70 bg-[linear-gradient(160deg,rgba(8,145,178,0.10)_0%,rgba(56,189,248,0.05)_30%,rgba(255,255,255,0.98)_65%)] shadow-[0_20px_50px_rgba(3,105,161,0.12)] dark:bg-[linear-gradient(160deg,rgba(8,145,178,0.22)_0%,rgba(56,189,248,0.09)_30%,rgba(39,39,42,0.96)_65%)]">
        <Card.Content className="flex items-center gap-4 p-5 lg:p-7">
          <InboundHeroIcon size={48} />
          <div>
            <PageTitle
              title={intl.formatMessage({
                id: "inbound_transaction_index.title",
                defaultMessage: "Inbound Transactions",
              })}
            />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {intl.formatMessage({
                id: "inbound_transaction_index.title",
                defaultMessage: "Inbound Transactions",
              })}
            </h1>
            <p className="text-sm text-muted">
              {intl.formatMessage({
                id: "inbound_transaction_index.description",
                defaultMessage: "Manage all inbound transactions by type.",
              })}
            </p>
          </div>
        </Card.Content>
      </Card>

      {/* ── Type tabs + table ────────────────────────────────────────────── */}
      <Card>
        <Card.Content>
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => handleTabChange(String(key))}
          >
            <Tabs.ListContainer>
              <Tabs.List
                aria-label={intl.formatMessage({
                  id: "inbound_transaction_index.tabs_aria",
                  defaultMessage: "Inbound transaction types",
                })}
              >
                {visibleTabs.map((tab) => (
                  <Tabs.Tab key={tab.key} id={tab.key}>
                    <span className="inline-flex items-center gap-2">
                      {tab.icon}
                      {intl.formatMessage({
                        id: tab.labelKey,
                        defaultMessage: tab.labelFallback,
                      })}
                    </span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>

            {visibleTabs.map((tab) => (
              <Tabs.Panel key={tab.key} id={tab.key}>
                {tab.key === TAB_RECEIVING && <ReceivingTransactionTable />}
                {tab.key === TAB_WIP && <WipCompletionTable />}
                {tab.key === TAB_RMA && <RmaReceiptTable />}
                {tab.key === TAB_FOUND && <FoundTransactionTable />}
              </Tabs.Panel>
            ))}
          </Tabs>
        </Card.Content>
      </Card>
    </div>
  );
}

export { InboundTransactionIndexPage };
