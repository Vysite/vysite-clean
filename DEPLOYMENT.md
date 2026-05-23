# VYSITE — Deployment & Environment Guide

This document defines the three-environment deployment workflow for VYSITE.
All production releases must pass through Development → Staging before going live.

---

## Environment Overview

| Environment | URL (suggested)          | Supabase Project | Purpose                              |
|-------------|--------------------------|------------------|--------------------------------------|
| Development | dev.vysite.com / localhost | Dev project     | Active feature development           |
| Staging     | staging.vysite.com       | Staging project  | Pre-release testing & validation     |
| Production  | app.vysite.com           | Production project | Live operational platform           |

Each environment uses its own Supabase project so data is fully isolated.
Production data must never be copied to staging or development.

---

## Local Development

```bash
# Install dependencies
npm install

# Start local dev server (loads .env.development)
npm run dev

# Type-check without building
npm run typecheck
```

The local dev server runs at `http://localhost:5173`.
It loads variables from `.env.development` automatically.

---

## Build Commands

```bash
# Build for staging (loads .env.staging)
npm run build:staging

# Build for production (loads .env.production)
npm run build:production

# Preview a production build locally
npm run preview
```

These scripts are already present in `package.json`.

---

## Environment Files

| File | Committed? | Purpose |
|------|-----------|---------|
| `.env.example` | YES | Template — shows required variables, no real values |
| `.env.development` | NO | Local development credentials |
| `.env.staging` | NO | Staging credentials |
| `.env.production` | NO | Production credentials |

**Never commit `.env.development`, `.env.staging`, or `.env.production`.**
Use your hosting provider's environment variable UI (Netlify, Vercel, etc.) to
inject production values at build time.

---

## Required Environment Variables

```bash
VITE_SUPABASE_URL        # Supabase project URL
VITE_SUPABASE_ANON_KEY   # Supabase public anon key
VITE_APP_ENV             # development | staging | production
VITE_APP_URL             # Public URL for this environment
VITE_ENABLE_AI           # true | false
VITE_APP_VERSION         # e.g. 1.2.0
```

See `.env.example` for the full template.

---

## Deployment Workflow

```
Developer local machine
        │
        ▼
   Development
   (dev.vysite.com)
   ─────────────────────────────────────
   • Feature work, bug fixes
   • Continuous deployment on commit
   • Unstable / work-in-progress OK
        │
        ▼  (after feature is complete)
   Staging
   (staging.vysite.com)
   ─────────────────────────────────────
   • Full regression testing
   • AI Tender Assistant end-to-end
   • PDF / export / print testing
   • Mobile responsiveness testing
   • Permissions & role testing
   • Multi-user concurrency testing
   • Must pass before Production release
        │
        ▼  (after staging sign-off)
   Production
   (app.vysite.com)
   ─────────────────────────────────────
   • Live users only
   • Stable, protected, backed up
   • No experimental changes
   • Minimal disruption deployments
```

**A staging sign-off checklist must be completed before every production release.**
Direct pushes to production without staging validation are not permitted.

---

## Supabase Project Setup

Each environment requires its own Supabase project.

### Creating a new Supabase project

1. Go to https://supabase.com/dashboard
2. Click **New project**
3. Name it clearly: `vysite-dev`, `vysite-staging`, `vysite-production`
4. Store the project URL and anon key in the matching `.env.*` file

### Running migrations on a new project

Migrations live in `supabase/migrations/`. Apply them in order:

```bash
# Using Supabase CLI (requires supabase login)
supabase db push --project-ref YOUR_PROJECT_REF

# Or apply each .sql file manually via the Supabase SQL editor
```

### Row Level Security

All tables have RLS enabled. After migration, verify policies are active:

```sql
-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All `rowsecurity` values should be `true`.

---

## AI / Edge Function Secrets

The AI Tender Assistant calls an Anthropic API via a Supabase Edge Function.
The Anthropic API key is stored as a Supabase secret — never in `.env` files.

To set the secret for each environment:

```bash
# Via Supabase CLI
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref YOUR_PROJECT_REF

# Or via Supabase Dashboard → Project → Edge Functions → Secrets
```

The Edge Function reads `ANTHROPIC_API_KEY` automatically at runtime.

---

## Supabase Storage

File uploads (snag photos, T&C attachments, documents) are stored in Supabase Storage.
Each Supabase project has its own isolated storage buckets.

Bucket name: `attachments` (created automatically by the store layer)

---

## Database Backups

### Production
- Enable **Point-in-Time Recovery (PITR)** in Supabase Dashboard → Project → Database → Backups
- Supabase Pro/Team plan provides daily automated backups
- Test restore process before go-live

### Staging
- Daily backups recommended but not mandatory
- Can be seeded from the migration files; no need to restore from backup

### Development
- No backup requirement
- Treat as disposable; reseed from migrations as needed

---

## Vercel Deployment

VYSITE is hosted on Vercel. Each environment maps to a separate Vercel project connected to its own Git branch and Supabase project.

### vercel.json

A `vercel.json` file is committed to the repository root. It configures:

- **Build command**: `npm run build:production` (uses Vite's production mode, loads `.env.production` values set in Vercel)
- **Output directory**: `dist`
- **SPA routing**: All paths rewrite to `/index.html` so that direct links and page refreshes work correctly

```json
{
  "buildCommand": "npm run build:production",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

> **Staging override**: In the Vercel staging project, override the build command to `npm run build:staging` in Vercel Dashboard → Project Settings → Build & Development Settings. The `vercel.json` default is production-safe.

---

### Three Vercel Projects

Create three separate Vercel projects — one per environment. Do not use Vercel Preview Deployments as a substitute for the staging project; they do not carry the staging Supabase credentials.

| Vercel Project | Git Branch | Domain | Supabase Project |
|---|---|---|---|
| `vysite-production` | `main` | `app.vysite.com`, `vysite.com`, `vysite.co.uk` | `vysite-production` |
| `vysite-staging` | `staging` | `staging.vysite.com` | `vysite-staging` |
| `vysite-dev` | `develop` | `dev.vysite.com` | `vysite-dev` |

---

### Environment Variables on Vercel

Do not use `.env.*` files for deployed environments — Vercel injects variables at build time from its dashboard.

For each Vercel project, add these variables under **Project Settings → Environment Variables**:

| Variable | Example value |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` |
| `VITE_APP_ENV` | `production` / `staging` / `development` |
| `VITE_APP_URL` | `https://app.vysite.com` |
| `VITE_ENABLE_AI` | `true` |
| `VITE_APP_VERSION` | `1.0.0` |

Set each variable's scope to **Production** only (not Preview or Development) within that project, to avoid cross-contamination.

---

### Domain & DNS Setup

All DNS records should point to Vercel's nameservers or use CNAME records as Vercel instructs after domain addition.

**In Vercel Dashboard → `vysite-production` → Domains**, add:
- `app.vysite.com` (primary)
- `vysite.com` (redirect → `app.vysite.com`)
- `vysite.co.uk` (redirect → `app.vysite.com`)

**In Vercel Dashboard → `vysite-staging` → Domains**, add:
- `staging.vysite.com`

**In Vercel Dashboard → `vysite-dev` → Domains**, add:
- `dev.vysite.com`

Vercel provisions SSL certificates automatically for all custom domains. No manual HTTPS configuration is needed.

**DNS records to add at your domain registrar:**

```
CNAME   app          → cname.vercel-dns.com
CNAME   staging      → cname.vercel-dns.com
CNAME   dev          → cname.vercel-dns.com
CNAME   @            → cname.vercel-dns.com   (or A record if registrar requires it)
```

Vercel provides the exact DNS values to enter after you add each domain in the dashboard.

---

### CORS on Supabase

For each Supabase project, add the environment URL to the allowed origins:
**Supabase Dashboard → Project → Authentication → URL Configuration → Site URL**

```
vysite-dev:        http://localhost:5173, https://dev.vysite.com
vysite-staging:    https://staging.vysite.com
vysite-production: https://app.vysite.com, https://vysite.com, https://vysite.co.uk
```

---

### Deploying

Vercel deploys automatically on push to the connected branch.

```
git push origin main      → triggers vysite-production build
git push origin staging   → triggers vysite-staging build
git push origin develop   → triggers vysite-dev build
```

To deploy manually without a push, use **Vercel Dashboard → Deployments → Redeploy**.

---

## Environment Indicator (UI)

A banner is shown at the top of the app in Development and Staging environments.
It is automatically hidden in Production (zero performance cost).

- **Blue banner** = Development
- **Amber banner** = Staging — includes a "Not for live use" notice

This prevents users from confusing environments and ensures testers always know where they are.
The banner reads the `VITE_APP_ENV` variable injected by Vercel at build time.

---

## Staging Sign-Off Checklist

Complete this checklist before every production deployment:

- [ ] All new features tested end-to-end on staging
- [ ] PDF / export outputs verified (correct data, correct layout)
- [ ] AI Tender Assistant: upload, analyse, save to tender — working
- [ ] Mobile: all key flows tested on a real device (iOS + Android)
- [ ] Permissions: Admin, Manager, User, Client User roles all tested
- [ ] Multi-user: two sessions open simultaneously — no conflicts
- [ ] Ticket creation → edit → delete: Actions, Snags, T&C, Site Forms
- [ ] Notifications: assigned actions/snags appear in notification panel
- [ ] No browser console errors on production build
- [ ] `npm run typecheck` passes clean
- [ ] `npm run build:staging` completes without errors

---

## Versioning

Bump `VITE_APP_VERSION` in the Vercel environment variables for the production project on each release.

Follow semantic versioning: `MAJOR.MINOR.PATCH`

```
1.0.0   → initial production launch
1.0.1   → bug fix
1.1.0   → new feature
2.0.0   → breaking change / major redesign
```

The version is displayed in the dev/staging environment banner.

---

## Quick Reference

```bash
# Local dev
npm run dev

# Type-check
npm run typecheck

# Staging build (test locally before push)
npm run build:staging

# Production build (test locally before push)
npm run build:production

# Deploy — push to the relevant branch; Vercel handles the rest
git push origin main       # → production
git push origin staging    # → staging
git push origin develop    # → development
```

---

*VYSITE Deployment Guide — keep this file updated with each infrastructure change.*
