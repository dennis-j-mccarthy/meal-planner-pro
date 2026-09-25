import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { Resend } from "resend";
import { format } from "date-fns";
import { parseStructured } from "@/lib/menu-parser";
import { buildBonAppetitHtml } from "@/lib/bon-appetit-template";
import { generatePdfFromHtml } from "@/lib/generate-pdf";
import { sendEmail, sendPlainEmail } from "@/lib/email";

// PDF rendering (headless Chrome) needs a generous window on serverless.
export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY);

// Who is allowed to trigger a Bon Appetit by email.
// Who may trigger a Bon Appetit by email. The finished PDF is sent back to
// whichever of these addresses sent the request.
const ALLOWED_SENDERS = ["yogabeth@mac.com", "dennisjmccarthy@gmail.com"];

// Pull the bare email address out of a "Name <email>" From header.
function extractEmail(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

type ReceivedEvent = {
  type?: string;
  data?: { email_id?: string; from?: string; subject?: string };
};

// Subject convention: "Client Name - M/D/YYYY" (date optional → defaults today).
function parseSubject(subject: string): { client: string; date: Date } {
  const raw = subject
    .replace(/^(re:|fwd:)\s*/i, "")
    .replace(/^bon\s*app[eé]tit\s*[-–:]?\s*/i, "")
    .trim();
  const m = raw.match(/^(.*?)[\s\-–]+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*$/);
  if (m) {
    const mo = Number(m[2]);
    const da = Number(m[3]);
    let yr = Number(m[4]);
    if (yr < 100) yr += 2000;
    // Noon local time avoids any date-shift from timezone.
    const d = new Date(yr, mo - 1, da, 12, 0, 0);
    return {
      client: m[1].trim() || "Guest",
      date: isNaN(d.getTime()) ? new Date() : d,
    };
  }
  return { client: raw || "Guest", date: new Date() };
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "RESEND_WEBHOOK_SECRET not configured" },
      { status: 500 },
    );
  }

  // 1. Verify the webhook signature (Svix).
  const payload = await req.text();
  let evt: ReceivedEvent;
  try {
    evt = new Webhook(secret).verify(payload, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    }) as ReceivedEvent;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 2. Only act on inbound emails from Beth.
  if (evt.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: "event" });
  }
  const senderEmail = extractEmail(String(evt.data?.from ?? ""));
  const senderLc = senderEmail.toLowerCase();
  if (!ALLOWED_SENDERS.some((a) => senderLc === a)) {
    return NextResponse.json({ ok: true, ignored: "sender" });
  }
  const emailId = evt.data?.email_id;
  if (!emailId) {
    return NextResponse.json({ ok: true, ignored: "no email_id" });
  }

  try {
    // 3. Fetch the full inbound email (the webhook carries metadata only).
    const received = await resend.emails.receiving.get(emailId);
    if (received.error) {
      throw new Error(`Could not load received email: ${received.error.message}`);
    }
    const subject = received.data?.subject ?? "";
    const body = (received.data?.text ?? "").trim();

    const { client, date } = parseSubject(subject);
    const { dishes, notes } = parseStructured(body);
    if (dishes.length === 0) {
      throw new Error(
        "No recipes found. Put the menu in the email body (a category header on its own line, then a title line and a description line per dish).",
      );
    }

    // 4. Render the Bon Appetit PDF.
    const html = buildBonAppetitHtml({
      clientFirstNames: client,
      menuDate: format(date, "MMMM d, yyyy"),
      isCoaching: false,
      notes,
      recipes: dishes.map((d) => ({
        title: d.title,
        description: d.description || null,
        category: d.category,
        ingredientsText: null,
        instructionsText: null,
      })),
    });
    const pdf = await generatePdfFromHtml(html);
    const safeClient = client.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
    const dateFile = format(date, "MM-dd-yyyy");

    // 5. Email the finished Bon Appetit back to Beth.
    await sendEmail({
      to: senderEmail,
      replyTo: process.env.REPLY_TO_EMAIL || "dennisjmccarthy@gmail.com",
      subject: `Bon Appetit - ${client} - ${format(date, "M/d/yyyy")}`,
      text: [
        `Hi Beth,`,
        ``,
        `Here's the formatted Bon Appetit for ${client}, attached as a PDF.`,
        ``,
        `Dennis`,
      ].join("\n"),
      html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;"><p>Hi Beth,</p><p>Here's the formatted Bon Appetit for <strong>${client}</strong>, attached as a PDF.</p><p style="margin-top:16px;">Dennis</p></div>`,
      attachmentFilename: `BonAppetit_${safeClient || "Menu"}_${dateFile}.pdf`,
      attachmentPdf: pdf,
    });

    return NextResponse.json({ ok: true, client, dishes: dishes.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    // Don't fail silently — tell Beth why it didn't work.
    try {
      await sendPlainEmail({
        to: senderEmail,
        subject: "Couldn't build your Bon Appetit",
        text: [
          `Hi Beth,`,
          ``,
          `I couldn't build the Bon Appetit from your email.`,
          ``,
          `Reason: ${msg}`,
          ``,
          `Tip: put the client + date in the subject like "Chase & Jamie - 7/29/2026",`,
          `and in the body use a category header on its own line (e.g. Entrees),`,
          `then one line for the dish title and one line for its description.`,
          ``,
          `Dennis`,
        ].join("\n"),
      });
    } catch {
      // ignore secondary failure
    }
    // Return 200 so Resend doesn't keep retrying an unparseable email.
    return NextResponse.json({ ok: false, error: msg });
  }
}
