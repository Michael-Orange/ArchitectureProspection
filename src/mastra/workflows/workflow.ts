import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { automationAgent } from "../agents/agent";
import {
  searchGooglePlacesTool,
  scrapeGoogleSearchTool,
  extractFromSpecializedSitesTool,
  scrapeFirmWebsitesTool,
  generateCsvTool,
  sendEmailTool,
} from "../tools/prospectingTools";
import { qualifyDustBatchTool } from "../tools/dustAiTool";

const initializeDatabase = createStep({
  id: "initialize-database",
  description: "Initialize database and prepare for prospecting run",
  inputSchema: z.object({}).passthrough(),
  outputSchema: z.object({
    runDate: z.string(),
    dbReady: z.boolean(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("💾 [Step 1] Initializing database...");
    const runDate = new Date().toISOString();
    logger?.info(`📅 [Step 1] Run date: ${runDate}`);
    return { runDate, dbReady: true };
  },
});

const searchGooglePlaces = createStep({
  id: "search-google-places",
  description: "Search Google Places API for architecture firms in Senegal",
  inputSchema: z.object({
    runDate: z.string(),
    dbReady: z.boolean(),
  }),
  outputSchema: z.object({
    allFirmsJson: z.string(),
    googlePlacesCount: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔍 [Step 2A] Searching Google Places API...");

    const result = await searchGooglePlacesTool.execute({ placeholder: "" }, { mastra });
    if ("error" in result && result.error) {
      logger?.error(`❌ [Step 2A] Tool error: ${result.message}`);
      return { allFirmsJson: "[]", googlePlacesCount: 0 };
    }

    logger?.info(`✅ [Step 2A] Found ${result.count} firms from Google Places API`);
    return { allFirmsJson: JSON.stringify(result.firms), googlePlacesCount: result.count };
  },
});

const scrapeGoogleSearchSerpAPI = createStep({
  id: "scrape-google-search-serpapi",
  description: "Search for eco-focused architecture firms using SerpAPI",
  inputSchema: z.object({
    allFirmsJson: z.string(),
    googlePlacesCount: z.number(),
  }),
  outputSchema: z.object({
    allFirmsJson: z.string(),
    googlePlacesCount: z.number(),
    serpApiCount: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔍 [Step 2B] Searching SerpAPI with eco queries...");

    const result = await scrapeGoogleSearchTool.execute({ placeholder: "" }, { mastra });
    if ("error" in result && result.error) {
      logger?.error(`❌ [Step 2B] Tool error: ${result.message}`);
      return { ...inputData, serpApiCount: 0 };
    }

    let existingFirms: any[] = [];
    try { existingFirms = JSON.parse(inputData.allFirmsJson); } catch { existingFirms = []; }

    const combined = [...existingFirms, ...result.firms];
    logger?.info(`✅ [Step 2B] Found ${result.count} firms from SerpAPI. Total: ${combined.length}`);
    return {
      allFirmsJson: JSON.stringify(combined),
      googlePlacesCount: inputData.googlePlacesCount,
      serpApiCount: result.count,
    };
  },
});

const scrapeSpecializedSites = createStep({
  id: "scrape-specialized-sites",
  description: "Scrape specialized sites: Aga Khan, CRAterre, LafargeHolcim, ASF, Afrik21",
  inputSchema: z.object({
    allFirmsJson: z.string(),
    googlePlacesCount: z.number(),
    serpApiCount: z.number(),
  }),
  outputSchema: z.object({
    allFirmsJson: z.string(),
    googlePlacesCount: z.number(),
    serpApiCount: z.number(),
    specializedCount: z.number(),
    totalBeforeDedup: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔍 [Step 2C] Extracting from specialized sites...");
    logger?.info("   Aga Khan Award | CRAterre | LafargeHolcim | ASF | Afrik21");

    const result = await extractFromSpecializedSitesTool.execute({ placeholder: "" }, { mastra });
    if ("error" in result && result.error) {
      logger?.error(`❌ [Step 2C] Tool error: ${result.message}`);
      let existing: any[] = [];
      try { existing = JSON.parse(inputData.allFirmsJson); } catch { existing = []; }
      return { ...inputData, specializedCount: 0, totalBeforeDedup: existing.length };
    }

    let existingFirms: any[] = [];
    try { existingFirms = JSON.parse(inputData.allFirmsJson); } catch { existingFirms = []; }

    const combined = [...existingFirms, ...result.firms];
    logger?.info(`✅ [Step 2C] Found ${result.count} firms from specialized sites. Total: ${combined.length}`);
    return {
      allFirmsJson: JSON.stringify(combined),
      googlePlacesCount: inputData.googlePlacesCount,
      serpApiCount: inputData.serpApiCount,
      specializedCount: result.count,
      totalBeforeDedup: combined.length,
    };
  },
});

const consolidateFirms = createStep({
  id: "consolidate-firms",
  description: "Deduplicate firms from all sources",
  inputSchema: z.object({
    allFirmsJson: z.string(),
    googlePlacesCount: z.number(),
    serpApiCount: z.number(),
    specializedCount: z.number(),
    totalBeforeDedup: z.number(),
  }),
  outputSchema: z.object({
    uniqueFirmsJson: z.string(),
    uniqueCount: z.number(),
    totalBeforeDedup: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔄 [Step 3] Consolidating and deduplicating firms...");

    let allFirms: any[] = [];
    try { allFirms = JSON.parse(inputData.allFirmsJson); } catch { allFirms = []; }

    const unique = allFirms.reduce((acc: any[], firm: any) => {
      if (!firm.website) { acc.push(firm); return acc; }
      try {
        const domain = new URL(firm.website).hostname.replace("www.", "").toLowerCase();
        if (!acc.find((f: any) => {
          if (!f.website) return false;
          try { return new URL(f.website).hostname.replace("www.", "").toLowerCase() === domain; } catch { return false; }
        })) {
          acc.push(firm);
        }
      } catch {
        acc.push(firm);
      }
      return acc;
    }, []);

    logger?.info(`📊 [Step 3] Sources: Places=${inputData.googlePlacesCount}, SerpAPI=${inputData.serpApiCount}, Specialized=${inputData.specializedCount}`);
    logger?.info(`📊 [Step 3] Before dedup: ${inputData.totalBeforeDedup}, After: ${unique.length}`);

    return {
      uniqueFirmsJson: JSON.stringify(unique),
      uniqueCount: unique.length,
      totalBeforeDedup: inputData.totalBeforeDedup,
    };
  },
});

const scrapeAndQualify = createStep({
  id: "scrape-and-qualify",
  description: "Deep scrape all firm websites then batch qualify with Dust AI in a single step",
  inputSchema: z.object({
    uniqueFirmsJson: z.string(),
    uniqueCount: z.number(),
    totalBeforeDedup: z.number(),
  }),
  outputSchema: z.object({
    qualifiedFirmsJson: z.string(),
    qualifiedCount: z.number(),
    totalCount: z.number(),
    totalBeforeDedup: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();

    logger?.info(`🌐 [Step 4] Deep scraping ${inputData.uniqueCount} firm websites...`);
    const scrapeResult = await scrapeFirmWebsitesTool.execute(
      { firmsJson: inputData.uniqueFirmsJson }, { mastra }
    );

    let scrapedFirmsJson = inputData.uniqueFirmsJson;
    if (!("error" in scrapeResult && scrapeResult.error)) {
      scrapedFirmsJson = scrapeResult.firmsJson;
      logger?.info(`✅ [Step 4] Scraped ${scrapeResult.scrapedCount}/${scrapeResult.totalCount} websites successfully`);
    } else {
      logger?.warn(`⚠️ [Step 4] Scraping error, proceeding with raw data`);
    }

    logger?.info(`🤖 [Step 5] Batch qualifying ${inputData.uniqueCount} firms with Dust AI...`);
    const dustResult = await qualifyDustBatchTool.execute(
      { firmsJson: scrapedFirmsJson }, { mastra }
    );

    if ("error" in dustResult && dustResult.error) {
      logger?.error(`❌ [Step 5] Dust batch error: ${dustResult.message}`);
      return {
        qualifiedFirmsJson: scrapedFirmsJson,
        qualifiedCount: 0,
        totalCount: inputData.uniqueCount,
        totalBeforeDedup: inputData.totalBeforeDedup,
      };
    }

    logger?.info(`✅ [Step 5] Qualified: ${dustResult.qualifiedCount}/${dustResult.totalCount} (score >= 3)`);

    let qualifiedFirms: any[] = [];
    try { qualifiedFirms = JSON.parse(dustResult.firmsJson); } catch { qualifiedFirms = []; }
    const compactFirms = qualifiedFirms.map((f: any) => ({
      firmName: f.firmName || f.name || "Unknown",
      name: f.name || f.firmName || "Unknown",
      websiteUrl: f.websiteUrl || f.website || "",
      website: f.website || f.websiteUrl || "",
      emails: f.emails || [],
      source: f.source || "",
      score: f.score || 1,
      pertinent: f.pertinent || false,
      raison: f.raison || "",
      projet_recent: f.projet_recent || null,
      typologies: f.typologies || [],
      langue: f.langue || "fr",
    }));

    return {
      qualifiedFirmsJson: JSON.stringify(compactFirms),
      qualifiedCount: dustResult.qualifiedCount,
      totalCount: dustResult.totalCount,
      totalBeforeDedup: inputData.totalBeforeDedup,
    };
  },
});

const generateCsvReport = createStep({
  id: "generate-csv-report",
  description: "Generate CSV report of qualified prospects (score >= 3)",
  inputSchema: z.object({
    qualifiedFirmsJson: z.string(),
    qualifiedCount: z.number(),
    totalCount: z.number(),
    totalBeforeDedup: z.number(),
  }),
  outputSchema: z.object({
    csvContent: z.string(),
    csvPath: z.string(),
    totalCount: z.number(),
    qualifiedCount: z.number(),
    totalBeforeDedup: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📊 [Step 6] Generating CSV report...");

    const result = await generateCsvTool.execute(
      { firmsJson: inputData.qualifiedFirmsJson }, { mastra }
    );

    if ("error" in result && result.error) {
      logger?.error(`❌ [Step 6] CSV generation failed: ${result.message}`);
      return {
        csvContent: "", csvPath: "", totalCount: 0, qualifiedCount: 0,
        totalBeforeDedup: inputData.totalBeforeDedup,
      };
    }

    logger?.info(`✅ [Step 6] CSV generated: ${result.csvPath}`);
    logger?.info(`   Total: ${result.totalCount}, Qualified: ${result.qualifiedCount}`);

    return {
      csvContent: result.csvContent,
      csvPath: result.csvPath,
      totalCount: result.totalCount,
      qualifiedCount: result.qualifiedCount,
      totalBeforeDedup: inputData.totalBeforeDedup,
    };
  },
});

const sendEmailSummary = createStep({
  id: "send-email-summary",
  description: "Send email with CSV report to michael@filtreplante.com",
  inputSchema: z.object({
    csvContent: z.string(),
    csvPath: z.string(),
    totalCount: z.number(),
    qualifiedCount: z.number(),
    totalBeforeDedup: z.number(),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    recipient: z.string(),
    summary: z.string(),
    messageId: z.string().optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📬 [Step 7] Sending email summary...");

    const qualRate = inputData.totalCount > 0
      ? Math.round((inputData.qualifiedCount / inputData.totalCount) * 100)
      : 0;

    const summaryText = `Prospection Automatique Bi-Hebdomadaire - ${new Date().toLocaleDateString("fr-FR")}

Résultats:
- Cabinets découverts (avant dédup): ${inputData.totalBeforeDedup}
- Cabinets uniques traités: ${inputData.totalCount}
- Cabinets qualifiés (score >= 3): ${inputData.qualifiedCount}
- Taux de qualification: ${qualRate}%

Sources: Google Places API, SerpAPI Google Search, Aga Khan Award, CRAterre, LafargeHolcim Foundation, Architecture sans Frontières, Afrik21

Qualification Dust AI (score 1-5):
- 1-2: Non qualifié
- 3-5: Qualifié et exporté dans le CSV

CSV: ${inputData.csvPath}`;

    const result = await sendEmailTool.execute(
      {
        csvContent: inputData.csvContent,
        totalFirms: inputData.totalCount,
        qualifiedFirms: inputData.qualifiedCount,
        summaryText,
      },
      { mastra }
    );

    if ("error" in result && result.error) {
      logger?.error(`❌ [Step 7] Email failed: ${result.message}`);
      return { sent: false, recipient: "michael@filtreplante.com", summary: summaryText, messageId: undefined };
    }

    logger?.info(`✅ [Step 7] Email sent to ${result.recipient}`);
    return { sent: result.sent, recipient: result.recipient, summary: summaryText, messageId: result.messageId };
  },
});

export const automationWorkflow = createWorkflow({
  id: "automation-workflow",
  inputSchema: z.object({}).passthrough() as any,
  outputSchema: z.object({
    sent: z.boolean(),
    recipient: z.string(),
    summary: z.string(),
    messageId: z.string().optional(),
  }),
})
  .then(initializeDatabase as any)
  .then(searchGooglePlaces as any)
  .then(scrapeGoogleSearchSerpAPI as any)
  .then(scrapeSpecializedSites as any)
  .then(consolidateFirms as any)
  .then(scrapeAndQualify as any)
  .then(generateCsvReport as any)
  .then(sendEmailSummary as any)
  .commit();
