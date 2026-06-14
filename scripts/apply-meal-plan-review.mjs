import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const sql = `
    -- Client preference profile
    ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "inclusions" TEXT;
    ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "exclusions" TEXT;
    ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "profileNotes" TEXT;

    -- Proposal client-review fields
    ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;
    ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "clientComment" TEXT;
    ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "clientApproved" BOOLEAN;
    ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "clientSubmittedAt" TIMESTAMP(3);
    CREATE UNIQUE INDEX IF NOT EXISTS "Proposal_shareToken_key" ON "Proposal"("shareToken");

    -- ProposalRecipe: client "subtracted" this item
    ALTER TABLE "ProposalRecipe" ADD COLUMN IF NOT EXISTS "clientRemoved" BOOLEAN NOT NULL DEFAULT false;
  `;

  await pool.query(sql);
  console.log("✅ Meal-plan review columns applied");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
