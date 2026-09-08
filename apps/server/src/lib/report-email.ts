import { prisma } from './prisma.js';
import { getRawSettings, getBooleanSetting } from './app-settings.js';
import { isMailConfigured, sendMail, wrapEmailHtml } from './mailer.js';
import { logSystemInfo, logSystemWarn } from './system-log.js';

/**
 * Scheduled monthly stock-movement report email.
 * Checked hourly; sends once per month when the current day matches the
 * configured dayOfMonth (or on the first run of the month after it).
 * Last-send bookkeeping is stored in AppSetting `reports.monthlyEmail.lastSent`.
 */

const LAST_SENT_KEY = 'reports.monthlyEmail.lastSent';

const buildReportHtml = async (): Promise<{ subject: string; html: string } | null> => {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = previousMonth.getFullYear();
    const month = previousMonth.getMonth() + 1;
    const monthLabel = previousMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const rows = await prisma.$queryRaw<Array<{
        warehouse: string;
        movement_type: string;
        direction: string;
        total_qty: string;
        movements: bigint;
    }>>`
        SELECT w.name AS warehouse, sm.transaction_type AS movement_type, sm.direction::text AS direction,
               SUM(sm.quantity)::text AS total_qty, COUNT(*) AS movements
        FROM stock_movements sm
        JOIN warehouses w ON w.id = sm.warehouse_id
        WHERE EXTRACT(YEAR FROM sm.transaction_date) = ${year} AND EXTRACT(MONTH FROM sm.transaction_date) = ${month}
        GROUP BY w.name, sm.transaction_type, sm.direction
        ORDER BY w.name, sm.transaction_type
    `;

    const warehouseRows = new Map<string, string[]>();
    for (const row of rows) {
        const list = warehouseRows.get(row.warehouse) ?? [];
        list.push(
            `<tr><td style="padding:4px 8px;">${row.movement_type}</td><td style="padding:4px 8px;">${row.direction}</td><td style="padding:4px 8px;text-align:right;">${Number(row.total_qty).toLocaleString()}</td><td style="padding:4px 8px;text-align:right;">${row.movements}</td></tr>`,
        );
        warehouseRows.set(row.warehouse, list);
    }

    if (warehouseRows.size === 0) return null;

    let html = `<p>Monthly stock movement summary for <strong>${monthLabel}</strong>.</p>`;
    for (const [warehouse, trs] of warehouseRows) {
        html += `<h3 style="margin:16px 0 4px;font-size:15px;">${warehouse}</h3>
<table style="border-collapse:collapse;width:100%;font-size:13px;">
<thead><tr style="text-align:left;border-bottom:1px solid #ddd;"><th style="padding:4px 8px;">Type</th><th style="padding:4px 8px;">Direction</th><th style="padding:4px 8px;text-align:right;">Qty</th><th style="padding:4px 8px;text-align:right;">Movements</th></tr></thead>
<tbody>${trs.join('')}</tbody></table>`;
    }

    return { subject: `WMS Monthly Stock Movement — ${monthLabel}`, html };
};

/** Called hourly from the server entry point. Returns true when a report was sent. */
export const maybeSendMonthlyReport = async (): Promise<boolean> => {
    try {
        if (!(await getBooleanSetting('reports.monthlyEmail.enabled'))) return false;
        const raw = await getRawSettings();
        const recipients = (raw['reports.monthlyEmail.recipients'] ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
        if (recipients.length === 0) return false;
        if (!(await isMailConfigured())) {
            logSystemWarn({ source: 'mail', message: 'Monthly report email enabled but SMTP is not configured' });
            return false;
        }

        const now = new Date();
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const dayOfMonth = Number(raw['reports.monthlyEmail.dayOfMonth'] ?? 1);
        if (now.getDate() < dayOfMonth) return false;

        const lastSentRow = await prisma.appSetting.findUnique({ where: { key: LAST_SENT_KEY } });
        if (lastSentRow?.value === period) return false;

        const report = await buildReportHtml();
        if (!report) {
            await prisma.appSetting.upsert({ where: { key: LAST_SENT_KEY }, update: { value: period }, create: { key: LAST_SENT_KEY, value: period } });
            return false;
        }

        let sent = 0;
        for (const to of recipients) {
            const ok = await sendMail({ to, subject: report.subject, html: wrapEmailHtml(report.subject, report.html) });
            if (ok) sent += 1;
        }

        if (sent > 0) {
            await prisma.appSetting.upsert({ where: { key: LAST_SENT_KEY }, update: { value: period }, create: { key: LAST_SENT_KEY, value: period } });
            logSystemInfo({ source: 'mail', message: `Monthly stock movement report emailed to ${sent} recipient(s)` });
            return true;
        }
        return false;
    } catch (error) {
        logSystemWarn({ source: 'mail', message: `Monthly report job failed: ${error instanceof Error ? error.message : String(error)}` });
        return false;
    }
};
