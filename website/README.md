# Marshmallow Website

Marketing site for [Marshmallow](https://themarshmallow.app) — the focus app that turns reducing screen time into a visual growth journey.

## Stack

- Next.js (App Router) + TypeScript
- Existing Marshmallow Supabase project (`public.waitlist`)
- Design tokens and assets from the mobile app

## Local development

```bash
cd website
cp .env.example .env.local
# fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Environment variables (Vercel)

Set these in the Vercel project (Production + Preview):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Use the **same** Supabase project as the mobile app. Do **not** add the service-role key.

## Database

Apply the waitlist migration before taking signups in production:

```
supabase/migrations/004_waitlist.sql
```

The table is insert-only under RLS (anon/authenticated can insert; no select/update/delete policies).

## Vercel deployment

1. Create a Vercel project from this GitHub repo.
2. Set **Root Directory** to `website`.
3. Framework preset: Next.js.
4. Add the environment variables above.
5. Deploy.
6. Attach the domain `themarshmallow.app` (and `www` if desired) in Vercel → Domains. Point DNS as Vercel instructs — do not change DNS from this repo.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
```
