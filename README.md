# Zaistech Audit OS

A small web app: add a lead, press **Run audit**, get back PageSpeed scores,
scan-based findings and an AI write-up, saved to a dashboard. Built to run on
free hosting + your existing Claude Pro plan (via the Agent SDK's subscription
credit) -- see `.env.example` for why `CLAUDE_CODE_OAUTH_TOKEN` is used instead
of a Console API key.

## 1. Create accounts (all free, no card required for the ones below)

1. **Supabase** -- supabase.com -> New project. Copy the project URL and the
   `service_role` key from Settings -> API into `.env.local` (copy
   `.env.example` first).
2. **Render** (or Railway) -- render.com -> New Web Service -> connect this
   repo (push it to GitHub first). Build command: `npm install`. Start
   command: `npm run start`. Add the same environment variables from
   `.env.local` in Render's dashboard.
3. Run the SQL in `db/schema.sql` once, in Supabase's SQL editor, to create
   the tables.

## 2. Get your Claude Pro subscription token (so audits use your $20/month
   Agent SDK credit, not separate API billing)

On your own computer, with the Claude CLI installed and logged into your Pro
account:

```
claude setup-token
```

This prints a token starting `sk-ant-oat01-...`. Put it in `.env.local` (and
in Render's environment variables) as `CLAUDE_CODE_OAUTH_TOKEN`. Do **not**
also set `ANTHROPIC_API_KEY` -- if both are present, the SDK bills the API key
instead of your subscription credit.

## 3. Get a free PageSpeed Insights API key

Google Cloud Console -> APIs & Services -> enable "PageSpeed Insights API" ->
Credentials -> Create API key. Put it in `.env.local` as `PAGESPEED_API_KEY`.

## 4. Import your leads and the rulebook

```
npm install
export SUPABASE_URL=...        # same values as .env.local
export SUPABASE_SERVICE_ROLE_KEY=...
node scripts/import_leads.mjs path/to/ecommerce-verified-export.csv
node scripts/seed_rulebook.mjs path/to/SKILL.md
```

(Export the "Ecommerce - Verified" tab of the lead sheet to CSV first -- File
-> Download -> CSV in Google Sheets/Excel.)

## 5. Run it

Locally: `npm run dev`, then open http://localhost:3000.
On Render: it deploys automatically on every push; open the URL Render gives
you.

## What this first version does and doesn't do yet

Done: lead list, "Run audit" (homepage scan, one product page, mobile
screenshot, PageSpeed, AI findings write-up in the rulebook's format), lead
detail page, approve step.

Not yet automated (see the Build Plan doc's roadmap for the plan): the
checkout/abandoned-cart shopper test, the Meta Ad Library check, outside
review signals, Phase 2 inbox timing, demo building, and outreach sending.
These currently still need a manual pass (in chat, the way audits were done
before this app existed) -- add that data on the lead detail page once it's
built out further.
