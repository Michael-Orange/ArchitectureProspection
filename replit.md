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
- `src/mastra/tools/prospectingTools.ts` — Google Places, Google Search, specialized sites, email extraction, CSV generation, email sending
- `src/mastra/tools/dustAiTool.ts` — Dust AI qualification tool (score 1-5)
- `src/mastra/storage/index.ts` — Shared PostgreSQL storage
- `src/mastra/inngest/index.ts` — Inngest integration (createStep, createWorkflow)
- `src/triggers/cronTriggers.ts` — Cron trigger registration

## Workflow Steps
1. Initialize database
2. Search Google Places (5 cities x 4 queries)
3. Scrape Google Search (7 eco-focused queries)
4. Extract from specialized sites (Aga Khan, CRAterre, LafargeHolcim, ASF, Afrik21)
5. Consolidate & deduplicate
6. Process each firm (extract emails + Dust AI qualify)
7. Generate CSV (score >= 3 only)
8. Send email summary to michael@filtreplante.com

## Environment Variables Required
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — Replit AI Integration (configured)
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` — Replit AI Integration (configured)
- `DUST_API_KEY` — Dust AI API key (needs valid key)
- `DUST_WORKSPACE_ID` — Default: 3OUdFWdJIF
- `DUST_AGENT_ID` — Default: 3hKwn579Sc
- `DATABASE_URL` — PostgreSQL (configured)
- `EMAIL_RECIPIENT` — Default: michael@filtreplante.com
- `SCHEDULE_CRON_EXPRESSION` — Default: 0 15 * * 6

## Dependencies
- @mastra/core, @mastra/pg, @mastra/loggers
- @ai-sdk/anthropic
- inngest, hono, zod, pino
