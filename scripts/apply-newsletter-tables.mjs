import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const sql = `
    CREATE TABLE IF NOT EXISTS "Newsletter" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "kitchenId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "intro" TEXT,
      "publishDate" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "Newsletter_kitchenId_createdAt_idx"
      ON "Newsletter"("kitchenId", "createdAt");

    DO $$ BEGIN
      ALTER TABLE "Newsletter" ADD CONSTRAINT "Newsletter_kitchenId_fkey"
        FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "NewsletterArticle" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "newsletterId" TEXT NOT NULL,
      "position" INTEGER NOT NULL,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "imageData" TEXT
    );

    CREATE INDEX IF NOT EXISTS "NewsletterArticle_newsletterId_position_idx"
      ON "NewsletterArticle"("newsletterId", "position");

    DO $$ BEGIN
      ALTER TABLE "NewsletterArticle" ADD CONSTRAINT "NewsletterArticle_newsletterId_fkey"
        FOREIGN KEY ("newsletterId") REFERENCES "Newsletter"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `;

  await pool.query(sql);
  console.log("✅ Newsletter tables created");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
