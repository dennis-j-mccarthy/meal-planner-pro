# Meal Planner Pro — Project Overview

Business app for a personal chef (Beth McCarthy). It runs the business side of
her service: clients, scheduled cook dates, meal plans, client approval, branded
"Bon Appetit" menu cards/PDFs, invoices, newsletters, and a recipe library.

- **Repo:** https://github.com/dennis-j-mccarthy/meal-planner-pro
- **Hosting:** Vercel — **push to `main` = production deploy**.
- **Live login:** Clerk (Google OAuth or email+password). See _Auth_ below.

---

## Stack

| Area | Choice | Notes |
|------|--------|-------|
| Framework | **Next.js 16.1.x** (App Router, Turbopack) | ⚠️ Non-standard build — read `node_modules/next/dist/docs/` before assuming conventions. See _Next.js quirks_. |
| UI | React 19, Tailwind | |
| DB | Postgres via **Prisma 7** (`@prisma/client`) | Generated client lives in `src/generated/prisma` (gitignored — run `prisma generate`). |
| Auth | **Clerk 7** (`@clerk/nextjs`) | |
| Email | **Resend 6** | `src/lib/email.ts` |
| PDFs | HTML → PDF (`src/lib/generate-pdf.ts`, templates in `src/lib/*-template.ts`) | |
| AI | Google Gemini (recipe text/images), Anthropic, Edamam (nutrition) | |

### Scripts (`package.json`)
- `npm run dev` — dev server
- `npm run build` — `prisma generate && next build`
- `npm run db:push` / `db:seed` / `db:studio`
- `npm run refresh-demo`, `backup`, various `import:*/convert:*/enrich:*` recipe scripts

---

## Data model (Prisma)

Multi-tenant by **Kitchen**. A Clerk user maps to a `User` row, which belongs to a
`Kitchen`; nearly everything hangs off `kitchenId`.

```
User (clerkUserId → Kitchen)
Kitchen
 ├─ Client
 ├─ Recipe
 ├─ CookDate ──┬─ Proposal ── ProposalRecipe   (a "meal plan")
 │             ├─ MenuCard ── MenuCardRecipe    (the "Bon Appetit")
 │             └─ (finalizedProposal)
 ├─ Invoice ── InvoiceLineItem
 └─ Newsletter ── NewsletterArticle
RecipeIntake
```

Key terms: a **Proposal** IS the "meal plan". A **MenuCard** IS the "Bon Appetit".

---

## Core workflow

1. **Dashboard / Cook Dates** show a month calendar. Click a day → popup to pick a
   client → creates a **CookDate** + draft **Proposal** (meal plan).
2. **Meal plan builder** (`proposal-recipe-manager.tsx`): two columns — recipe
   search + paste-menu on the left, the current menu on the right. Add/drag/reorder
   recipes; categorize into courses.
3. **Send to client** → generates a no-login share link (`/review/[token]`). Client
   keeps/removes recipes and comments. Proposal → `CLIENT_RESPONDED`.
4. **Approve** → proposal `APPROVED`, a **MenuCard (Bon Appetit)** is auto-generated
   and auto-emailed to Beth via Resend.
5. **Bon Appetit page** (`/menu-cards/[id]`): Preview PDF, **Send to Beth** (Resend,
   with reply-to + Sending/Sent feedback), mark accepted, delete.
6. **Invoices** and **Newsletters** are separate sections off the same kitchen.

---

## Auth (Clerk)

- Dev instance frontend API: **`real-lemming-53.clerk.accounts.dev`** (keys are
  `pk_test_…` / `sk_test_…`). A separate **Production** instance exists (Vercel prod);
  its users/passwords are a *different store* from Development.
- Middleware runs via **`src/proxy.ts`** (see quirks) with `clerkMiddleware()`.
- `<ClerkProvider>` wraps the app in the layout; `src/lib/auth.ts` exposes
  `isLoggedIn()` / `isDemoMode()` (there is a `demo_mode` cookie bypass — "Try the
  demo" button — that shows shared demo data, no login).
- **Your data is tied to a Clerk user id**, not a login method. To keep your data,
  sign back into the *same* Clerk user. You can add an email+password to that user in
  the Clerk Dashboard (Users → your user → set password) so you don't depend on Google.
- Login trouble is usually **dev-vs-prod instance mismatch** (reset the password in
  the instance the site you're on actually uses) or a Google-side passkey prompt
  (choose "Try another way" → password).

---

## Email (Resend)

- `src/lib/email.ts` → `sendEmail` (PDF attachment, optional `replyTo`) and
  `sendPlainEmail`.
- Bon Appetit + invoices are sent to **`yogabeth@mac.com`**. Bon Appetit sets
  **reply-to** = `REPLY_TO_EMAIL` (defaults to `dennisjmccarthy@gmail.com`).
- **From address caveat:** without a verified domain, Resend sends from
  `onboarding@resend.dev`. Resend **cannot** send *from* a Gmail address. To use a
  real From: verify a domain in Resend (e.g. `floridahealthychef.com`), then set
  `RESEND_FROM_EMAIL="Beth McCarthy <bonappetit@yourdomain>"` in Vercel env. The code
  already reads `RESEND_FROM_EMAIL`.

---

## Environment variables

Set in `.env` locally and in Vercel for prod:

- `DATABASE_URL` — Postgres
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `RESEND_API_KEY` — Resend
- `RESEND_FROM_EMAIL` — **not set yet**; needed for a custom From (see above)
- `REPLY_TO_EMAIL` — optional; defaults to `dennisjmccarthy@gmail.com`
- `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `EDAMAM_APP_ID`, `EDAMAM_APP_KEY`

---

## Next.js quirks (important)

- **Middleware file is `src/proxy.ts`, not `middleware.ts`** — this Next build defines
  `PROXY_FILENAME = 'proxy'`. Clerk's `clerkMiddleware()` lives there.
- **Only one `next dev` server per folder** — starting a second errors with "Another
  next dev server is already running." A stale lock can sit in `.next/dev/lock`.
- **`(app)/` route-group migration is IN PROGRESS.** Locally the app has been moving
  routes into `src/app/(app)/…`, but **`main` still serves the old `src/app/…`
  locations**. When editing a **route/page** on `main`, edit the OLD location, or you
  create two pages resolving to the same path (a build-breaking duplicate route).
  Components under `src/components/` are the same path either way — safe.

---

## Deploy workflow

- Push to `main` → Vercel builds & deploys production.
- ⚠️ Another session/collaborator pushes to `main` too. When landing a change, apply
  it onto the **latest `origin/main`** (e.g. via a throwaway `git worktree` at
  `origin/main` + cherry-pick/edit + push) so you don't clobber their work or deploy a
  half-finished local refactor.

---

## Known issues / TODO

- [ ] **Verify a Resend domain** and set `RESEND_FROM_EMAIL` so Bon Appetits stop
      sending from `onboarding@resend.dev`.
- [ ] **Rotate & remove hardcoded API keys** committed into Claude Code settings
      (Anthropic keys in `~/.claude/settings.json`, a Google key in
      `meal-planner-pro/.claude/settings.local.json`).
- [ ] Finish the `(app)/` route-group migration and delete the old `src/app/*` route
      files in one commit.
- [ ] Optional cleanup: the `/api/menu-cards/[id]/eml` route + `eml-builder` lib are
      no longer linked (Download Email button removed) and can be deleted.

---

## Recent changes (this session)

- Calendar: click a day → client-picker popup (portaled/centered).
- Meal-plan builder: flipped columns; taller paste-menu textarea.
- Cook date: "Edit meal plan" link for approved plans (was read-only).
- Bon Appetit: Resend "Send to Beth" only (removed Download Email + Download PDF),
  reply-to added, send confirmation; header actions turned into top-right icons and
  recipe count moved into the title.

_Last updated during the session that shipped commit `20d9e1c`._
