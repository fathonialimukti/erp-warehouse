import { useMemo } from "react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { useSearchParams } from "react-router";
import { Card, Tabs } from "@heroui/react";
import { useAtomValue } from "jotai";
import { hasPermissionAtom } from "../../lib/atoms";
import {
  DisposalTypeIcon,
  LossTypeIcon,
  OutboundHeroIcon,
  ReturnToSupplierTypeIcon,
  ShipmentTypeIcon,
  WipIssueTypeIcon,
} from "../../assets/IconRegistry";
import { ShipmentTable } from "./shipment/_ShipmentTable";
import { WipIssueTable } from "./wip-issue/_WipIssueTable";
import { ReturnToSupplierTable } from "./return-to-supplier/_ReturnToSupplierTable";
import { DisposalTable } from "./disposal/_DisposalTable";
import { LossTransactionTable } from "./loss/_LossTransactionTable";
import { PageTitle } from "../../components/PageTitle";

const TAB_SHIPMENT = "shipment";
const TAB_WIP = "wip-issue";
const TAB_RTS = "return-to-supplier";
const TAB_DISPOSAL = "disposal";
const TAB_LOSS = "loss";

interface TabConfig {
  key: string;
  labelKey: string;
  labelFallback: string;
  icon: ReactNode;
  perm: string;
}

const TABS: TabConfig[] = [
  {
    key: TAB_SHIPMENT,
    labelKey: "outbound_transaction_index.tab_shipment",
    labelFallback: "Shipment",
    icon: <ShipmentTypeIcon size={20} />,
    perm: "shipment@read",
  },
  {
    key: TAB_WIP,
    labelKey: "outbound_transaction_index.tab_wip_issue",
    labelFallback: "WIP Issue",
    icon: <WipIssueTypeIcon size={20} />,
    perm: "wip-issue@read",
  },
  {
    key: TAB_RTS,
    labelKey: "outbound_transaction_index.tab_return_to_supplier",
    labelFallback: "Return to Supplier",
    icon: <ReturnToSupplierTypeIcon size={20} />,
    perm: "return-to-supplier@read",
  },
  {
    key: TAB_DISPOSAL,
    labelKey: "outbound_transaction_index.tab_disposal",
    labelFallback: "Disposal",
    icon: <DisposalTypeIcon size={20} />,
    perm: "disposal@read",
  },
  {
    key: TAB_LOSS,
    labelKey: "outbound_transaction_index.tab_loss",
    labelFallback: "Loss",
    icon: <LossTypeIcon size={20} />,
    perm: "loss@read",
  },
];

function OutboundTransactionIndexPage() {
  const intl = useIntl();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasPermission = useAtomValue(hasPermissionAtom);

  const activeTab = searchParams.get("tab") ?? TAB_SHIPMENT;
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
        section: "outbound-transaction-list",
        activeTab,
        visibleTabs: visibleTabs.map(({ key, labelFallback }) => ({
          key,
          label: labelFallback,
        })),
      })}
    >
      {/* ── Hero header ──────────────────────────────────────────────────── */}
      <Card className="overflow-hidden rounded-3xl border border-border/70 bg-[linear-gradient(160deg,rgba(234,88,12,0.10)_0%,rgba(251,146,60,0.05)_30%,rgba(255,255,255,0.98)_65%)] shadow-[0_20px_50px_rgba(194,65,12,0.12)] dark:bg-[linear-gradient(160deg,rgba(234,88,12,0.22)_0%,rgba(251,146,60,0.09)_30%,rgba(39,39,42,0.96)_65%)]">
        <Card.Content className="flex items-center gap-4 p-5 lg:p-7">
          <OutboundHeroIcon size={48} />
          <div>
            <PageTitle
              title={intl.formatMessage({
                id: "outbound_transaction_index.title",
                defaultMessage: "Outbound Transactions",
              })}
            />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {intl.formatMessage({
                id: "outbound_transaction_index.title",
                defaultMessage: "Outbound Transactions",
              })}
            </h1>
            <p className="text-sm text-muted">
              {intl.formatMessage({
                id: "outbound_transaction_index.description",
                defaultMessage: "Manage all outbound transactions by type.",
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
                  id: "outbound_transaction_index.tabs_aria",
                  defaultMessage: "Outbound transaction types",
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
                {tab.key === TAB_SHIPMENT && <ShipmentTable />}
                {tab.key === TAB_WIP && <WipIssueTable />}
                {tab.key === TAB_RTS && <ReturnToSupplierTable />}
                {tab.key === TAB_DISPOSAL && <DisposalTable />}
                {tab.key === TAB_LOSS && <LossTransactionTable />}
              </Tabs.Panel>
            ))}
          </Tabs>
        </Card.Content>
      </Card>
    </div>
  );
}

export { OutboundTransactionIndexPage };
