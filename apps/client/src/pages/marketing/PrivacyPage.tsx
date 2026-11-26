import { usePageTitle } from "./usePageTitle";

const COLLECT = [
  {
    label: "Master data",
    value: "Products, SKUs, suppliers, warehouses, storage locations, pallets",
  },
  {
    label: "Transactional data",
    value:
      "Receiving, putaway, picking, dispatch, returns, disposals, losses, WIP, transfers, purchase orders",
  },
  {
    label: "User data",
    value: "Names, email addresses, role assignments, password hashes",
  },
  {
    label: "System data",
    value: "Activity logs, system logs, notification records",
  },
];

const RETENTION = [
  {
    type: "Transaction records",
    period: "7 years",
    why: "Financial compliance (tax, audit)",
  },
  { type: "Activity logs", period: "1 year", why: "Operational visibility" },
  { type: "System logs", period: "90 days", why: "Debugging, performance" },
  {
    type: "User accounts",
    period: "Indefinite",
    why: "Access control baseline",
  },
  { type: "Backup archives", period: "30 days", why: "Disaster recovery" },
];

const ACCESS = [
  "Role-based: access is gated by resource@action permissions",
  "Audit trail: every transaction records who created or modified it and when",
  "Activity logs: user actions are logged with timestamp, IP and action",
];

const SECURITY = [
  "Encryption at rest: the PostgreSQL connection is TLS-enabled; backups are AES-256-GCM encrypted",
  "Encryption in transit: TLS 1.2+ for all HTTP traffic; JWT cookies are HttpOnly and SameSite=Lax",
  "Password hashing: bcrypt (cost factor 12)",
  "Secrets management: JWT_SECRET and other secrets are environment variables, never committed to version control",
];

const RIGHTS = [
  "Request a copy of your personal data",
  "Request correction of inaccurate data",
  "Request deletion of your account (subject to audit trail requirements)",
];

const COMPLIANCE = [
  {
    name: "GDPR",
    detail:
      "Data minimization, retention limits, access controls, audit trails",
  },
  {
    name: "SOX",
    detail: "Separation of duties, immutable audit trail, approval workflows",
  },
  {
    name: "ISO 27001",
    detail: "Access control, encryption, incident response",
  },
];

function PrivacyPage() {
  usePageTitle("Privacy — WMS", {
    description:
      "How the WMS stores and protects business data: what we collect, retention, access, security and your rights.",
  });

  return (
    <div data-ai-context={JSON.stringify({ section: "marketing-privacy" })}>
      <section className="border-b border-border bg-surface py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              Privacy
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Privacy &amp; data protection
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted">
              How the WMS stores and protects the business data entered by
              warehouse operators and managers.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-16 lg:py-20">
        <div className="mx-auto max-w-4xl space-y-12 px-6 lg:px-10">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Data we collect
            </h2>
            <dl className="mt-4 space-y-4">
              {COLLECT.map((row) => (
                <div
                  key={row.label}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <dt className="text-sm font-semibold text-foreground">
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground">
              Data retention
            </h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-secondary text-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Data type</th>
                    <th className="px-4 py-3 font-semibold">Retention</th>
                    <th className="px-4 py-3 font-semibold">Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  {RETENTION.map((row) => (
                    <tr key={row.type} className="border-t border-border">
                      <td className="px-4 py-3 text-foreground">{row.type}</td>
                      <td className="px-4 py-3 text-foreground tabular-nums">
                        {row.period}
                      </td>
                      <td className="px-4 py-3 text-muted">{row.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Retention is configurable under System → Settings → Logging
              (system logs) and System → Settings → Backup (backup archives).
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground">Data access</h2>
            <ul className="mt-4 space-y-2">
              {ACCESS.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-muted"
                >
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground">Data security</h2>
            <ul className="mt-4 space-y-2">
              {SECURITY.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-muted"
                >
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground">Your rights</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              If you are a user in this system, you have the right to:
            </p>
            <ul className="mt-3 space-y-2">
              {RIGHTS.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-muted"
                >
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Contact the system administrator to exercise these rights.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground">Compliance</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              This system is designed to support:
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {COMPLIANCE.map((c) => (
                <div
                  key={c.name}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {c.name}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {c.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground">Contact</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              For privacy questions or data access requests, contact the system
              administrator via the repository&apos;s security contact.
              {/* PLACEHOLDER: owner to set — replace with the real privacy contact email if desired. */}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default PrivacyPage;
