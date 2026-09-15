import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { RowInput } from 'jspdf-autotable';
import type { PrintDoc } from './transaction-document';

// ─── Labels (i18n-agnostic — the caller resolves print.document.* strings) ────

export interface TransactionPdfLabels {
  number: string;
  warehouse: string;
  counterparty: string;
  reference: string;
  reason: string;
  skuCode: string;
  skuName: string;
  qty: string;
  details: string;
  total: string;
  noItems: string;
  createdBy: string;
  approvedBy: string;
  preparedBy: string;
}

// ─── Layout constants (A4 portrait, mm, ~15mm margins, ink-friendly) ──────────

const M = 15;
const A4_W = 210;
const A4_H = 297;
const CONTENT_W = A4_W - M * 2;

const INK: [number, number, number] = [31, 31, 31];
const MUTED: [number, number, number] = [117, 117, 117];
const RULE: [number, number, number] = [212, 212, 212];

/** Small uppercase tracked label (matches the document meta grid). */
function drawLabel(pdf: jsPDF, text: string, x: number, y: number): void {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(...MUTED);
  pdf.setCharSpace(0.4);
  pdf.text(text.toUpperCase(), x, y);
  pdf.setCharSpace(0);
}

// ─── 1. Header: title + number left, status box + date right, thick rule ──────

function drawHeader(pdf: jsPDF, doc: PrintDoc, docTitle: string, labels: TransactionPdfLabels): number {
  pdf.setTextColor(...INK);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16.5);
  pdf.text(docTitle, M, 24);

  drawLabel(pdf, labels.number, M, 31.5);
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(...INK);
  pdf.text(doc.number, M, 37.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setCharSpace(0.5);
  const status = doc.status.toUpperCase();
  const boxW = pdf.getTextWidth(status) + 6;
  const boxH = 6.5;
  const boxX = M + CONTENT_W - boxW;
  pdf.setDrawColor(...INK);
  pdf.setLineWidth(0.25);
  pdf.rect(boxX, M, boxW, boxH);
  pdf.text(status, boxX + boxW / 2, M + 4.4, { align: 'center' });
  pdf.setCharSpace(0);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(...INK);
  pdf.text(doc.date, M + CONTENT_W, 30, { align: 'right' });

  pdf.setDrawColor(...INK);
  pdf.setLineWidth(0.28); // ≈0.8pt thick rule closing the header
  pdf.line(M, 44, M + CONTENT_W, 44);
  return 44;
}

// ─── 2. Meta grid: label-above-value pairs, only non-null fields ──────────────

function drawMetaGrid(pdf: jsPDF, doc: PrintDoc, labels: TransactionPdfLabels, startY: number): number {
  const fields = [
    { label: labels.warehouse, value: doc.warehouse, mono: false },
    ...(doc.counterparty ? [{ label: labels.counterparty, value: doc.counterparty, mono: false }] : []),
    ...(doc.reference ? [{ label: labels.reference, value: doc.reference, mono: true }] : []),
    ...(doc.reason ? [{ label: labels.reason, value: doc.reason, mono: false }] : []),
  ];

  const colW = CONTENT_W / 4;
  let bottom = startY;
  fields.forEach((field, col) => {
    const x = M + col * colW;
    drawLabel(pdf, field.label, x, startY + 4);
    const lines = pdf.splitTextToSize(field.value, colW - 3).slice(0, 3) as string[];
    pdf.setFont(field.mono ? 'courier' : 'helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(...INK);
    lines.forEach((line, i) => {
      pdf.text(line, x, startY + 9 + i * 4.6);
    });
    bottom = Math.max(bottom, startY + 9 + (lines.length - 1) * 4.6);
  });
  return bottom;
}

// ─── 3. Items table: bold head between rules, plain row rules, bold total ─────

function drawItemsTable(pdf: jsPDF, doc: PrintDoc, labels: TransactionPdfLabels, startY: number): number {
  const head = [['#', labels.skuCode.toUpperCase(), labels.skuName.toUpperCase(), labels.qty.toUpperCase(), labels.details.toUpperCase()]];
  const body: RowInput[] = doc.items.length
    ? doc.items.map((item, index) => [
        String(index + 1),
        item.skuCode,
        item.skuName,
        item.quantity.toLocaleString(),
        item.details || '—',
      ])
    : [[{ content: labels.noItems, colSpan: 5, styles: { textColor: MUTED, fontStyle: 'italic' } }]];
  const foot: RowInput[] = [
    [
      { content: labels.total.toUpperCase(), colSpan: 3, styles: { halign: 'right', textColor: MUTED, fontSize: 7.5 } },
      { content: doc.totalQuantity.toLocaleString() },
      { content: '' },
    ],
  ];

  autoTable(pdf, {
    startY,
    margin: { left: M, right: M, top: 20, bottom: 20 },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: INK,
      cellPadding: { top: 2, right: 1.5, bottom: 2, left: 1.5 },
      lineWidth: { top: 0, right: 0, bottom: 0.1, left: 0 },
      lineColor: RULE,
    },
    headStyles: {
      fontStyle: 'bold',
      fontSize: 7.5,
      textColor: INK,
      lineWidth: { top: 0.4, right: 0, bottom: 0.4, left: 0 },
      lineColor: INK,
    },
    footStyles: {
      fontStyle: 'bold',
      fontSize: 9.5,
      textColor: INK,
      lineWidth: { top: 0.5, right: 0, bottom: 0, left: 0 },
      lineColor: INK,
    },
    columnStyles: {
      0: { cellWidth: 9, font: 'courier', fontSize: 8, textColor: MUTED },
      1: { cellWidth: 34, font: 'courier', fontSize: 8.5 },
      3: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 'auto', fontSize: 8.5, textColor: MUTED },
    },
    head,
    body,
    foot,
  });
  // autoTable assigns `lastAutoTable` on the doc at runtime (untyped in v5).
  return (pdf as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? startY;
}

// ─── 4. Footer: audit columns + side-by-side signature lines ──────────────────

function drawAuditColumn(pdf: jsPDF, label: string, name: string | null, timestamp: string | null, x: number, y: number): void {
  drawLabel(pdf, label, x, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(...INK);
  pdf.text(name ?? '—', x, y + 5);
  if (timestamp) {
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text(timestamp, x, y + 9.5);
  }
}

function drawFooter(pdf: jsPDF, doc: PrintDoc, labels: TransactionPdfLabels, startY: number): void {
  // Audit block + signature block ≈ 40mm — move to a fresh page if cramped.
  let y = startY;
  if (y + 42 > A4_H - M) {
    pdf.addPage();
    y = 24;
  }

  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.15);
  pdf.line(M, y, M + CONTENT_W, y);

  const half = CONTENT_W / 2;
  drawAuditColumn(pdf, labels.createdBy, doc.createdBy, doc.createdAt, M, y + 6);
  drawAuditColumn(pdf, labels.approvedBy, doc.approvedBy, doc.approvedAt, M + half, y + 6);

  const sigW = 70;
  const sigY = y + 30;
  pdf.setDrawColor(...INK);
  pdf.setLineWidth(0.3);
  pdf.line(M, sigY, M + sigW, sigY);
  pdf.line(M + CONTENT_W - sigW, sigY, M + CONTENT_W, sigY);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...INK);
  pdf.text(labels.preparedBy, M + sigW / 2, sigY + 5, { align: 'center' });
  pdf.text(labels.approvedBy, M + CONTENT_W - sigW / 2, sigY + 5, { align: 'center' });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Builds the A4 document as a Blob (no download side effect — testable). */
export function buildTransactionPdfBlob(doc: PrintDoc, docTitle: string, labels: TransactionPdfLabels): Blob {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.setProperties({ title: `${docTitle} ${doc.number}`, subject: doc.number, creator: 'ERP Warehouse' });

  const headerBottom = drawHeader(pdf, doc, docTitle, labels);
  const metaBottom = drawMetaGrid(pdf, doc, labels, headerBottom + 8);
  const tableBottom = drawItemsTable(pdf, doc, labels, metaBottom + 6);
  drawFooter(pdf, doc, labels, tableBottom + 10);

  return pdf.output('blob');
}
