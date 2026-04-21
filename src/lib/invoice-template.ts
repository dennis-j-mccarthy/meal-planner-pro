import { readFileSync } from "fs";
import { join } from "path";

interface InvoiceLineItem {
  description: string;
  amount: number;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  clientAddress: string | null;
  lineItems: InvoiceLineItem[];
  remarks: string | null;
}

function loadAssetBase64(relativePath: string, mime: string): string {
  const filePath = join(process.cwd(), "public", relativePath);
  const buffer = readFileSync(filePath);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export function buildInvoiceHtml(data: InvoiceData): string {
  const logoSrc = loadAssetBase64("jwblogo600.png", "image/png");
  const outfit400 = loadAssetBase64("fonts/outfit-400.woff2", "font/woff2");
  const outfit600 = loadAssetBase64("fonts/outfit-600.woff2", "font/woff2");
  const outfit700 = loadAssetBase64("fonts/outfit-700.woff2", "font/woff2");

  const total = data.lineItems.reduce((sum, item) => sum + item.amount, 0);

  const lineItemRows = data.lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; font-size: 10px; color: #333;">
          ${escapeHtml(item.description)}
        </td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; font-size: 10px; color: #333; text-align: right; width: 100px;">
          $${item.amount.toFixed(2)}
        </td>
      </tr>`,
    )
    .join("");

  const remarksText =
    data.remarks ||
    "Please pay by check, payable to Beth McCarthy, or use Zelle (719-440-2815/yogabeth@mac.com).";

  const addressLines = data.clientAddress
    ? data.clientAddress
        .split("\n")
        .map((line) => `<div>${escapeHtml(line)}</div>`)
        .join("")
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Outfit';
    font-weight: 400;
    font-style: normal;
    src: url('${outfit400}') format('woff2');
  }
  @font-face {
    font-family: 'Outfit';
    font-weight: 600;
    font-style: normal;
    src: url('${outfit600}') format('woff2');
  }
  @font-face {
    font-family: 'Outfit';
    font-weight: 700;
    font-style: normal;
    src: url('${outfit700}') format('woff2');
  }

  @page {
    size: letter;
    margin: 15px;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Outfit', sans-serif;
    font-size: 10px;
    color: #333;
    background: linear-gradient(135deg, hsl(280, 85%, 70%) 0%, hsl(220, 85%, 65%) 100%);
    min-height: 100vh;
    padding: 15px;
  }

  .container {
    background: #ffffff;
    border-radius: 16px;
    padding: 30px;
    min-height: calc(100vh - 30px);
  }

  .logo-wrap {
    text-align: center;
    margin-bottom: 24px;
  }

  .logo-wrap img {
    max-width: 140px;
    height: auto;
  }

  .info-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
  }

  .info-table td {
    padding: 8px 12px;
    border: 1px solid #e0e0e0;
    font-size: 10px;
  }

  .info-table .label {
    width: 40%;
    background: #f8f9fa;
    font-weight: 600;
    color: #333;
  }

  .info-table .value {
    color: #555;
  }

  .bill-to {
    margin-bottom: 24px;
  }

  .bill-to-label {
    font-size: 10px;
    font-weight: 700;
    color: #333;
    margin-bottom: 4px;
  }

  .bill-to-details {
    font-size: 10px;
    color: #555;
    line-height: 1.5;
  }

  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
  }

  .items-table th {
    padding: 10px 12px;
    border: 1px solid #e0e0e0;
    background: #f8f9fa;
    font-weight: 600;
    font-size: 10px;
    text-align: left;
    color: #333;
  }

  .items-table th:last-child {
    text-align: right;
    width: 100px;
  }

  .total-row td {
    font-weight: 700;
    background: #f8f9fa;
  }

  .total-row .total-amount {
    color: #60a5fa;
    font-size: 11px;
    text-align: right;
  }

  .remarks {
    margin-top: 20px;
  }

  .remarks-header {
    font-size: 10px;
    font-weight: 700;
    color: #333;
    margin-bottom: 6px;
  }

  .remarks-body {
    font-size: 10px;
    color: #555;
    line-height: 1.5;
  }

  .thank-you {
    color: #60a5fa;
    font-weight: 600;
    margin-top: 8px;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="logo-wrap">
      <img src="${logoSrc}" alt="Joyful Wellness with Beth" />
    </div>

    <table class="info-table">
      <tr>
        <td class="label">Date</td>
        <td class="value">${escapeHtml(data.invoiceDate)}</td>
      </tr>
      <tr>
        <td class="label">Invoice No.</td>
        <td class="value">${escapeHtml(data.invoiceNumber)}</td>
      </tr>
      <tr>
        <td class="label">Payment terms</td>
        <td class="value">Upon receipt</td>
      </tr>
    </table>

    <div class="bill-to">
      <div class="bill-to-label">Bill to:</div>
      <div class="bill-to-details">
        <div>${escapeHtml(data.clientName)}</div>
        ${addressLines}
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemRows}
        <tr class="total-row">
          <td style="padding: 10px 12px; border: 1px solid #e0e0e0; font-size: 10px;">Total</td>
          <td class="total-amount" style="padding: 10px 12px; border: 1px solid #e0e0e0;">$${total.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="remarks">
      <div class="remarks-header">Remarks / payment instructions:</div>
      <div class="remarks-body">${escapeHtml(remarksText)}</div>
      <div class="thank-you">Thank you!</div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
