/**
 * Builds a .eml file (RFC 2822 MIME) with a text body and an optional PDF attachment.
 * Mirrors the Python email.mime approach from the JWB document production system.
 */

const BOUNDARY = "----=_MealPlannerPro_Boundary";

export interface EmlOptions {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachmentFilename?: string;
  attachmentPdf?: Buffer;
}

export function buildEml(options: EmlOptions): string {
  const date = new Date().toUTCString();
  const hasAttachment = options.attachmentPdf && options.attachmentFilename;

  if (!hasAttachment) {
    // Simple plain-text email, no attachment
    return [
      `From: ${options.from}`,
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      `Date: ${date}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset="utf-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      options.body,
    ].join("\r\n");
  }

  // Multipart with PDF attachment
  const pdfBase64 = options.attachmentPdf!.toString("base64");
  // Split base64 into 76-char lines per RFC 2045
  const pdfLines = pdfBase64.match(/.{1,76}/g) || [];

  return [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    `Date: ${date}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${BOUNDARY}"`,
    ``,
    `--${BOUNDARY}`,
    `Content-Type: text/plain; charset="utf-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    options.body,
    ``,
    `--${BOUNDARY}`,
    `Content-Type: application/pdf; name="${options.attachmentFilename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${options.attachmentFilename}"`,
    ``,
    ...pdfLines,
    ``,
    `--${BOUNDARY}--`,
  ].join("\r\n");
}
