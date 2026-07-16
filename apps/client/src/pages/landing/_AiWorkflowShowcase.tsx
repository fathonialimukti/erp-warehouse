import { useIntl } from 'react-intl';
import { motion } from 'framer-motion';
import { RobotIcon, SearchIcon, CodeIcon, CheckCircleIcon, BulbIcon, ChartIcon, SendIcon, ArrowLeftIcon } from './_LandingIcons';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

function MockupChrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
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

function RagPipelineMockup() {
  return (
    <MockupChrome title="RAG Knowledge Retrieval">
      <div className="bg-[#0d1117] p-4">
        <div className="mb-3 flex items-center gap-2">
          <SearchIcon className="size-3.5 text-blue-400" />
          <span className="text-xs text-blue-300 font-mono">SELECT * FROM knowledge_chunks WHERE ...</span>
        </div>
        <div className="space-y-2">
          {[
            { file: 'general.md', match: 'ERP overview, SKU types, document lifecycle', pct: '94%' },
            { file: 'approvals.md', match: 'DRAFT → PROPOSED → APPROVED/REJECTED workflow', pct: '89%' },
            { file: 'permissions.md', match: 'Permission format: resource@action', pct: '87%' },
            { file: 'database-schema.md', match: '10 transaction types, pallet tracking', pct: '82%' },
            { file: 'putaway.md', match: 'FIFO strategy, location scoring algorithm', pct: '78%' },
          ].map((chunk, i) => (
            <div key={chunk.file} className="flex items-center gap-2 rounded bg-[#161b22] px-2.5 py-1.5">
              <span className="text-[10px] font-mono text-blue-400">{chunk.file}</span>
              <span className="flex-1 text-[10px] text-gray-400 truncate">{chunk.match}</span>
              <span className="text-[10px] font-mono text-green-400">{chunk.pct}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded bg-[#161b22] px-2.5 py-1.5">
          <span className="text-[10px] font-mono text-purple-400">ts_rank</span>
          <span className="text-[10px] text-gray-500">→</span>
          <span className="text-[10px] text-gray-400">PostgreSQL full-text search (GIN index)</span>
        </div>
      </div>
    </MockupChrome>
  );
}

function SystemPromptMockup() {
  return (
    <MockupChrome title="System Prompt Assembly">
      <div className="bg-[#0d1117] p-4 font-mono text-[10px] leading-relaxed">
        <div className="mb-1 text-blue-400">{'// System Prompt'}</div>
        <div className="text-gray-400">
          <span className="text-purple-400">You are</span> the ERP Warehouse AI Assistant.
        </div>
        <div className="mb-1 text-gray-500">{'// User Context'}</div>
        <div className="text-gray-400">
          <span className="text-green-400">User:</span> Admin (System Admin){' '}
          <span className="text-yellow-400">Permissions:</span> warehouse@*, sku@*, ...
        </div>
        <div className="mb-1 text-gray-500">{'// RAG Context (5 chunks)'}</div>
        <div className="text-gray-400">
          <span className="text-blue-400">[general.md]</span> The ERP manages 10 transaction types...
        </div>
        <div className="text-gray-400">
          <span className="text-blue-400">[approvals.md]</span> Documents flow DRAFT → PROPOSED → APPROVED...
        </div>
        <div className="mb-1 text-gray-500">{'// Tools Available'}</div>
        <div className="flex flex-wrap gap-1">
          {['navigateTo', 'fillFormFields', 'getPageContext', 'queryDatabase', 'get_putaway_state', 'recommend_putaway_location'].map(
            (t) => (
              <span key={t} className="rounded bg-amber-900/30 px-1.5 py-0.5 text-amber-400">
                {t}
              </span>
            ),
          )}
        </div>
      </div>
    </MockupChrome>
  );
}

function ToolCallingMockup() {
  return (
    <MockupChrome title="Agent Tool Calling Loop">
      <div className="bg-[#0d1117] p-4">
        <div className="space-y-3">
          {/* Step 1 */}
          <div className="flex items-start gap-2">
            <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-900/50">
              <span className="text-[9px] font-bold text-blue-400">1</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-blue-400">queryDatabase</span>
                <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-[9px] text-green-400">executed</span>
              </div>
              <div className="mt-0.5 text-[10px] text-gray-500 font-mono">
                {'SELECT sku.name, SUM(quantity) FROM pallets WHERE status = \'AVAILABLE\' GROUP BY sku.name'}
              </div>
            </div>
          </div>
          {/* Step 2 */}
          <div className="flex items-start gap-2">
            <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-900/50">
              <span className="text-[9px] font-bold text-blue-400">2</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-blue-400">navigateTo</span>
                <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-[9px] text-green-400">executed</span>
              </div>
              <div className="mt-0.5 text-[10px] text-gray-500 font-mono">
                {'{ "path": "/warehouse" }'}
              </div>
            </div>
          </div>
          {/* Step 3 */}
          <div className="flex items-start gap-2">
            <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-900/50">
              <span className="text-[9px] font-bold text-blue-400">3</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-blue-400">get_putaway_state</span>
                <span className="rounded bg-yellow-900/30 px-1.5 py-0.5 text-[9px] text-yellow-400">running</span>
              </div>
              <div className="mt-0.5 text-[10px] text-gray-500">
                Fetching approved inbound transactions with unassigned pallets...
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 border-t border-white/8 pt-2 text-[10px] text-gray-500">
          <span className="text-purple-400">stopWhen:</span> stepCountIs(8) — max 8 tool calls per turn
        </div>
      </div>
    </MockupChrome>
  );
}

function AiChatMockup() {
  return (
    <MockupChrome title="AI Assistant — Chat Interface">
      <div className="bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-blue-900">
            <RobotIcon className="size-3.5 text-white" />
          </div>
          <span className="text-xs font-semibold text-gray-700">ERP AI Assistant</span>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-green-600">
            <span className="size-1.5 rounded-full bg-green-500" />
            Online
          </span>
        </div>
        <div className="space-y-3 p-3">
          {/* User message */}
          <div className="flex justify-end">
            <div className="max-w-[75%] rounded-xl rounded-tr-sm bg-blue-900 px-3 py-2 text-[11px] text-white">
              Find overstock items in WH-01 and suggest relocations
            </div>
          </div>
          {/* Tool call chip */}
          <div className="flex justify-center">
            <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[10px]">
              <CheckCircleIcon className="size-3 text-green-600" />
              <span className="text-green-700">queryDatabase</span>
            </div>
          </div>
          {/* AI response */}
          <div className="flex items-start gap-2">
            <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-100">
              <RobotIcon className="size-3 text-blue-900" />
            </div>
            <div className="max-w-[80%] rounded-xl rounded-tl-sm bg-gray-100 px-3 py-2 text-[11px] leading-relaxed text-gray-700">
              Found <strong>12 overstock items</strong> in WH-01. Top 3:
              <br />
              <span className="text-[10px]">
                • CARTON-001: 24 pallets (capacity 16) — 50% over
                <br />
                • DRUM-B03: 18 pallets (capacity 12) — 50% over
                <br />• SACK-C02: 15 pallets (capacity 10) — 50% over
              </span>
              <br />
              <br />
              <strong>Recommendation:</strong> Relocate 8 CARTON-001 pallets to WH-02 Zone A (60% free). Want me to open the 3D layout?
            </div>
          </div>
          {/* Input bar */}
          <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
            <div className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] text-gray-400">
              Ask anything about your warehouse...
            </div>
            <div className="flex size-6 items-center justify-center rounded-lg bg-blue-900">
              <SendIcon className="size-3.5 text-white" />
            </div>
          </div>
        </div>
      </div>
    </MockupChrome>
  );
}

const PIPELINE_STEPS = [
  {
    icon: SearchIcon,
    title: 'RAG Retrieval',
    desc: 'PostgreSQL full-text search retrieves relevant knowledge chunks from 10 markdown files — approval workflows, database schema, navigation, permissions, and more.',
    color: 'bg-blue-50 text-blue-800',
    borderColor: 'border-blue-200',
  },
  {
    icon: CodeIcon,
    title: 'System Prompt',
    desc: 'User context (name, role, permissions) + RAG context + tool definitions are assembled into a structured system prompt sent to the LLM.',
    color: 'bg-purple-50 text-purple-800',
    borderColor: 'border-purple-200',
  },
  {
    icon: ChartIcon,
    title: 'Tool Calling',
    desc: 'The LLM autonomously selects and executes tools: queryDatabase, navigateTo, fillFormFields, getPageContext, and 15+ domain-specific tools for putaway, dispatch, and approvals.',
    color: 'bg-amber-50 text-amber-800',
    borderColor: 'border-amber-200',
  },
  {
    icon: BulbIcon,
    title: 'Natural Language Output',
    desc: 'Responses are rendered with Markdown (tables, lists, code blocks) and tool execution results are shown as inline chips — the assistant feels like a co-pilot, not a search bar.',
    color: 'bg-green-50 text-green-800',
    borderColor: 'border-green-200',
  },
];

export function AiWorkflowShowcase() {
  const intl = useIntl();

  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-16 space-y-3 text-center"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-blue-800">AI & LLM</p>
          <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">Intelligence Built Into the System</h2>
          <p className="mx-auto max-w-2xl text-gray-600">
            Not just a chatbot — a tool-calling agent that reads your database, navigates the UI, fills forms, and manages putaway/dispatch workflows. All powered by a local LLM with RAG knowledge retrieval.
          </p>
        </motion.div>

        {/* Pipeline steps */}
        <div className="mb-16 grid gap-6 md:grid-cols-4">
          {PIPELINE_STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } },
              }}
              className={`rounded-2xl border ${step.borderColor} p-6`}
            >
              <div className={`mb-4 flex size-10 items-center justify-center rounded-xl ${step.color}`}>
                <step.icon className="size-5" />
              </div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">{step.title}</h3>
              <p className="text-xs leading-relaxed text-gray-600">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Visual mockups — 2x2 grid */}
        <div className="grid gap-8 lg:grid-cols-2">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{
              hidden: { opacity: 0, y: 32 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold text-blue-800">Step 1</span>
              <span className="text-xs font-medium text-gray-600">Knowledge Retrieval</span>
            </div>
            <RagPipelineMockup />
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{
              hidden: { opacity: 0, y: 32 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.1 } },
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-semibold text-purple-800">Step 2</span>
              <span className="text-xs font-medium text-gray-600">System Prompt Assembly</span>
            </div>
            <SystemPromptMockup />
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{
              hidden: { opacity: 0, y: 32 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.15 } },
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">Step 3</span>
              <span className="text-xs font-medium text-gray-600">Tool Calling Loop</span>
            </div>
            <ToolCallingMockup />
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{
              hidden: { opacity: 0, y: 32 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.2 } },
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-semibold text-green-800">Step 4</span>
              <span className="text-xs font-medium text-gray-600">Chat Interface</span>
            </div>
            <AiChatMockup />
          </motion.div>
        </div>

        {/* Tech stack callout */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mt-16 rounded-2xl border border-blue-200 bg-blue-50/50 px-8 py-6 text-center"
        >
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-gray-700">
            <span className="font-semibold text-blue-900">Tech Stack:</span>
            {['Vercel AI SDK v6', 'OpenAI-compatible API', 'PostgreSQL FTS (RAG)', 'Server-Sent Events (SSE)', '10 Knowledge Files', '25+ Tools'].map(
              (tech) => (
                <span key={tech} className="rounded-full bg-white border border-blue-200 px-3 py-1 text-xs font-medium text-blue-800">
                  {tech}
                </span>
              ),
            )}
          </div>
          <p className="mt-4 text-xs text-blue-700">
            Runs entirely on a local LLM — no external API calls, no data leaves your infrastructure.
          </p>
        </motion.div>
      </div>
    </section>
  );
}