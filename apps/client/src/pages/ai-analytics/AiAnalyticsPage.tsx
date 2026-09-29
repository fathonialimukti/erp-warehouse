import { useState } from "react";
import { useIntl } from "react-intl";
import {
  Button,
  Card,
  CardContent,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  TextArea,
} from "@heroui/react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { trpcClient } from "../../lib/trpc";
import { PageTitle } from "../../components/PageTitle";

type SuggestResult = {
  sql: string | null;
  chartType: "LINE" | "BAR" | "TABLE";
  table: unknown[];
  yKey?: string;
  xKey?: string;
  summary: string;
};

type QueryResult =
  | {
      columns: string[];
      rows: Array<Record<string, unknown>>;
      rowCount: number;
      truncated: boolean;
    }
  | { error: string };

type Phase = "idle" | "loading" | "done" | "error";

export function AiAnalyticsPage() {
  const intl = useIntl();
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestResult | null>(null);
  const [query, setQuery] = useState<QueryResult | null>(null);

  const analyze = async () => {
    const trimmed = question.trim();
    if (!trimmed || phase === "loading") return;

    setPhase("loading");
    setError(null);
    setSuggestion(null);
    setQuery(null);

    try {
      const suggested = await trpcClient.aiAnalytics.suggestQuery.query({
        question: trimmed,
      });
      if (!suggested.sql) {
        setError(
          intl.formatMessage({
            id: "aiAnalytics.error_ai_unavailable",
            defaultMessage:
              "AI is unavailable right now. Please try again later.",
          }),
        );
        setPhase("error");
        return;
      }

      const result = await trpcClient.aiAnalytics.executeQuery.query({
        sql: suggested.sql,
      });
      setSuggestion({
        ...suggested,
        chartType: suggested.chartType as SuggestResult["chartType"],
      });
      setQuery(result);
      setPhase("done");
    } catch {
      setError(
        intl.formatMessage({
          id: "aiAnalytics.error_ai_unavailable",
          defaultMessage:
            "AI is unavailable right now. Please try again later.",
        }),
      );
      setPhase("error");
    }
  };

  const chartType = suggestion?.chartType ?? "TABLE";
  const rows = query && "rows" in query ? query.rows : [];
  const columns = query && "columns" in query ? query.columns : [];
  const rowCount = query && "rowCount" in query ? query.rowCount : 0;
  const truncated = query && "truncated" in query ? query.truncated : false;
  const xKey = suggestion?.xKey ?? columns[0] ?? "";
  const yKey =
    suggestion?.yKey ?? columns.find((c) => c !== xKey) ?? columns[0] ?? "";
  const numericY = rows.every((r) => typeof r[yKey] === "number");

  const showChart =
    phase === "done" &&
    suggestion &&
    query &&
    "rows" in query &&
    (chartType === "LINE" || chartType === "BAR") &&
    numericY &&
    rows.length > 0;

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({ section: "ai-analytics" })}
    >
      <div>
        <PageTitle
          title={intl.formatMessage({
            id: "aiAnalytics.page_title",
            defaultMessage: "AI Analytics",
          })}
        />
        <h1 className="text-xl font-bold">
          {intl.formatMessage({
            id: "aiAnalytics.page_title",
            defaultMessage: "AI Analytics",
          })}
        </h1>
        <p className="text-sm text-muted">
          {intl.formatMessage({
            id: "aiAnalytics.page_subtitle",
            defaultMessage:
              "Ask a business question and the AI turns it into a chart.",
          })}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <TextArea
            aria-label={intl.formatMessage({
              id: "aiAnalytics.question_placeholder",
              defaultMessage: "e.g. monthly outbound volume by warehouse",
            })}
            placeholder={intl.formatMessage({
              id: "aiAnalytics.question_placeholder",
              defaultMessage: "e.g. monthly outbound volume by warehouse",
            })}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onPress={analyze}
              isDisabled={phase === "loading" || !question.trim()}
            >
              {phase === "loading" ? (
                <>
                  <Spinner size="sm" color="current" />{" "}
                  {intl.formatMessage({
                    id: "aiAnalytics.loading",
                    defaultMessage: "Analyzing...",
                  })}
                </>
              ) : (
                intl.formatMessage({
                  id: "aiAnalytics.analyze",
                  defaultMessage: "Analyze",
                })
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {phase === "error" && (
        <Card>
          <CardContent className="p-4 text-danger">{error}</CardContent>
        </Card>
      )}

      {phase === "done" && suggestion && query && (
        <Card>
          <CardContent className="space-y-4 p-4">
            {suggestion.summary && (
              <p className="text-sm text-foreground">{suggestion.summary}</p>
            )}

            {showChart && (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "LINE" ? (
                    <LineChart
                      data={rows}
                      margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(128,128,128,0.25)"
                      />
                      <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey={yKey}
                        stroke="#0B5FFA"
                        strokeWidth={2}
                      />
                    </LineChart>
                  ) : (
                    <BarChart
                      data={rows}
                      margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(128,128,128,0.25)"
                      />
                      <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey={yKey}
                        fill="#0B5FFA"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            {!showChart && columns.length > 0 && (
              <Table
                aria-label="AI Analytics result"
                className="max-h-80 overflow-auto"
              >
                <TableHeader>
                  {columns.map((col) => (
                    <TableColumn
                      key={col}
                      className="text-xs uppercase tracking-wide"
                    >
                      {col}
                    </TableColumn>
                  ))}
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      {columns.map((col) => (
                        <TableCell key={col} className="text-xs">
                          {String(row[col] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {rows.length === 0 && (
              <p className="text-sm text-muted">
                {intl.formatMessage({
                  id: "aiAnalytics.empty",
                  defaultMessage: "No results",
                })}
              </p>
            )}

            <div className="text-xs text-muted">
              {intl.formatMessage({
                id: "aiAnalytics.rows",
                defaultMessage: "Rows",
              })}
              : {rowCount}
              {truncated ? " (truncated)" : ""}
            </div>

            <details className="rounded bg-black/5 p-2">
              <summary className="cursor-pointer text-xs font-medium">
                {intl.formatMessage({
                  id: "aiAnalytics.sql_label",
                  defaultMessage: "SQL",
                })}
              </summary>
              <pre className="mt-2 overflow-x-auto text-[11px] font-mono whitespace-pre">
                {suggestion.sql}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export default AiAnalyticsPage;
