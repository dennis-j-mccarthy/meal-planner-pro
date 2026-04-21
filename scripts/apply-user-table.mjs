import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const sql = `
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "clerkUserId" TEXT NOT NULL UNIQUE,
      "email" TEXT,
      "isAdmin" BOOLEAN NOT NULL DEFAULT false,
      "kitchenId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "User_kitchenId_idx" ON "User"("kitchenId");

    DO $$ BEGIN
      ALTER TABLE "User" ADD CONSTRAINT "User_kitchenId_fkey"
        FOREIGN KEY ("kitchenId") REFERENCES "Kitchen"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `;

  await pool.query(sql);
  console.log("✅ User table created");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
