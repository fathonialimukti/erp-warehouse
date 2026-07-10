import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const SHELF_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1'];

function getShelfCellColor(row: number, col: number): string {
  if ((row * 7 + col) % 4 === 0) return 'rgba(255,255,255,0.06)';
  return SHELF_COLORS[(row * 3 + col) % SHELF_COLORS.length] as string;
}

function MockupChrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-md">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-100 px-3 py-2">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-yellow-400" />
          <span className="size-2.5 rounded-full bg-green-400" />
        </div>
        <span className="flex-1 text-center text-xs text-gray-500">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Warehouse3DMockup() {
  return (
    <MockupChrome title="Warehouse 3D Layout — WH-01">
      <div className="relative bg-[#0d1117]">
        <div className="flex items-center gap-2 border-b border-white/8 bg-[#161b22] px-3 py-2">
          <Icon icon="solar:arrow-left-linear" className="size-3.5 text-white/50" />
          <span className="text-xs text-white/70">WH-01 Warehouse</span>
          <div className="ml-auto flex gap-1.5">
            <span className="rounded bg-blue-600/20 px-2 py-0.5 text-[10px] text-blue-400">Putaway</span>
            <span className="rounded bg-purple-600/20 px-2 py-0.5 text-[10px] text-purple-400">Dispatch</span>
          </div>
        </div>
        <div className="relative h-40 overflow-hidden px-3 py-3">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(37,99,235,0.12),_transparent_70%)]" />
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="mb-1.5 flex gap-1">
              {Array.from({ length: 18 }).map((_, col) => (
                <div
                  key={col}
                  className="h-4 flex-1 rounded-sm"
                  style={{ backgroundColor: getShelfCellColor(row, col) }}
                />
              ))}
            </div>
          ))}
          <div className="absolute top-10 right-8 rounded-lg border border-white/10 bg-[#1e293b]/90 px-2.5 py-1.5 text-[10px] text-white/80 backdrop-blur-sm">
            <div className="font-medium text-blue-300">PLT-0042</div>
            <div>SKU: CARTON-001</div>
            <div className="text-white/50">Zone A-03</div>
          </div>
        </div>
      </div>
    </MockupChrome>
  );
}

function AiChatMockup() {
  return (
    <MockupChrome title="AI Assistant">
      <div className="bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-blue-900">
            <Icon icon="solar:robot-bold" className="size-3.5 text-white" />
          </div>
          <span className="text-xs font-semibold text-gray-700">ERP AI Assistant</span>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-green-600">
            <span className="size-1.5 rounded-full bg-green-500" />
            Online
          </span>
        </div>
        <div className="space-y-2.5 p-3">
          <div className="flex justify-end">
            <div className="max-w-[72%] rounded-xl rounded-tr-sm bg-blue-900 px-3 py-2 text-[11px] text-white">
              Show overstock items in Zone A
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-100">
              <Icon icon="solar:robot-bold" className="size-3 text-blue-900" />
            </div>
            <div className="max-w-[80%] rounded-xl rounded-tl-sm bg-gray-100 px-3 py-2 text-[11px] leading-relaxed text-gray-700">
              Found <strong>12 overstock items</strong> in Zone A. Top SKU: CARTON-001 (×24 pallets, capacity 16). Suggest relocating 8 pallets to WH-02.
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-2">
            <div className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] text-gray-400">
              Ask anything about your warehouse...
            </div>
            <div className="flex size-6 items-center justify-center rounded-lg bg-blue-900">
              <Icon icon="solar:plain-bold" className="size-3.5 text-white" />
            </div>
          </div>
        </div>
      </div>
    </MockupChrome>
  );
}

const DASHBOARD_STATS = [
  { label: 'Total SKUs', value: '1,842', icon: 'solar:box-bold', color: 'text-blue-800', bg: 'bg-blue-50' },
  { label: 'Pallets In', value: '347', icon: 'solar:archive-bold', color: 'text-green-700', bg: 'bg-green-50' },
  { label: 'Pending', value: '24', icon: 'solar:clock-bold', color: 'text-amber-700', bg: 'bg-amber-50' },
  { label: "Today's Out", value: '18', icon: 'solar:delivery-bold', color: 'text-purple-700', bg: 'bg-purple-50' },
];

const CHART_VALUES = [28, 42, 35, 55, 48, 62, 39];
const CHART_MAX = 62;

function DashboardMockup() {
  return (
    <MockupChrome title="Dashboard">
      <div className="bg-gray-50 p-3">
        <p className="mb-2 text-[11px] font-semibold text-gray-700">Operational Overview</p>
        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {DASHBOARD_STATS.map((s) => (
            <div key={s.label} className="rounded-lg bg-white p-2 text-center shadow-sm">
              <div className={`mx-auto mb-1 flex size-6 items-center justify-center rounded-md ${s.bg}`}>
                <Icon icon={s.icon} className={`size-3.5 ${s.color}`} />
              </div>
              <div className="text-sm font-bold text-gray-900">{s.value}</div>
              <div className="text-[9px] text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-white p-2.5 shadow-sm">
          <p className="mb-2 text-[10px] text-gray-500">Weekly Inbound Transactions</p>
          <div className="flex items-end gap-1" style={{ height: 40 }}>
            {CHART_VALUES.map((h, i) => (
              <div key={i} className="flex flex-1 flex-col justify-end">
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${Math.round((h / CHART_MAX) * 40)}px`,
                    backgroundColor: '#1e3a8a',
                    opacity: 0.5 + (i / CHART_VALUES.length) * 0.5,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[9px] text-gray-400">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        </div>
      </div>
    </MockupChrome>
  );
}

const TABLE_ROWS = [
  { ref: 'RCV-2025-001', type: 'Receiving', sku: 'CARTON-A01', qty: 40, status: 'APPROVED' },
  { ref: 'RCV-2025-002', type: 'Receiving', sku: 'DRUM-B03', qty: 12, status: 'PROPOSED' },
  { ref: 'FND-2025-001', type: 'Found', sku: 'SACK-C02', qty: 8, status: 'DRAFT' },
];

const STATUS_STYLE: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-700',
  PROPOSED: 'bg-amber-100 text-amber-700',
  DRAFT: 'bg-gray-100 text-gray-600',
};

function TransactionMockup() {
  return (
    <MockupChrome title="Inbound Transactions">
      <div className="bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
          <div className="flex h-6 flex-1 items-center rounded-md border border-gray-200 bg-gray-50 px-2 text-[10px] text-gray-400">
            <Icon icon="solar:magnifer-linear" className="mr-1 size-2.5" />
            Search transactions...
          </div>
          <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">+ New</span>
        </div>
        <div className="grid grid-cols-5 border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          <span>Ref</span>
          <span>Type</span>
          <span>SKU</span>
          <span>Qty</span>
          <span>Status</span>
        </div>
        {TABLE_ROWS.map((row) => (
          <div
            key={row.ref}
            className="grid grid-cols-5 items-center border-b border-gray-50 px-3 py-2 text-[10px] text-gray-700 last:border-0"
          >
            <span className="font-medium text-blue-800">{row.ref}</span>
            <span>{row.type}</span>
            <span>{row.sku}</span>
            <span>{row.qty}</span>
            <span
              className={`inline-block w-fit rounded-full px-2 py-0.5 text-[9px] font-medium ${STATUS_STYLE[row.status]}`}
            >
              {row.status}
            </span>
          </div>
        ))}
      </div>
    </MockupChrome>
  );
}

const PORTFOLIO_ITEMS = [
  {
    title: '3D Warehouse Layout',
    description:
      'Navigate the warehouse in 3D, click pallets to inspect, and manage putaway/dispatch directly in the scene.',
    mockup: <Warehouse3DMockup />,
    tag: '3D',
    tagColor: 'bg-blue-100 text-blue-800',
  },
  {
    title: 'AI Chat Assistant',
    description:
      'Ask questions in plain English. The AI agent understands your warehouse context and suggests actions.',
    mockup: <AiChatMockup />,
    tag: 'AI',
    tagColor: 'bg-purple-100 text-purple-800',
  },
  {
    title: 'Dashboard Overview',
    description: 'Real-time KPIs, inventory stats, and weekly transaction charts at a glance.',
    mockup: <DashboardMockup />,
    tag: 'Full-Stack',
    tagColor: 'bg-green-100 text-green-800',
  },
  {
    title: 'Transaction Management',
    description:
      'Full inbound/outbound workflow with approval stages, status tracking, and role-based access control.',
    mockup: <TransactionMockup />,
    tag: 'ERP',
    tagColor: 'bg-amber-100 text-amber-800',
  },
];

function GallerySection() {
  return (
    <section id="portfolio" className="bg-gray-50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-16 space-y-3 text-center"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-blue-800">Portfolio</p>
          <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">What I Build</h2>
          <p className="mx-auto max-w-2xl text-gray-600">
            A showcase of enterprise systems that combine 3D interfaces, AI agents, and complex business logic.
          </p>
        </motion.div>

        <div className="grid gap-12 lg:grid-cols-2">
          {PORTFOLIO_ITEMS.map((item, i) => (
            <motion.div
              key={item.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, y: 32 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: (i % 2) * 0.15 } },
              }}
              className="group space-y-5"
            >
              <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow duration-300 group-hover:shadow-lg">
                {item.mockup}
                <div className="absolute top-4 right-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.tagColor}`}>
                    {item.tag}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-gray-900">{item.title}</h3>
                <p className="leading-relaxed text-gray-600">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { GallerySection };
