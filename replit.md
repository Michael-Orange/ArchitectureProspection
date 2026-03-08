# FiltrePlante-Prospection

## Overview
Automated bi-weekly Mastra/Inngest workflow that discovers and qualifies ecological architecture firms in Senegal, then emails a CSV report to michael@filtreplante.com. Firms are persisted to PostgreSQL so only new discoveries are processed each run.

## Architecture
- **Framework**: Mastra 1.0.1 with Inngest for workflow orchestration
- **LLM**: Anthropic Claude (via Replit AI Integrations) for the agent
- **Qualification**: Dust AI API (agent 3hKwn579Sc, workspace 3OUdFWdJIF) — score 1-5, qualified if >= 3
- **Trigger**: Cron `0 15 * * 6` (every Saturday at 15:00 UTC)
- **Database**: PostgreSQL (via DATABASE_URL) — 4 tables: cabinets, contacts, qualifications, scraping
- **Email**: Gmail connector (conn_google-mail_01KK78T346G7GQ7AGD2MQX1X5C)

## Key Files
- `src/mastra/index.ts` — Main Mastra instance, cron registration, server config
- `src/mastra/agents/agent.ts` — Anthropic-powered prospecting agent with all tools (prospecting + DB)
- `src/mastra/workflows/workflow.ts` — 9-step sequential workflow with DB persistence
- `src/mastra/tools/prospectingTools.ts` — Google Places API, SerpAPI Search (filtered), deep website scraping, CSV generation, email sending
- `src/mastra/tools/databaseTools.ts` — initDbSchema, deduplicateAgainstDb, writeToDb, getDbStats
- `src/mastra/tools/dustAiTool.ts` — Dust AI batch qualification tool (single API call, keyword fallback)
- `src/mastra/tools/gmailClient.ts` — Gmail OAuth client (getUncachableGmailClient)
- `src/mastra/storage/index.ts` — Shared PostgreSQL storage
- `src/mastra/inngest/index.ts` — Inngest integration (createStep, createWorkflow)
- `tests/testCronAutomation.ts` — Manual trigger for testing

## Workflow Steps (9-step chain)
1. **initializeDatabase** — Create/verify PostgreSQL tables (cabinets, contacts, qualifications, scraping)
2. **searchGooglePlaces** — 7 queries via Google Places API (~65-69 firms, billing enabled)
3. **scrapeGoogleSearchSerpAPI** — 5 eco-focused SerpAPI queries with smart filtering (~6 firms)
4. **consolidateFirms** — Merge Places + SerpAPI, deduplicate by normalized name and domain (~58-61 unique)
5. **deduplicateAgainstDb** — Check firms against PostgreSQL cabinets table, return only NEW firms
6. **scrapeAndQualify** — Parallel deep scraping (batches of 5) + Dust AI batch qualification (skipped if 0 new firms)
7. **writeToDb** — Persist all firms to cabinets/contacts/qualifications/scraping tables
8. **generateCsvReport** — CSV of new qualified firms only (score >= 3)
9. **sendEmailSummary** — Email report to michael@filtreplante.com with DB stats

## Discovery Sources
- **Track A (Google Places API)**: 7 queries — cabinet architecture Sénégal, architecte Sénégal, bureau architecture Sénégal, architectural firm Senegal, architecture durable Sénégal, éco-construction Sénégal. Returns ~65-69 firms with addresses, phones, websites.
- **Track B (SerpAPI)**: 5 eco-focused queries — BTC/brique de terre comprimée, pisé/terre crue, matériaux locaux/bio-sourcés, architecture bioclimatique/éco-construction, CRAterre/architecture en terre. Smart filtering: excludes articles/blogs/PDFs, non-institutional paths, 20+ excluded domains. Returns ~6 actual firm websites.
- **Track C (Specialized sites)**: DISABLED — Aga Khan, CRAterre, etc. were timing out. Tool code kept but removed from workflow chain.

## SerpAPI Filtering
- `excludeDomains`: facebook, instagram, linkedin, youtube, twitter, wikipedia, plus ~20 news/academic sites
- `excludePatterns`: /blog/, /article/, /tag/, /focus/, /case/, /programme-de-construction, etc.
- `allowedPaths` whitelist: /, /atelier, /about, /projets, /services, /equipe, /contact, /accueil
- Skips .pdf URLs
- Logs all filtered-out results for debugging

## Database Schema
- **cabinets**: id (md5 of domain/name), nom, pays, ville, adresse, site_web, telephone, source, date_decouverte, statut
- **contacts**: cabinet_id (FK), email, confiance_email, methode_trouvaille, date_trouvaille. UNIQUE(cabinet_id, email)
- **qualifications**: cabinet_id (PK/FK), score, pertinent, raison, projet_recent, typologies, langue, date_qualification
- **scraping**: cabinet_id (FK), date_scraping, contenu_texte, mots_cles, projets_detectes, reussi

## Deduplication
- In-memory: normalized name dedup (lowercased, trimmed) + domain dedup during consolidation
- Against DB: domain match (cabinets.site_web) + normalized name match. On second+ runs, known firms are skipped entirely (no scraping, no Dust AI calls).
- DB writes: INSERT ON CONFLICT DO NOTHING for safe idempotency

## Performance
- First run (all new): ~3-4 minutes (scraping ~55s + Dust AI ~110s + rest ~30s)
- Subsequent runs (all known): ~60 seconds (discovery + dedup only, no scraping/AI)
- Google Places API: ~65-69 firms per run (billing enabled)
- SerpAPI: ~6 firms per run (after filtering)
- Consolidated unique: ~58-61 firms
- Dust AI: qualifies ~10/61 firms (score >= 3) in ~110s single batch call

## Environment Variables Required
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — Replit AI Integration (configured)
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` — Replit AI Integration (configured)
- `GOOGLE_PLACES_API_KEY` — Google Places API key (configured, billing enabled)
- `SERPAPI` — SerpAPI key for Google Search (configured, 250 free/month)
- `DUST_API_KEY` — Dust AI API key (configured)
- `DUST_WORKSPACE_ID` — Default: 3OUdFWdJIF
- `DUST_AGENT_ID` — Default: 3hKwn579Sc (must be shared/accessible via API)
- `DATABASE_URL` — PostgreSQL (configured)
- `EMAIL_RECIPIENT` — Default: michael@filtreplante.com
- `SCHEDULE_CRON_EXPRESSION` — Default: 0 15 * * 6

## Dependencies
- @mastra/core, @mastra/pg, @mastra/loggers
- @ai-sdk/anthropic
- inngest, hono, zod, pino, pg, crypto (Node built-in)
