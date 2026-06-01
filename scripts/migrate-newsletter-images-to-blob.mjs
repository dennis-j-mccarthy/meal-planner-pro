/**
 * One-off migration: walk all Newsletters and NewsletterArticles, find rows
 * whose introImage / imageData column contains a data: URL, upload each to
 * Vercel Blob, and replace the column with the public URL.
 *
 * Idempotent — rows that already contain a non-data URL are skipped.
 *
 * Requires BLOB_READ_WRITE_TOKEN and DATABASE_URL in env (pull via
 * `vercel env pull .env.local` or set manually).
 */
import "dotenv/config";
import { put } from "@vercel/blob";
import pg from "pg";

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Missing BLOB_READ_WRITE_TOKEN");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function dataUrlToBuffer(dataUrl) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { contentType: m[1], buffer: Buffer.from(m[2], "base64") };
}

async function uploadDataUrl(dataUrl, keyPrefix) {
  const decoded = dataUrlToBuffer(dataUrl);
  if (!decoded) return null;
  const ext = decoded.contentType.split("/")[1] || "jpg";
  const key = `${keyPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const blob = await put(key, decoded.buffer, {
    access: "public",
    contentType: decoded.contentType,
    addRandomSuffix: true,
  });
  return blob.url;
}

async function migrate() {
  // Newsletters with data:-URL intro images
  const ns = await pool.query(
    `SELECT id, "kitchenId", "introImage" FROM "Newsletter" WHERE "introImage" LIKE 'data:%'`,
  );
  console.log(`Newsletters with base64 intro images: ${ns.rows.length}`);
  for (const n of ns.rows) {
    const url = await uploadDataUrl(n.introImage, `newsletters/${n.kitchenId}/migrated`);
    if (!url) {
      console.warn(`  - ${n.id}: could not decode introImage`);
      continue;
    }
    await pool.query(`UPDATE "Newsletter" SET "introImage" = $1 WHERE id = $2`, [url, n.id]);
    console.log(`  ✓ ${n.id} → ${url}`);
  }

  // Articles with data:-URL images
  const as = await pool.query(
    `SELECT a.id, a."imageData", n."kitchenId"
       FROM "NewsletterArticle" a
       JOIN "Newsletter" n ON n.id = a."newsletterId"
      WHERE a."imageData" LIKE 'data:%'`,
  );
  console.log(`Articles with base64 images: ${as.rows.length}`);
  for (const a of as.rows) {
    const url = await uploadDataUrl(a.imageData, `newsletters/${a.kitchenId}/migrated`);
    if (!url) {
      console.warn(`  - ${a.id}: could not decode imageData`);
      continue;
    }
    await pool.query(`UPDATE "NewsletterArticle" SET "imageData" = $1 WHERE id = $2`, [url, a.id]);
    console.log(`  ✓ ${a.id} → ${url}`);
  }

  await pool.end();
  console.log("Done.");
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
