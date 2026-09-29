import { useMemo } from "react";
import { useIntl } from "react-intl";
import { Card } from "@heroui/react";

interface KpiStripProps {
  rows: { signedQty: string | number }[];
  total: number;
}

interface KpiCardProps {
  label: string;
  value: string;
  valueColor?: "success" | "danger" | "default";
}

function KpiCard({ label, value, valueColor = "default" }: KpiCardProps) {
  return (
    <Card>
      <Card.Content>
        <span className="text-xs font-medium text-muted">{label}</span>
        <span
          className={`font-mono text-xl font-semibold ${
            valueColor === "success"
              ? "text-success"
              : valueColor === "danger"
                ? "text-danger"
                : "text-foreground"
          }`}
        >
          {value}
        </span>
      </Card.Content>
    </Card>
  );
}

export function KpiStrip({ rows, total }: KpiStripProps) {
  const intl = useIntl();

  const { totalIn, totalOut } = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    for (const r of rows) {
      const v = Number(r.signedQty);
      if (v > 0) totalIn += v;
      else if (v < 0) totalOut += v;
    }
    return { totalIn, totalOut };
  }, [rows]);

  const net = totalIn + totalOut;
  const fmt = (n: number) => n.toLocaleString();

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label={intl.formatMessage({
          id: "stock_movement.kpi_total_in",
          defaultMessage: "Total IN",
        })}
        value={`+${fmt(totalIn)}`}
        valueColor="success"
      />
      <KpiCard
        label={intl.formatMessage({
          id: "stock_movement.kpi_total_out",
          defaultMessage: "Total OUT",
        })}
        value={fmt(totalOut)}
        valueColor="danger"
      />
      <KpiCard
        label={intl.formatMessage({
          id: "stock_movement.kpi_net_flow",
          defaultMessage: "Net Flow",
        })}
        value={`${net > 0 ? "+" : ""}${fmt(net)}`}
      />
      <KpiCard
        label={intl.formatMessage({
          id: "stock_movement.kpi_records",
          defaultMessage: "Records",
        })}
        value={fmt(total)}
      />
    </div>
  );
}
