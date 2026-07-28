import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  attachmentFilename: string;
  attachmentPdf: Buffer;
  replyTo?: string;
}

export async function sendEmail(options: SendEmailOptions) {
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Joyful Wellness with Beth <bonappetit@built-with-ai.site>",
    to: [options.to],
    subject: options.subject,
    text: options.text,
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    attachments: [
      {
        filename: options.attachmentFilename,
        content: options.attachmentPdf,
        contentType: "application/pdf",
      },
    ],
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}

interface SendPlainEmailOptions {
  to: string;
  subject: string;
  text: string;
}

/** Send a plain-text email with no attachment (notifications, share links). */
export async function sendPlainEmail(options: SendPlainEmailOptions) {
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Joyful Wellness with Beth <bonappetit@built-with-ai.site>",
    to: [options.to],
    subject: options.subject,
    text: options.text,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}
