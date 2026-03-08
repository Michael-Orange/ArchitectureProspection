import { Agent } from "@mastra/core/agent";
import { createAnthropic } from "@ai-sdk/anthropic";

import {
  searchGooglePlacesTool,
  scrapeGoogleSearchTool,
  extractFromSpecializedSitesTool,
  scrapeFirmWebsitesTool,
  generateCsvTool,
  sendEmailTool,
} from "../tools/prospectingTools";
import { qualifyDustBatchTool } from "../tools/dustAiTool";
import {
  initDbSchemaTool,
  deduplicateAgainstDbTool,
  writeToDbTool,
  getDbStatsTool,
} from "../tools/databaseTools";

const anthropic = createAnthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
});

export const automationAgent = new Agent({
  name: "Eco Architect Prospecting Agent",
  id: "automationAgent",
  instructions: `Tu es un agent expert en prospection de cabinets d'architecture écologique au Sénégal.

Ta mission est d'orchestrer la découverte et la qualification de cabinets d'architecture spécialisés en construction écologique (BTC, pisé, terre crue, bioclimatique).

Quand on te demande d'exécuter le workflow :
1. Utilise les outils de recherche pour découvrir des cabinets (Google Places API, SerpAPI)
2. Déduplique contre la base de données PostgreSQL (ne traite que les nouveaux)
3. Scrape en profondeur les sites web des nouveaux cabinets (emails, contenu, mots-clés écologiques)
4. Qualifie tous les cabinets en batch via Dust AI (score 1-5)
5. Persiste les résultats en BDD (cabinets, contacts, qualifications, scraping)
6. Génère un rapport CSV des cabinets qualifiés (score >= 3)
7. Envoie le rapport par email avec statistiques BDD

Score Dust AI (1-5) :
- 1-2 : Non qualifié
- 3-5 : Qualifié (exporté dans le CSV)

Track C (sites spécialisés) est temporairement désactivé.

Sois méthodique et priorise la qualité des prospects.`,

  model: anthropic("claude-sonnet-4-6"),

  tools: {
    searchGooglePlacesTool,
    scrapeGoogleSearchTool,
    extractFromSpecializedSitesTool,
    scrapeFirmWebsitesTool,
    qualifyDustBatchTool,
    generateCsvTool,
    sendEmailTool,
    initDbSchemaTool,
    deduplicateAgainstDbTool,
    writeToDbTool,
    getDbStatsTool,
  },
});
