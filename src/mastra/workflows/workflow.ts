import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { automationAgent } from "../agents/agent";
import {
  searchGooglePlacesTool,
  scrapeGoogleSearchTool,
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

const initializeDatabase = createStep({
  id: "initialize-database",
  description: "Initialize PostgreSQL schema and prepare for prospecting run",
  inputSchema: z.object({}).passthrough(),
  outputSchema: z.object({
    runDate: z.string(),
    dbReady: z.boolean(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("💾 [Step 1] Initializing database schema...");

    const schemaResult = await initDbSchemaTool.execute({ placeholder: "" }, { mastra });
    if ("errorMessage" in schemaResult && schemaResult.errorMessage) {
      logger?.error(`❌ [Step 1] Schema init failed: ${schemaResult.errorMessage}`);
    } else {
      logger?.info(`✅ [Step 1] Schema ready: ${schemaResult.tablesCreated?.join(", ")}`);
    }

    const runDate = new Date().toISOString();
    logger?.info(`📅 [Step 1] Run date: ${runDate}`);
    return { runDate, dbReady: schemaResult.success };
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
    totalBeforeDedup: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔍 [Step 2B] Searching SerpAPI with eco queries...");

    const result = await scrapeGoogleSearchTool.execute({ placeholder: "" }, { mastra });
    if ("error" in result && result.error) {
      logger?.error(`❌ [Step 2B] Tool error: ${result.message}`);
      let existing: any[] = [];
      try { existing = JSON.parse(inputData.allFirmsJson); } catch { existing = []; }
      return { ...inputData, serpApiCount: 0, totalBeforeDedup: existing.length };
    }

    let existingFirms: any[] = [];
    try { existingFirms = JSON.parse(inputData.allFirmsJson); } catch { existingFirms = []; }

    const combined = [...existingFirms, ...result.firms];
    logger?.info(`✅ [Step 2B] Found ${result.count} firms from SerpAPI. Total: ${combined.length}`);
    return {
      allFirmsJson: JSON.stringify(combined),
      googlePlacesCount: inputData.googlePlacesCount,
      serpApiCount: result.count,
      totalBeforeDedup: combined.length,
    };
  },
});

const consolidateFirms = createStep({
  id: "consolidate-firms",
  description: "Deduplicate firms from all sources (domain-based)",
  inputSchema: z.object({
    allFirmsJson: z.string(),
    googlePlacesCount: z.number(),
    serpApiCount: z.number(),
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

    const seenDomains = new Set<string>();
    const seenNames = new Set<string>();
    const unique: any[] = [];

    for (const firm of allFirms) {
      const normName = (firm.name || "").trim().toLowerCase().replace(/[^a-z0-9àâäéèêëïîôùûüÿçœæ]/g, "");

      if (firm.website) {
        try {
          const domain = new URL(firm.website).hostname.replace("www.", "").toLowerCase();
          if (seenDomains.has(domain)) {
            logger?.info(`   ⏭️ Duplicate domain: ${domain} (${firm.name})`);
            continue;
          }
          seenDomains.add(domain);
        } catch { /* keep */ }
      } else {
        if (seenNames.has(normName)) {
          logger?.info(`   ⏭️ Duplicate name: ${firm.name}`);
          continue;
        }
      }

      if (normName) seenNames.add(normName);
      unique.push(firm);
    }

    logger?.info(`📊 [Step 3] Sources: Places=${inputData.googlePlacesCount}, SerpAPI=${inputData.serpApiCount}`);
    logger?.info(`📊 [Step 3] Before dedup: ${inputData.totalBeforeDedup}, After: ${unique.length}`);

    return {
      uniqueFirmsJson: JSON.stringify(unique),
      uniqueCount: unique.length,
      totalBeforeDedup: inputData.totalBeforeDedup,
    };
  },
});

const deduplicateAgainstDb = createStep({
  id: "deduplicate-against-db",
  description: "Check firms against PostgreSQL to find only NEW firms not yet in database",
  inputSchema: z.object({
    uniqueFirmsJson: z.string(),
    uniqueCount: z.number(),
    totalBeforeDedup: z.number(),
  }),
  outputSchema: z.object({
    newFirmsJson: z.string(),
    newCount: z.number(),
    existingInDb: z.number(),
    uniqueCount: z.number(),
    totalBeforeDedup: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info(`🔍 [Step 3B] Deduplicating ${inputData.uniqueCount} firms against database...`);

    const result = await deduplicateAgainstDbTool.execute(
      { firmsJson: inputData.uniqueFirmsJson }, { mastra }
    );

    logger?.info(`✅ [Step 3B] New firms: ${result.newCount}, Already in DB: ${result.existingCount}`);

    return {
      newFirmsJson: result.newFirmsJson,
      newCount: result.newCount,
      existingInDb: result.existingCount,
      uniqueCount: inputData.uniqueCount,
      totalBeforeDedup: inputData.totalBeforeDedup,
    };
  },
});

const scrapeAndQualify = createStep({
  id: "scrape-and-qualify",
  description: "Deep scrape new firm websites then batch qualify with Dust AI in a single step",
  inputSchema: z.object({
    newFirmsJson: z.string(),
    newCount: z.number(),
    existingInDb: z.number(),
    uniqueCount: z.number(),
    totalBeforeDedup: z.number(),
  }),
  outputSchema: z.object({
    qualifiedFirmsJson: z.string(),
    qualifiedCount: z.number(),
    totalCount: z.number(),
    existingInDb: z.number(),
    totalBeforeDedup: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();

    if (inputData.newCount === 0) {
      logger?.info("ℹ️ [Step 4+5] No new firms to process — all already in database");
      return {
        qualifiedFirmsJson: "[]",
        qualifiedCount: 0,
        totalCount: 0,
        existingInDb: inputData.existingInDb,
        totalBeforeDedup: inputData.totalBeforeDedup,
      };
    }

    logger?.info(`🌐 [Step 4] Deep scraping ${inputData.newCount} NEW firm websites...`);
    const scrapeResult = await scrapeFirmWebsitesTool.execute(
      { firmsJson: inputData.newFirmsJson }, { mastra }
    );

    let scrapedFirmsJson = inputData.newFirmsJson;
    if (!("error" in scrapeResult && scrapeResult.error)) {
      scrapedFirmsJson = scrapeResult.firmsJson;
      logger?.info(`✅ [Step 4] Scraped ${scrapeResult.scrapedCount}/${scrapeResult.totalCount} websites successfully`);
    } else {
      logger?.warn(`⚠️ [Step 4] Scraping error, proceeding with raw data`);
    }

    logger?.info(`🤖 [Step 5] Batch qualifying ${inputData.newCount} firms with Dust AI...`);
    const dustResult = await qualifyDustBatchTool.execute(
      { firmsJson: scrapedFirmsJson }, { mastra }
    );

    if ("error" in dustResult && dustResult.error) {
      logger?.error(`❌ [Step 5] Dust batch error: ${dustResult.message}`);
      return {
        qualifiedFirmsJson: scrapedFirmsJson,
        qualifiedCount: 0,
        totalCount: inputData.newCount,
        existingInDb: inputData.existingInDb,
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
      phone: f.phone || "",
      address: f.address || "",
      source: f.source || "",
      score: f.score || 1,
      pertinent: f.pertinent || false,
      raison: f.raison || "",
      projet_recent: f.projet_recent || null,
      typologies: f.typologies || [],
      langue: f.langue || "fr",
      scrapedContent: f.scrapedContent || "",
      keywords: f.keywords || [],
      projects: f.projects || [],
      scrapingSuccess: f.scrapingSuccess || false,
    }));

    return {
      qualifiedFirmsJson: JSON.stringify(compactFirms),
      qualifiedCount: dustResult.qualifiedCount,
      totalCount: dustResult.totalCount,
      existingInDb: inputData.existingInDb,
      totalBeforeDedup: inputData.totalBeforeDedup,
    };
  },
});

const writeToDb = createStep({
  id: "write-to-db",
  description: "Persist all qualified firms to PostgreSQL database",
  inputSchema: z.object({
    qualifiedFirmsJson: z.string(),
    qualifiedCount: z.number(),
    totalCount: z.number(),
    existingInDb: z.number(),
    totalBeforeDedup: z.number(),
  }),
  outputSchema: z.object({
    qualifiedFirmsJson: z.string(),
    qualifiedCount: z.number(),
    totalCount: z.number(),
    existingInDb: z.number(),
    totalBeforeDedup: z.number(),
    dbWritten: z.number(),
    dbContacts: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("💾 [Step 6] Writing qualified firms to database...");

    let firms: any[] = [];
    try { firms = JSON.parse(inputData.qualifiedFirmsJson); } catch { firms = []; }

    if (firms.length === 0) {
      logger?.info("ℹ️ [Step 6] No firms to write to database");
      return { ...inputData, dbWritten: 0, dbContacts: 0 };
    }

    const result = await writeToDbTool.execute(
      { firmsJson: inputData.qualifiedFirmsJson }, { mastra }
    );

    if (result.errorMessage) {
      logger?.warn(`⚠️ [Step 6] DB write had errors: ${result.errorMessage}`);
    }

    logger?.info(`✅ [Step 6] DB written: ${result.cabinetCount} cabinets, ${result.contactCount} contacts, ${result.qualificationCount} qualifications, ${result.scrapingCount} scraping`);

    return {
      ...inputData,
      dbWritten: result.cabinetCount,
      dbContacts: result.contactCount,
    };
  },
});

const generateCsvReport = createStep({
  id: "generate-csv-report",
  description: "Generate CSV report of NEW qualified prospects (score >= 3)",
  inputSchema: z.object({
    qualifiedFirmsJson: z.string(),
    qualifiedCount: z.number(),
    totalCount: z.number(),
    existingInDb: z.number(),
    totalBeforeDedup: z.number(),
    dbWritten: z.number(),
    dbContacts: z.number(),
  }),
  outputSchema: z.object({
    csvContent: z.string(),
    csvPath: z.string(),
    totalCount: z.number(),
    qualifiedCount: z.number(),
    existingInDb: z.number(),
    totalBeforeDedup: z.number(),
    dbWritten: z.number(),
    dbContacts: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📊 [Step 7] Generating CSV report of NEW qualified firms...");

    const result = await generateCsvTool.execute(
      { firmsJson: inputData.qualifiedFirmsJson }, { mastra }
    );

    if ("error" in result && result.error) {
      logger?.error(`❌ [Step 7] CSV generation failed: ${result.message}`);
      return {
        csvContent: "", csvPath: "",
        totalCount: inputData.totalCount,
        qualifiedCount: inputData.qualifiedCount,
        existingInDb: inputData.existingInDb,
        totalBeforeDedup: inputData.totalBeforeDedup,
        dbWritten: inputData.dbWritten,
        dbContacts: inputData.dbContacts,
      };
    }

    logger?.info(`✅ [Step 7] CSV generated: ${result.csvPath}`);
    logger?.info(`   Total new: ${result.totalCount}, Qualified: ${result.qualifiedCount}`);

    return {
      csvContent: result.csvContent,
      csvPath: result.csvPath,
      totalCount: result.totalCount,
      qualifiedCount: result.qualifiedCount,
      existingInDb: inputData.existingInDb,
      totalBeforeDedup: inputData.totalBeforeDedup,
      dbWritten: inputData.dbWritten,
      dbContacts: inputData.dbContacts,
    };
  },
});

const sendEmailSummary = createStep({
  id: "send-email-summary",
  description: "Send email with CSV report and DB stats to michael@filtreplante.com",
  inputSchema: z.object({
    csvContent: z.string(),
    csvPath: z.string(),
    totalCount: z.number(),
    qualifiedCount: z.number(),
    existingInDb: z.number(),
    totalBeforeDedup: z.number(),
    dbWritten: z.number(),
    dbContacts: z.number(),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    recipient: z.string(),
    summary: z.string(),
    messageId: z.string().optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📬 [Step 8] Sending email summary with DB stats...");

    let dbStats = { totalCabinets: 0, totalContacts: 0, totalQualifications: 0, totalQualified: 0, totalScraping: 0 };
    try {
      dbStats = await getDbStatsTool.execute({ placeholder: "" }, { mastra });
      logger?.info(`📊 [Step 8] DB stats: ${dbStats.totalCabinets} total cabinets, ${dbStats.totalQualified} qualified`);
    } catch (err: any) {
      logger?.warn(`⚠️ [Step 8] Could not fetch DB stats: ${err.message}`);
    }

    const qualRate = inputData.totalCount > 0
      ? Math.round((inputData.qualifiedCount / inputData.totalCount) * 100)
      : 0;

    const summaryText = `Prospection Automatique Bi-Hebdomadaire — ${new Date().toLocaleDateString("fr-FR")}

═══ NOUVEAUX PROSPECTS (cette exécution) ═══
- Cabinets découverts (avant dédup): ${inputData.totalBeforeDedup}
- Déjà connus en BDD: ${inputData.existingInDb}
- Nouveaux cabinets traités: ${inputData.totalCount}
- Nouveaux qualifiés (score ≥ 3): ${inputData.qualifiedCount}
- Taux de qualification: ${qualRate}%
- Écrits en BDD: ${inputData.dbWritten} cabinets, ${inputData.dbContacts} contacts

═══ TOTAUX EN BASE DE DONNÉES ═══
- Total cabinets: ${dbStats.totalCabinets}
- Total contacts: ${dbStats.totalContacts}
- Total qualifiés (score ≥ 3): ${dbStats.totalQualified}

Sources: Google Places API, SerpAPI Google Search
Track C (sites spécialisés) désactivé temporairement.

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
      logger?.error(`❌ [Step 8] Email failed: ${result.message}`);
      return { sent: false, recipient: "michael@filtreplante.com", summary: summaryText, messageId: undefined };
    }

    logger?.info(`✅ [Step 8] Email sent to ${result.recipient}`);
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
  .then(consolidateFirms as any)
  .then(deduplicateAgainstDb as any)
  .then(scrapeAndQualify as any)
  .then(writeToDb as any)
  .then(generateCsvReport as any)
  .then(sendEmailSummary as any)
  .commit();
