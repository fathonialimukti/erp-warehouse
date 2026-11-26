import { Card } from "@heroui/react";
import {
  BoxIcon,
  ChartIcon,
  ChecklistIcon,
  CubeIcon,
  DocumentIcon,
  RobotIcon,
} from "../landing/_LandingIcons";
import { usePageTitle } from "./usePageTitle";

const CAPABILITIES = [
  {
    icon: DocumentIcon,
    color: "bg-accent/10 text-accent",
    title: "Inbound, outbound and WIP",
    body: "Record receiving, putaway, picking, shipment, RMA receipts, returns, disposals, losses, WIP issue and completion, sub-inventory transfers, stock counts and purchase orders.",
  },
  {
    icon: BoxIcon,
    color: "bg-success/10 text-success",
    title: "Stock at SKU and pallet level",
    body: "Track balances and movements at SKU and pallet granularity across warehouses and storage locations, kept current as transactions happen.",
  },
  {
    icon: CubeIcon,
    color: "bg-accent/10 text-accent",
    title: "Live 3D warehouse view",
    body: "A React Three Fiber layout visualizer shows pallet positioning in real time so teams get spatial understanding of what is where.",
  },
  {
    icon: ChecklistIcon,
    color: "bg-warning/10 text-warning",
    title: "Built-in approvals",
    body: "Every transaction type flows Draft → Proposed → Approved / Rejected, with approval history tracked per entity so you can see who signed off and when.",
  },
  {
    icon: RobotIcon,
    color: "bg-accent/10 text-accent",
    title: "Integrated AI assistant",
    body: "WMS AI retrieves knowledge-base content, navigates pages and fills forms on command, so users focus on exceptions rather than data entry.",
  },
  {
    icon: ChartIcon,
    color: "bg-success/10 text-success",
    title: "Reports and visibility",
    body: "Monthly stock movement, inventory aging, dispatch queues, inventory balance snapshots and SKU-level detail — plus a permissioned activity log for audit.",
  },
];

const DETAILS = [
  {
    title: "Desktop and web from one codebase",
    body: "The same React client ships as a Tauri desktop app for warehouse floors and as a web app for remote managers — one codebase, so features ship everywhere.",
  },
  {
    title: "Permissions on every route and action",
    body: "Access is gated by resource@action permission pairs, and a role / permission matrix drives what each user can see and do. Segregation of duties can be configured through roles and approval rules.",
  },
  {
    title: "English and Indonesian",
    body: "The interface ships with English and Indonesian locales via react-intl.",
  },
  {
    title: "Import and export",
    body: "XLSX import and export, plus QR code generation for pallets and labels.",
  },
  {
    title: "Notifications",
    body: "A real-time notification stream keeps operators and managers in the loop as work moves through the warehouse.",
  },
  {
    title: "Database and platform",
    body: "PostgreSQL via Prisma, an Express + tRPC server with end-to-end typesafe procedures, and Zod-validated schemas shared across the stack.",
  },
];

function FeaturesPage() {
  usePageTitle("Features — WMS", {
    description:
      "Explore what ships in the WMS: inbound, outbound and WIP transactions, SKU and pallet tracking, a live 3D warehouse view, approvals, reports and an AI assistant.",
  });

  return (
    <div data-ai-context={JSON.stringify({ section: "marketing-features" })}>
      <section className="border-b border-border bg-surface py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            Features
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
            Everything a warehouse team runs on, in one system.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            A full-stack warehouse management system built around how warehouse
            staff, managers and department heads actually work. Below is what
            ships today — grounded in the product itself.
          </p>
        </div>
      </section>

      <section className="bg-background py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((cap) => (
              <Card key={cap.title} className="border border-border shadow-sm">
                <Card.Header>
                  <div
                    className={`mb-3 flex size-12 items-center justify-center rounded-xl ${cap.color}`}
                  >
                    <cap.icon className="size-6" />
                  </div>
                  <Card.Title className="text-base font-semibold text-foreground">
                    {cap.title}
                  </Card.Title>
                </Card.Header>
                <Card.Content>
                  <p className="text-sm leading-relaxed text-muted">
                    {cap.body}
                  </p>
                </Card.Content>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="mb-10 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              Under the hood
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
              Built as one product, not a patchwork.
            </h2>
          </div>
          <dl className="grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
            {DETAILS.map((item) => (
              <div key={item.title}>
                <dt className="text-sm font-semibold text-foreground">
                  {item.title}
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted">
                  {item.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}

export default FeaturesPage;
