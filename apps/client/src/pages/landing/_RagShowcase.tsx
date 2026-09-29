import { useState, useEffect, useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Spinner } from "@heroui/react";

// ─── Types ───
import {
  DocumentIcon,
  SearchIcon,
  CodeIcon,
  DatabaseIcon,
  ArrowRightIcon,
  RobotIcon,
} from "./_LandingIcons";

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const RAG_DIAGRAM = `flowchart TB
    %% ═══════════ LEFT: WRITE PATH ═══════════
    subgraph Left["✍️ WRITE PATH — Ingest into pgvector"]
        direction TB
        W1["1. Fill form<br/>title + content + source"]
        W2["2. Click Save<br/>tRPC knowledgeBase.create"]
        W3["3. Prisma insert row<br/>embedding = NULL"]
        W4["4. raw SQL: status = pending"]
        W5["5. Fire-and-forget embed<br/>response returns immediately<br/>(UI polls status every 2s)"]
        W6["6. AI SDK embed()<br/>buildEmbedText → provider"]
        W7["7. Provider returns<br/>1536-dim vector"]
        W8["8. raw SQL UPDATE<br/>embedding = '[0.0023,...]'::vector"]
        W9["9. raw SQL: status = done ✅"]

        W1 --> W2 --> W3 --> W4 --> W5 --> W6 --> W7 --> W8 --> W9
    end

    %% ═══════════ RIGHT: READ PATH ═══════════
    subgraph Right["🔍 READ PATH — AI Agent Retrieval"]
        direction TB
        R1["1. User asks:<br/>'How does approval work?'"]
        R2["2. routes/ai.ts<br/>retrieveRelevantChunks(query)"]
        R3["3. Embed the QUESTION<br/>same AI provider"]
        R4["4. Cosine search<br/>1 - (embedding <=> $q) > 0.5<br/>ORDER BY distance LIMIT 5"]
        R5["5. Merge with FTS hits<br/>+ format as markdown<br/>### title (source: approvals)"]
        R6["6. Inject into system prompt<br/>## Relevant Documentation"]
        R7["7. streamText() answers<br/>cites title + source"]
        R8["8. Fallback if docs thin:<br/>searchKnowledge tool<br/>(server-executed)"]

        R1 --> R2 --> R3 --> R4 --> R5 --> R6 --> R7
        R8 -.->|"extra context"| R7
    end

    %% ═══════════ SHARED STORE (middle-bottom) ═══════════
    Store["🗄️ Postgres — pgvector<br/>knowledge_chunks<br/>embedding vector(1536) + embedding_status<br/>HNSW cosine index + FTS GIN index"]

    W8 --> Store
    W9 --> Store
    Store --> R4

    classDef write fill:#22c55e,stroke:#14532d,stroke-width:2px,color:#ffffff
    classDef read fill:#3b82f6,stroke:#1e3a8a,stroke-width:2px,color:#ffffff
    classDef store fill:#f59e0b,stroke:#78350f,stroke-width:2px,color:#000000

    class W1,W2,W3,W4,W5,W6,W7,W8,W9 write
    class R1,R2,R3,R4,R5,R6,R7,R8 read
    class Store store`;

function MermaidDiagram({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    // mermaid is ~1.5 MB — fetch and initialize it only once this diagram is
    // actually on screen (the modal is closed by default), never on landing load.
    void (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({ startOnLoad: false, theme: "neutral" });
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled) setSvg(svg);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  const handleZoomIn = useCallback(
    () => setZoom((z) => Math.min(z + 0.25, 3)),
    [],
  );
  const handleZoomOut = useCallback(
    () => setZoom((z) => Math.max(z - 0.25, 0.5)),
    [],
  );
  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(Math.max(z + delta, 0.5), 3));
    }
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        setPanning(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
    },
    [position],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (panning) {
        setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      }
    },
    [panning, dragStart],
  );

  const handleMouseUp = useCallback(() => setPanning(false), []);

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-danger">
        Failed to render diagram.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Zoom controls */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-border bg-surface/90 p-1 shadow-sm backdrop-blur-sm">
        <button
          onClick={handleZoomOut}
          className="flex size-7 items-center justify-center rounded text-muted transition hover:bg-default hover:text-foreground"
          title="Zoom out"
        >
          <svg
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.3-4.3M8 11h6" />
          </svg>
        </button>
        <span className="min-w-[3rem] text-center text-xs font-medium tabular-nums text-muted">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="flex size-7 items-center justify-center rounded text-muted transition hover:bg-default hover:text-foreground"
          title="Zoom in"
        >
          <svg
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
          </svg>
        </button>
        <div className="mx-0.5 h-4 w-px bg-border" />
        <button
          onClick={handleZoomReset}
          className="flex size-7 items-center justify-center rounded text-muted transition hover:bg-default hover:text-foreground"
          title="Reset zoom"
        >
          <svg
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      </div>

      {/* Diagram viewport */}
      <div
        ref={containerRef}
        className="mermaid-container overflow-auto"
        style={{ cursor: panning ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {!svg ? (
          <div className="flex min-h-64 items-center justify-center p-8">
            <Spinner size="lg" />
          </div>
        ) : null}
        <div
          className="origin-top-left p-4 transition-transform duration-150"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}

export function RagShowcase() {
  const intl = useIntl();
  const [diagramOpen, setDiagramOpen] = useState(false);

  const openDiagram = useCallback(() => setDiagramOpen(true), []);
  const closeDiagram = useCallback(() => setDiagramOpen(false), []);

  return (
    <section
      id="ai-rag"
      className="relative overflow-hidden bg-surface-secondary py-20 lg:py-28"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-16 text-center"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            {intl.formatMessage({
              id: "landing.rag.badge",
              defaultMessage: "Knowledge From Your Documents",
            })}
          </p>
          <h2 className="mt-2 text-3xl font-bold text-foreground lg:text-4xl">
            {intl.formatMessage({
              id: "landing.rag.title",
              defaultMessage: "Ask Your Docs, Get Answers",
            })}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted">
            {intl.formatMessage({
              id: "landing.rag.subtitle",
              defaultMessage:
                "Add your work instructions and policies. The AI reads them and answers your team's questions using your own rules — not guesses.",
            })}
          </p>
        </motion.div>

        {/* ─── How it works ─── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-12"
        >
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Ingestion */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
              }}
              className="rounded-2xl border border-success/30 bg-success/10 p-6"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-success/15">
                <DocumentIcon className="size-5 text-success" />
              </div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {intl.formatMessage({
                  id: "landing.rag.step_ingest_title",
                  defaultMessage: "Add Your Documents",
                })}
              </h3>
              <p className="text-xs leading-relaxed text-muted">
                {intl.formatMessage({
                  id: "landing.rag.step_ingest_desc",
                  defaultMessage:
                    "Paste or upload your work instructions and policies — the system breaks them into small pieces it can search.",
                })}
              </p>
            </motion.div>

            {/* Retrieval */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, delay: 0.1 },
                },
              }}
              className="rounded-2xl border border-accent/25 bg-accent/10 p-6"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-accent/15">
                <SearchIcon className="size-5 text-accent" />
              </div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {intl.formatMessage({
                  id: "landing.rag.step_retrieval_title",
                  defaultMessage: "It Finds the Right Part",
                })}
              </h3>
              <p className="text-xs leading-relaxed text-muted">
                {intl.formatMessage({
                  id: "landing.rag.step_retrieval_desc",
                  defaultMessage:
                    "When someone asks, the system finds the exact paragraphs that answer it — by meaning, not just matching words.",
                })}
              </p>
            </motion.div>

            {/* Context */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, delay: 0.2 },
                },
              }}
              className="rounded-2xl border border-warning/30 bg-warning/10 p-6"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-warning/15">
                <CodeIcon className="size-5 text-warning" />
              </div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {intl.formatMessage({
                  id: "landing.rag.step_context_title",
                  defaultMessage: "It Reads Your Rules First",
                })}
              </h3>
              <p className="text-xs leading-relaxed text-muted">
                {intl.formatMessage({
                  id: "landing.rag.step_context_desc",
                  defaultMessage:
                    "Before answering, the AI is given your document text plus the staff member's role and permissions.",
                })}
              </p>
            </motion.div>

            {/* Generation */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, delay: 0.3 },
                },
              }}
              className="rounded-2xl border border-success/30 bg-success/10 p-6"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-success/15">
                <RobotIcon className="size-5 text-success" />
              </div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {intl.formatMessage({
                  id: "landing.rag.step_gen_title",
                  defaultMessage: "Then It Answers",
                })}
              </h3>
              <p className="text-xs leading-relaxed text-muted">
                {intl.formatMessage({
                  id: "landing.rag.step_gen_desc",
                  defaultMessage:
                    "In plain language — and it can also take action: check stock, guide putaway, fill forms.",
                })}
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* ─── CTA: View Full Diagram ─── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="text-center"
        >
          <Button
            variant="primary"
            size="lg"
            onPress={openDiagram}
            className="gap-2"
          >
            <DatabaseIcon className="size-5" />
            {intl.formatMessage({
              id: "landing.rag.view_diagram",
              defaultMessage: "View Full Architecture Diagram",
            })}
            <ArrowRightIcon className="size-4" />
          </Button>
          <p className="mt-3 text-xs text-muted">
            {intl.formatMessage({
              id: "landing.rag.diagram_hint",
              defaultMessage: "Interactive diagram — zoom and pan to explore",
            })}
          </p>
        </motion.div>
      </div>

      {/* ─── 7xl Modal with Mermaid Diagram ─── */}
      <AnimatePresence>
        {diagramOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeDiagram}
            />

            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border px-6 py-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10">
                  <DatabaseIcon className="size-5 text-accent" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">
                  {intl.formatMessage({
                    id: "landing.rag.modal_title",
                    defaultMessage: "RAG Architecture Diagram",
                  })}
                </h2>
                <button
                  onClick={closeDiagram}
                  className="ml-auto flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-default hover:text-foreground"
                >
                  <span className="sr-only">Close</span>
                  <svg
                    width="1em"
                    height="1em"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-auto p-6">
                <div className="rounded-xl border border-border bg-background">
                  <MermaidDiagram chart={RAG_DIAGRAM} />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
                <Button variant="secondary" onPress={closeDiagram}>
                  {intl.formatMessage({
                    id: "landing.rag.modal_close",
                    defaultMessage: "Close",
                  })}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
