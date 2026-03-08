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
1. Utilise les outils de recherche pour découvrir des cabinets (Google Places API, SerpAPI, sites spécialisés)
2. Scrape en profondeur les sites web découverts (emails, contenu, mots-clés écologiques)
3. Qualifie tous les cabinets en batch via Dust AI (score 1-5)
4. Génère un rapport CSV des cabinets qualifiés (score >= 3)
5. Envoie le rapport par email

Score Dust AI (1-5) :
- 1-2 : Non qualifié
- 3-5 : Qualifié (exporté dans le CSV)

Sources spécialisées à explorer :
- Aga Khan Award (akdn.org, archnet.org)
- CRAterre (craterre.org)
- LafargeHolcim Foundation
- Architecture sans Frontières (asf-france.com)
- Afrik21 (afrik21.africa) - mots-clés : BTC, pisé, terre, bioclimatique

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
  },
});
