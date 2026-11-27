import nodemailer from "nodemailer";

export type ContactNotificationInput = {
  name: string;
  email: string;
  company?: string | null;
  message: string;
};

/**
 * Best-effort email for landing contact submissions. With no recipient or no
 * SMTP host configured this is a silent no-op — the persisted submission is
 * the source of truth. Send errors are thrown for the caller to handle.
 */
export const sendContactNotification = async ({
  name,
  email,
  company,
  message,
}: ContactNotificationInput): Promise<void> => {
  const to = process.env.CONTACT_NOTIFY_TO?.trim();
  const host = process.env.SMTP_HOST?.trim();
  if (!to || !host) return;

  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? "";
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    ...(user ? { auth: { user, pass } } : {}),
  });

  const subject = `New WMS inquiry from ${name}${company ? ` (${company})` : ""}`;
  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Company: ${company || "-"}`,
    `Submitted: ${new Date().toISOString()}`,
    "",
    "Message:",
    message,
  ].join("\n");

  await transporter.sendMail({
    from:
      process.env.SMTP_FROM || process.env.MAIL_FROM || "no-reply@localhost",
    to,
    replyTo: email,
    subject,
    text,
  });
};
