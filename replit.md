# FiltrePlante-Prospection

## Overview
Automated bi-weekly Mastra/Inngest workflow that discovers and qualifies ecological architecture firms in Senegal, then emails a CSV report to michael@filtreplante.com.

## Architecture
- **Framework**: Mastra 1.0.1 with Inngest for workflow orchestration
- **LLM**: Anthropic Claude (via Replit AI Integrations) for the agent
- **Qualification**: Dust AI API (score 1-5, qualified if >= 3)
- **Trigger**: Cron `0 15 * * 6` (every Saturday at 15:00 UTC)
- **Database**: PostgreSQL (via DATABASE_URL)
- **Email**: Gmail connector (conn_google-mail_01KK78T346G7GQ7AGD2MQX1X5C)

## Key Files
- `src/mastra/index.ts` — Main Mastra instance, cron registration, server config
- `src/mastra/agents/agent.ts` — Anthropic-powered prospecting agent with all tools
- `src/mastra/workflows/workflow.ts` — 8-step sequential workflow
- `src/mastra/tools/prospectingTools.ts` — Google Places API, SerpAPI Search, specialized sites, email extraction, CSV generation, email sending
- `src/mastra/tools/dustAiTool.ts` — Dust AI qualification tool (score 1-5, with retry for rate limits)
- `src/mastra/tools/gmailClient.ts` — Gmail OAuth client (getUncachableGmailClient)
- `src/mastra/storage/index.ts` — Shared PostgreSQL storage
- `src/mastra/inngest/index.ts` — Inngest integration (createStep, createWorkflow)
- `src/triggers/cronTriggers.ts` — Cron trigger registration

## Workflow Steps
1. Initialize database
2. Track A: Google Places API (6 country-level queries for architecture firms in Senegal)
3. Track B: SerpAPI Google Search (5 eco-focused queries with specific material keywords)
4. Track C: Specialized sites (Aga Khan, CRAterre, LafargeHolcim, ASF, Afrik21)
5. Consolidate & deduplicate
6. Process each firm (extract emails + Dust AI qualify with 5s delay between calls + retry on rate limit)
7. Generate CSV (score >= 3 only)
8. Send email summary to michael@filtreplante.com

## Environment Variables Required
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — Replit AI Integration (configured)
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` — Replit AI Integration (configured)
- `GOOGLE_PLACES_API_KEY` — Google Places API key (configured)
- `SERPAPI` — SerpAPI key for Google Search (configured, 250 free/month)
- `DUST_API_KEY` — Dust AI API key (configured)
- `DUST_WORKSPACE_ID` — Default: 3OUdFWdJIF
- `DUST_AGENT_ID` — Default: 3hKwn579Sc
- `DATABASE_URL` — PostgreSQL (configured)
- `EMAIL_RECIPIENT` — Default: michael@filtreplante.com
- `SCHEDULE_CRON_EXPRESSION` — Default: 0 15 * * 6

## Dependencies
- @mastra/core, @mastra/pg, @mastra/loggers
- @ai-sdk/anthropic
- inngest, hono, zod, pino
