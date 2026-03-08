import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { automationAgent } from "../agents/agent";
import {
  searchGooglePlacesTool,
  scrapeGoogleSearchTool,
  extractFromSpecializedSitesTool,
  processFirmWebsiteTool,
  generateCsvTool,
  sendEmailTool,
} from "../tools/prospectingTools";
import { qualifyFirmWithDustAiTool } from "../tools/dustAiTool";

const firmSchema = z.object({
  name: z.string(),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  snippet: z.string().optional(),
  description: z.string().optional(),
  source: z.string(),
});

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
    logger?.info("🔍 [Step 2A] Searching Google Places...");

    const result = await searchGooglePlacesTool.execute({ placeholder: "" }, { mastra });
    if ("error" in result && result.error) {
      logger?.error(`❌ [Step 2A] Tool error: ${result.message}`);
      return { allFirmsJson: "[]", googlePlacesCount: 0 };
    }

    logger?.info(`✅ [Step 2A] Found ${result.count} firms from Google Places`);
    return { allFirmsJson: JSON.stringify(result.firms), googlePlacesCount: result.count };
  },
});

const scrapeGoogleSearch = createStep({
  id: "scrape-google-search",
  description: "Scrape Google Search with targeted eco-friendly queries",
  inputSchema: z.object({
    allFirmsJson: z.string(),
    googlePlacesCount: z.number(),
  }),
  outputSchema: z.object({
    allFirmsJson: z.string(),
    googlePlacesCount: z.number(),
    googleSearchCount: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔍 [Step 2B] Scraping Google Search with eco queries...");

    const result = await scrapeGoogleSearchTool.execute({ placeholder: "" }, { mastra });
    if ("error" in result && result.error) {
      logger?.error(`❌ [Step 2B] Tool error: ${result.message}`);
      return { ...inputData, googleSearchCount: 0 };
    }

    let existingFirms: any[] = [];
    try { existingFirms = JSON.parse(inputData.allFirmsJson); } catch { existingFirms = []; }

    const combined = [...existingFirms, ...result.firms];
    logger?.info(`✅ [Step 2B] Found ${result.count} firms from Google Search. Total: ${combined.length}`);
    return {
      allFirmsJson: JSON.stringify(combined),
      googlePlacesCount: inputData.googlePlacesCount,
      googleSearchCount: result.count,
    };
  },
});

const scrapeSpecializedSites = createStep({
  id: "scrape-specialized-sites",
  description: "Scrape specialized sites: Aga Khan, CRAterre, LafargeHolcim, ASF, Afrik21",
  inputSchema: z.object({
    allFirmsJson: z.string(),
    googlePlacesCount: z.number(),
    googleSearchCount: z.number(),
  }),
  outputSchema: z.object({
    allFirmsJson: z.string(),
    googlePlacesCount: z.number(),
    googleSearchCount: z.number(),
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
      googleSearchCount: inputData.googleSearchCount,
      specializedCount: result.count,
      totalBeforeDedup: combined.length,
    };
  },
});

const consolidateFirms = createStep({
  id: "consolidate-firms",
  description: "Deduplicate firms from all sources and prepare for processing",
  inputSchema: z.object({
    allFirmsJson: z.string(),
    googlePlacesCount: z.number(),
    googleSearchCount: z.number(),
    specializedCount: z.number(),
    totalBeforeDedup: z.number(),
  }),
  outputSchema: z.object({
    uniqueFirmsJson: z.string(),
    uniqueCount: z.number(),
    totalBeforeDedup: z.number(),
    processedFirmsJson: z.string(),
    currentIndex: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔄 [Step 3] Consolidating and deduplicating firms...");

    let allFirms: any[] = [];
    try { allFirms = JSON.parse(inputData.allFirmsJson); } catch { allFirms = []; }

    const unique = allFirms.reduce((acc: any[], firm: any) => {
      if (!firm.website) { acc.push(firm); return acc; }
      const normalized = firm.website.toLowerCase().trim();
      if (!acc.find((f: any) => f.website && f.website.toLowerCase().trim() === normalized)) {
        acc.push(firm);
      }
      return acc;
    }, []);

    logger?.info(`📊 [Step 3] Sources: Places=${inputData.googlePlacesCount}, Search=${inputData.googleSearchCount}, Specialized=${inputData.specializedCount}`);
    logger?.info(`📊 [Step 3] Before dedup: ${inputData.totalBeforeDedup}, After: ${unique.length}`);

    return {
      uniqueFirmsJson: JSON.stringify(unique),
      uniqueCount: unique.length,
      totalBeforeDedup: inputData.totalBeforeDedup,
      processedFirmsJson: "[]",
      currentIndex: 0,
    };
  },
});

const processArchitectureFirm = createStep({
  id: "process-architecture-firm",
  description: "Extract emails, qualify with Dust AI, and store each firm",
  inputSchema: z.object({
    uniqueFirmsJson: z.string(),
    uniqueCount: z.number(),
    totalBeforeDedup: z.number(),
    processedFirmsJson: z.string(),
    currentIndex: z.number(),
  }),
  outputSchema: z.object({
    processedFirmsJson: z.string(),
    processedCount: z.number(),
    totalBeforeDedup: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🏢 [Step 4] Processing architecture firms...");

    let firms: any[] = [];
    try { firms = JSON.parse(inputData.uniqueFirmsJson); } catch { firms = []; }

    const processedFirms: any[] = [];

    for (let i = 0; i < firms.length; i++) {
      const firm = firms[i];
      const firmName = firm.name || "Unknown";
      const websiteUrl = firm.website || "";

      logger?.info(`\n🏢 [Step 4] Processing ${i + 1}/${firms.length}: ${firmName}`);

      if (!websiteUrl) {
        logger?.info(`   ⚠️ No website, skipping`);
        processedFirms.push({
          firmName, websiteUrl: "N/A", emails: [], source: firm.source || "",
          score: 1, pertinent: false, raison: "No website available",
          projet_recent: null, typologies: [], langue: "fr",
        });
        continue;
      }

      logger?.info(`   📧 Extracting emails from ${websiteUrl}...`);
      const websiteResult = await processFirmWebsiteTool.execute(
        { firmName, websiteUrl }, { mastra }
      );

      let emails: string[] = [];
      let websiteContent = "";
      if (!("error" in websiteResult && websiteResult.error)) {
        emails = websiteResult.emails;
        websiteContent = websiteResult.websiteContent;
      }
      logger?.info(`   Found ${emails.length} email(s)`);

      logger?.info(`   🤖 Qualifying with Dust AI...`);
      const qualResult = await qualifyFirmWithDustAiTool.execute(
        {
          firmName,
          websiteUrl,
          websiteContent,
          emails: JSON.stringify(emails),
          source: firm.source || "",
        },
        { mastra }
      );

      if (!("error" in qualResult && qualResult.error)) {
        const icon = qualResult.pertinent ? "✅" : "❌";
        logger?.info(`   ${icon} Score: ${qualResult.score}/5, Qualified: ${qualResult.pertinent}`);
        processedFirms.push(qualResult);
      } else {
        logger?.warn(`   ⚠️ Qualification failed for ${firmName}`);
        processedFirms.push({
          firmName, websiteUrl, emails, source: firm.source || "",
          score: 1, pertinent: false, raison: "Qualification failed",
          projet_recent: null, typologies: [], langue: "fr",
        });
      }
    }

    logger?.info(`\n✅ [Step 4] Processed ${processedFirms.length} firms`);
    const qualified = processedFirms.filter(f => f.pertinent);
    logger?.info(`   Qualified (score >= 3): ${qualified.length}/${processedFirms.length}`);

    return {
      processedFirmsJson: JSON.stringify(processedFirms),
      processedCount: processedFirms.length,
      totalBeforeDedup: inputData.totalBeforeDedup,
    };
  },
});

const generateCsvReport = createStep({
  id: "generate-csv-report",
  description: "Generate CSV report of qualified prospects (score >= 3)",
  inputSchema: z.object({
    processedFirmsJson: z.string(),
    processedCount: z.number(),
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
    logger?.info("📊 [Step 5] Generating CSV report...");

    const result = await generateCsvTool.execute(
      { firmsJson: inputData.processedFirmsJson }, { mastra }
    );

    if ("error" in result && result.error) {
      logger?.error(`❌ [Step 5] CSV generation failed: ${result.message}`);
      return {
        csvContent: "", csvPath: "", totalCount: 0, qualifiedCount: 0,
        totalBeforeDedup: inputData.totalBeforeDedup,
      };
    }

    logger?.info(`✅ [Step 5] CSV generated: ${result.csvPath}`);
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
    logger?.info("📬 [Step 6] Sending email summary...");

    const qualRate = inputData.totalCount > 0
      ? Math.round((inputData.qualifiedCount / inputData.totalCount) * 100)
      : 0;

    const summaryText = `Prospection Automatique Bi-Hebdomadaire - ${new Date().toLocaleDateString("fr-FR")}

Résultats:
- Cabinets découverts (avant dédup): ${inputData.totalBeforeDedup}
- Cabinets uniques traités: ${inputData.totalCount}
- Cabinets qualifiés (score >= 3): ${inputData.qualifiedCount}
- Taux de qualification: ${qualRate}%

Sources: Google Places, Google Search, Aga Khan Award, CRAterre, LafargeHolcim Foundation, Architecture sans Frontières, Afrik21

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
      logger?.error(`❌ [Step 6] Email failed: ${result.message}`);
      return { sent: false, recipient: "michael@filtreplante.com", summary: summaryText, messageId: undefined };
    }

    logger?.info(`✅ [Step 6] Email sent to ${result.recipient}`);
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
  .then(scrapeGoogleSearch as any)
  .then(scrapeSpecializedSites as any)
  .then(consolidateFirms as any)
  .then(processArchitectureFirm as any)
  .then(generateCsvReport as any)
  .then(sendEmailSummary as any)
  .commit();
