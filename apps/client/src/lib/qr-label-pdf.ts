import { jsPDF } from "jspdf";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QrLabelField {
  label: string;
  value: string;
  mono?: boolean;
}

export interface QrLabelRow {
  /** String encoded into the QR; also printed as the human-readable number. */
  qrValue: string;
  /** PNG data URL of the rendered QR (null → placeholder box). */
  qrDataUrl: string | null;
  name: string;
  fields: QrLabelField[];
}

// ─── Geometry (A8 landscape sheet 74×52mm, 70×48mm label, mm) ─────────────────

const PAGE_W = 74;
const PAGE_H = 52;
const M = 2; // safe margin around the cut border
const LABEL_W = PAGE_W - M * 2;
const LABEL_H = PAGE_H - M * 2;

const LEFT_W = 26; // QR column
const GAP = 3; // gutter around the divider
const QR_SIZE = 21;

const INK: [number, number, number] = [31, 31, 31];
const MUTED: [number, number, number] = [117, 117, 117];
const RULE: [number, number, number] = [212, 212, 212];

// ─── One label: QR left section, details right section ────────────────────────

function drawLabel(pdf: jsPDF, row: QrLabelRow, x0: number, y0: number): void {
  // Cut-guide border
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.2);
  pdf.rect(x0, y0, LABEL_W, LABEL_H);

  // ── Left: QR code + number under it ──
  const cx = x0 + LEFT_W / 2;
  const qrX = cx - QR_SIZE / 2;
  const qrY = y0 + 4.5;
  if (row.qrDataUrl) {
    pdf.addImage(row.qrDataUrl, "PNG", qrX, qrY, QR_SIZE, QR_SIZE);
  } else {
    pdf.setDrawColor(...INK);
    pdf.rect(qrX, qrY, QR_SIZE, QR_SIZE);
  }
  pdf.setFont("courier", "normal");
  pdf.setFontSize(5.4);
  pdf.setTextColor(...MUTED);
  const numberLines = pdf
    .splitTextToSize(row.qrValue, LEFT_W - 2)
    .slice(0, 2) as string[];
  numberLines.forEach((line, i) => {
    pdf.text(line, cx, qrY + QR_SIZE + 2.6 + i * 2.4, { align: "center" });
  });

  // ── Divider between the two sections ──
  const divX = x0 + LEFT_W + GAP / 2;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.15);
  pdf.line(divX, y0 + 3, divX, y0 + LABEL_H - 3);

  // ── Right: item name, then label/value detail rows ──
  const rx = x0 + LEFT_W + GAP;
  const rw = LABEL_W - LEFT_W - GAP - 2;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.6);
  pdf.setTextColor(...INK);
  const nameLines = pdf.splitTextToSize(row.name, rw).slice(0, 2) as string[];
  let y = y0 + 6.4;
  nameLines.forEach((line) => {
    pdf.text(line, rx, y);
    y += 3.7;
  });
  y += 1.6;

  for (const field of row.fields) {
    if (y > y0 + LABEL_H - 4) break; // never overflow the label
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(4.9);
    pdf.setTextColor(...MUTED);
    pdf.setCharSpace(0.3);
    pdf.text(field.label.toUpperCase(), rx, y);
    pdf.setCharSpace(0);
    pdf.setFont(field.mono ? "courier" : "helvetica", "normal");
    pdf.setFontSize(6.4);
    pdf.setTextColor(...INK);
    const valueLines = pdf
      .splitTextToSize(field.value, rw)
      .slice(0, 2) as string[];
    valueLines.forEach((line, i) => {
      pdf.text(line, rx, y + 2.8 + i * 2.7);
    });
    y += 2.8 + valueLines.length * 2.7 + 1.4;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Builds one A8 landscape page per row (QR left + details right) as a Blob —
 * client-side only; preview/print/download are up to the caller. */
export function buildQrLabelsPdfBlob(rows: QrLabelRow[]): Blob {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [PAGE_W, PAGE_H],
  });
  if (rows[0]) {
    pdf.setProperties({
      title: rows[0].name,
      subject: rows[0].qrValue,
      creator: "ERP Warehouse",
    });
  }

  rows.forEach((row, index) => {
    if (index > 0) pdf.addPage();
    drawLabel(pdf, row, M, M);
  });

  return pdf.output("blob");
}
