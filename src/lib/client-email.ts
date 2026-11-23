// Client-facing email: the invoice or Bon Appetit PDF sent to the client,
// copied to the kitchen's own address. Used by the in-app "Send to client"
// buttons and by "Send: yes" in an emailed request.
//
// Deliberately NOT a "use server" module (every export of one becomes a
// publicly callable action). Every lookup is scoped to the kitchen passed in.
import { format } from "date-fns";
import type { Kitchen } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildInvoiceHtml, PAYMENT_TEXT } from "@/lib/invoice-template";
import { buildBonAppetitHtml } from "@/lib/bon-appetit-template";
import { generatePdfFromHtml } from "@/lib/generate-pdf";
import { sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/format";
import { chefSignoff, escapeHtml } from "@/lib/inbound-mail";

export type ClientSendResult = { ok: true; to: string } | { ok: false; error: string };

type KitchenRef = Pick<Kitchen, "id" | "name" | "contactEmail">;

// Plain text → simple HTML, one <p> per paragraph, everything escaped.
function textToHtml(text: string): string {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;">${paras}</div>`;
}

// cc + replyTo go to the kitchen's own address. With none set, both are left
// off (never fall back to someone else's inbox on client mail).
function kitchenCopy(kitchen: KitchenRef, to: string) {
  const own = kitchen.contactEmail?.trim() || null;
  return {
    ...(own && own.toLowerCase() !== to.toLowerCase() ? { cc: own } : {}),
    ...(own ? { replyTo: own } : {}),
  };
}

export async function sendInvoiceToClient(
  invoiceId: string,
  kitchen: KitchenRef,
  opts: { pdf?: Buffer } = {},
): Promise<ClientSendResult> {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, kitchenId: kitchen.id },
      include: { client: true, lineItems: { orderBy: { position: "asc" } } },
    });
    if (!invoice) return { ok: false, error: "Invoice not found" };
    if (invoice.status === "VOID") return { ok: false, error: "This invoice is void" };

    const to = invoice.client.email?.trim();
    if (!to) {
      return {
        ok: false,
        error: `${invoice.client.firstName} ${invoice.client.lastName} has no email address in the app`,
      };
    }

    const total = invoice.lineItems.reduce((s, li) => s + li.amount, 0);
    let pdf = opts.pdf;
    if (!pdf) {
      pdf = await generatePdfFromHtml(
        buildInvoiceHtml({
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: format(invoice.invoiceDate, "M/d/yyyy"),
          clientName: [invoice.client.firstName, invoice.client.lastName].filter(Boolean).join(" "),
          clientAddress: invoice.client.address,
          lineItems: invoice.lineItems.map((li) => ({ description: li.description, amount: li.amount })),
          remarks: invoice.remarks,
          showGratuity: invoice.showGratuity,
        }),
      );
    }

    const text = [
      `Hi ${invoice.client.firstName},`,
      ``,
      `Thank you! Your invoice #${invoice.invoiceNumber} for ${formatMoney(total)} is attached.`,
      ``,
      PAYMENT_TEXT,
      ``,
      chefSignoff(kitchen),
    ].join("\n");

    await sendEmail({
      to,
      ...kitchenCopy(kitchen, to),
      subject: `Invoice #${invoice.invoiceNumber} from ${kitchen.name}`,
      text,
      html: textToHtml(text),
      attachmentFilename: `${invoice.client.lastName.replace(/[^A-Za-z0-9]+/g, "_")}_Invoice_${invoice.invoiceNumber}.pdf`,
      attachmentPdf: pdf,
    });

    // Sent to the client. A paid invoice stays paid.
    await prisma.invoice.updateMany({
      where: { id: invoice.id, kitchenId: kitchen.id },
      data: invoice.status === "DRAFT" ? { status: "SENT", sentAt: new Date() } : { sentAt: new Date() },
    });

    return { ok: true, to };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function sendBonAppetitToClient(
  menuCardId: string,
  kitchen: KitchenRef,
  // pdf: the copy already rendered for Beth (same subtitle/notes/order).
  // monthOnly: the menu is for a month, not a day ("October, 2026").
  opts: { pdf?: Buffer; monthOnly?: boolean } = {},
): Promise<ClientSendResult> {
  try {
    const menuCard = await prisma.menuCard.findFirst({
      where: { id: menuCardId, kitchenId: kitchen.id },
      include: {
        client: true,
        recipes: { orderBy: { position: "asc" }, include: { recipe: true } },
      },
    });
    if (!menuCard) return { ok: false, error: "Bon Appetit not found" };

    const to = menuCard.client.email?.trim();
    if (!to) {
      return {
        ok: false,
        error: `${menuCard.client.firstName} ${menuCard.client.lastName} has no email address in the app`,
      };
    }

    let pdf = opts.pdf;
    if (!pdf) {
      const fromEmail = menuCard.source === "EMAIL";
      pdf = await generatePdfFromHtml(
        buildBonAppetitHtml({
          clientFirstNames: menuCard.client.firstName,
          menuDate: format(menuCard.menuDate, opts.monthOnly ? "MMMM, yyyy" : "MMMM d, yyyy"),
          isCoaching: menuCard.isCoaching,
          // A menu that came in by email keeps Beth's section order and notes.
          ...(fromEmail
            ? {
                preserveOrder: true,
                notes: menuCard.notes ? menuCard.notes.split("\n").filter(Boolean) : [],
              }
            : {}),
          recipes: menuCard.recipes.map((mr) => ({
            title: mr.recipe.title,
            description: mr.recipe.description,
            category: mr.category,
            ingredientsText: mr.recipe.ingredientsText,
            instructionsText: mr.recipe.instructionsText,
          })),
        }),
      );
    }

    const shortDate = format(menuCard.menuDate, opts.monthOnly ? "MMMM" : "M/d");
    const longDate = format(menuCard.menuDate, opts.monthOnly ? "MMMM yyyy" : "EEEE, MMMM d");
    const text = [
      `Hi ${menuCard.client.firstName},`,
      ``,
      `Your menu for ${longDate} is attached. Enjoy!`,
      ``,
      chefSignoff(kitchen),
    ].join("\n");

    await sendEmail({
      to,
      ...kitchenCopy(kitchen, to),
      subject: `Bon Appetit! Your menu for ${shortDate}`,
      text,
      html: textToHtml(text),
      attachmentFilename: `BonAppetit_${menuCard.client.lastName.replace(/[^A-Za-z0-9]+/g, "_")}_${format(menuCard.menuDate, opts.monthOnly ? "MM-yyyy" : "MM-dd-yyyy")}.pdf`,
      attachmentPdf: pdf,
    });

    return { ok: true, to };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
