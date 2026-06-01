import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  await pool.query(`
    ALTER TABLE "Newsletter" ADD COLUMN IF NOT EXISTS "introImage" TEXT;
  `);
  console.log("✅ Newsletter.introImage column ensured");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
