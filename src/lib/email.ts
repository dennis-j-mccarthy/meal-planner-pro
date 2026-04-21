import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  attachmentFilename: string;
  attachmentPdf: Buffer;
}

export async function sendEmail(options: SendEmailOptions) {
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Joyful Wellness with Beth <onboarding@resend.dev>",
    to: [options.to],
    subject: options.subject,
    text: options.text,
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
