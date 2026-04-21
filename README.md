# Meal Planner Pro

Meal Planner Pro is a Next.js MVP for professional chefs running meal-planning services. The app is structured around the service flow described for this product:

- build a recipe database
- capture recipe intake from imports, APIs, AI prompts, and pasted URLs
- manage client records
- schedule cook dates
- create proposals from recipe selections
- approve the final menu for each cook date

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Prisma 7
- SQLite

## Local setup

Install dependencies:

```bash
npm install
```

Create the SQLite database and load demo data:

```bash
npm run db:push
npm run db:seed
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data model

- `Kitchen`: root workspace / tenant
- `Recipe`: recipe record with source metadata
- `RecipeIntake`: queued AI, URL, API, or bulk-import request
- `Client`: household or account receiving the chef service
- `CookDate`: scheduled service date for a client
- `Proposal`: client-facing menu proposal for a cook date
- `ProposalRecipe`: join table connecting selected recipes to proposals

## Current scope

This repo includes the first working workflow and UI. External recipe APIs, webpage parsing, AI generation, authentication, and a client-facing approval portal are intentionally left as next integrations. The current implementation gives those features a real schema and intake path so they can be connected cleanly later.

## Validation

```bash
npm run lint
npm run build
```
