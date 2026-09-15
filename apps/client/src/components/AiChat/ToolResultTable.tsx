type ToolResultTableProps = {
  rows: Record<string, unknown>[];
  maxRows?: number;
};

/** Compact bordered table for tool output rows (matches chat markdown table style). */
export const ToolResultTable = ({ rows, maxRows = 8 }: ToolResultTableProps) => {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0] ?? {}).slice(0, 6);
  const shown = rows.slice(0, maxRows);
  return (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-[12px] border-collapse">
        <thead>
          <tr className="bg-black/5">
            {columns.map((c) => (
              <th key={c} className="border border-black/10 px-2 py-1 text-left font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c} className="border border-black/10 px-2 py-1">{String(row[c] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <p className="text-xs text-default-500 mt-1">+{rows.length - shown.length} more rows</p>
      )}
    </div>
  );
};
