import nodemailer, { type Transporter } from "nodemailer";
import { getRawSettings } from "./app-settings.js";
import { logSystemError, logSystemInfo } from "./system-log.js";

/**
 * SMTP mail helper. Transport is configured from the mail.* settings with
 * SMTP_* env vars as fallback. All sends are fire-safe: failures are logged
 * (system_logs source=mail) and never thrown into request paths.
 */

interface MailAddress {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let cachedTransport: { key: string; transporter: Transporter } | null = null;

export const resolveMailFrom = async (): Promise<string> => {
  const raw = await getRawSettings();
  return (
    raw["mail.from"] ||
    process.env.MAIL_FROM ||
    process.env.SMTP_FROM ||
    "no-reply@localhost"
  );
};

const getTransport = async (): Promise<Transporter | null> => {
  const raw = await getRawSettings();
  const host = raw["mail.host"] || process.env.SMTP_HOST || "";
  if (!raw["mail.enabled"] || !host) return null;

  const port = Number(raw["mail.port"] || process.env.SMTP_PORT || 587);
  const secure = raw["mail.secure"] === "true" || port === 465;
  const user = process.env.SMTP_USER ?? "";
  const pass = process.env.SMTP_PASS ?? "";

  const key = `${host}:${port}:${secure}:${user.length}`;
  if (cachedTransport?.key === key) return cachedTransport.transporter;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });
  cachedTransport = { key, transporter };
  return transporter;
};

/** Returns true when mail delivery is configured and enabled. */
export const isMailConfigured = async (): Promise<boolean> => {
  return (await getTransport()) !== null;
};

/** Send an email. Never throws — returns false on any failure. */
export const sendMail = async (mail: MailAddress): Promise<boolean> => {
  try {
    const transporter = await getTransport();
    if (!transporter) return false;
    await transporter.sendMail({
      from: await resolveMailFrom(),
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text ?? mail.html.replace(/<[^>]+>/g, " "),
    });
    logSystemInfo({
      source: "mail",
      message: `Email sent to ${mail.to}: ${mail.subject}`,
    });
    return true;
  } catch (error) {
    logSystemError({
      source: "mail",
      message: `Email send failed to ${mail.to}: ${error instanceof Error ? error.message : String(error)}`,
    });
    return false;
  }
};

/** Simple branded HTML wrapper for transactional emails. */
export const wrapEmailHtml = (title: string, bodyHtml: string): string => `
<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1a1a2e;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;">${title}</h1>
      <div style="font-size:14px;line-height:1.6;">${bodyHtml}</div>
      <p style="margin-top:24px;font-size:12px;color:#8a8a9e;">WMS — Enterprise Systems That Think</p>
    </div>
  </body>
</html>`;
