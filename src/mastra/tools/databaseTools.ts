import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import pg from "pg";
import crypto from "crypto";

function getPool(): pg.Pool {
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
    max: 5,
    idleTimeoutMillis: 30000,
  });
}

function cabinetId(domain: string | undefined, name: string): string {
  const key = domain && domain.trim() ? domain.trim().toLowerCase() : name.trim().toLowerCase();
  return crypto.createHash("md5").update(key).digest("hex");
}

export const initDbSchemaTool = createTool({
  id: "init-db-schema",
  description: "Create PostgreSQL tables for cabinets persistence if they do not exist",
  inputSchema: z.object({
    placeholder: z.string().optional().describe("Placeholder"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    tablesCreated: z.array(z.string()),
    errorMessage: z.string().optional(),
  }),
  execute: async (_inputData, context) => {
    const logger = context?.mastra?.getLogger();
    logger?.info("🗄️ [initDbSchema] Initializing database schema...");

    const pool = getPool();
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cabinets (
          id TEXT PRIMARY KEY,
          nom TEXT NOT NULL,
          pays TEXT DEFAULT 'Sénégal',
          ville TEXT,
          adresse TEXT,
          site_web TEXT,
          telephone TEXT,
          source TEXT NOT NULL,
          date_decouverte DATE NOT NULL,
          statut TEXT DEFAULT 'nouveau'
        );
      `);
      logger?.info("   ✅ Table cabinets created/verified");

      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_cabinets_site_web ON cabinets(site_web) WHERE site_web IS NOT NULL;
      `);
      logger?.info("   ✅ Index idx_cabinets_site_web created/verified");

      await pool.query(`
        CREATE TABLE IF NOT EXISTS contacts (
          id SERIAL PRIMARY KEY,
          cabinet_id TEXT NOT NULL REFERENCES cabinets(id),
          email TEXT NOT NULL,
          confiance_email INTEGER DEFAULT 80,
          methode_trouvaille TEXT DEFAULT 'scraping',
          date_trouvaille DATE,
          UNIQUE(cabinet_id, email)
        );
      `);
      logger?.info("   ✅ Table contacts created/verified");

      await pool.query(`
        CREATE TABLE IF NOT EXISTS qualifications (
          cabinet_id TEXT PRIMARY KEY REFERENCES cabinets(id),
          score INTEGER NOT NULL,
          pertinent BOOLEAN,
          raison TEXT,
          projet_recent TEXT,
          typologies TEXT,
          langue TEXT DEFAULT 'fr',
          date_qualification DATE
        );
      `);
      logger?.info("   ✅ Table qualifications created/verified");

      await pool.query(`
        CREATE TABLE IF NOT EXISTS scraping (
          id SERIAL PRIMARY KEY,
          cabinet_id TEXT NOT NULL REFERENCES cabinets(id),
          date_scraping DATE,
          contenu_texte TEXT,
          mots_cles TEXT,
          projets_detectes TEXT,
          reussi BOOLEAN
        );
      `);
      logger?.info("   ✅ Table scraping created/verified");

      logger?.info("✅ [initDbSchema] All tables created/verified successfully");
      return { success: true, tablesCreated: ["cabinets", "contacts", "qualifications", "scraping"] };
    } catch (err: any) {
      logger?.error(`❌ [initDbSchema] Error creating schema: ${err.message}`);
      return { success: false, tablesCreated: [], errorMessage: err.message };
    } finally {
      await pool.end();
    }
  },
});

export const deduplicateAgainstDbTool = createTool({
  id: "deduplicate-against-db",
  description: "Check firms against existing cabinets in DB by domain, return only NEW firms not already persisted",
  inputSchema: z.object({
    firmsJson: z.string().describe("JSON string of firms array"),
  }),
  outputSchema: z.object({
    newFirmsJson: z.string(),
    newCount: z.number(),
    existingCount: z.number(),
    totalInput: z.number(),
  }),
  execute: async (inputData, context) => {
    const logger = context?.mastra?.getLogger();
    logger?.info("🔍 [deduplicateAgainstDb] Checking firms against database...");

    let firms: any[] = [];
    try { firms = JSON.parse(inputData.firmsJson); } catch { firms = []; }

    if (firms.length === 0) {
      logger?.warn("⚠️ [deduplicateAgainstDb] No firms to deduplicate");
      return { newFirmsJson: "[]", newCount: 0, existingCount: 0, totalInput: 0 };
    }

    const pool = getPool();
    try {
      const existingResult = await pool.query("SELECT id, site_web FROM cabinets");
      const existingIds = new Set(existingResult.rows.map((r: any) => r.id));
      const existingDomains = new Set(
        existingResult.rows
          .filter((r: any) => r.site_web)
          .map((r: any) => {
            try {
              return new URL(r.site_web.startsWith("http") ? r.site_web : `https://${r.site_web}`).hostname.replace("www.", "").toLowerCase();
            } catch {
              return r.site_web.toLowerCase();
            }
          })
      );

      logger?.info(`   📊 Found ${existingIds.size} existing cabinets in DB (${existingDomains.size} with domains)`);

      const newFirms: any[] = [];
      let existingCount = 0;

      for (const firm of firms) {
        let domain = "";
        const website = firm.website || "";
        if (website) {
          try {
            domain = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace("www.", "").toLowerCase();
          } catch { /* skip */ }
        }

        const id = cabinetId(domain, firm.name || "");

        if (existingIds.has(id) || (domain && existingDomains.has(domain))) {
          existingCount++;
          logger?.info(`   ⏭️ Already in DB: ${firm.name || domain}`);
        } else {
          newFirms.push(firm);
          logger?.info(`   🆕 New firm: ${firm.name || domain}`);
        }
      }

      logger?.info(`✅ [deduplicateAgainstDb] ${newFirms.length} new firms, ${existingCount} already in DB (out of ${firms.length} total)`);
      return {
        newFirmsJson: JSON.stringify(newFirms),
        newCount: newFirms.length,
        existingCount,
        totalInput: firms.length,
      };
    } catch (err: any) {
      logger?.error(`❌ [deduplicateAgainstDb] DB error: ${err.message}`);
      logger?.info("🔄 [deduplicateAgainstDb] Returning all firms as new (DB unavailable)");
      return {
        newFirmsJson: JSON.stringify(firms),
        newCount: firms.length,
        existingCount: 0,
        totalInput: firms.length,
      };
    } finally {
      await pool.end();
    }
  },
});

export const writeToDbTool = createTool({
  id: "write-to-db",
  description: "Persist qualified firms to PostgreSQL: cabinets, contacts, qualifications, scraping tables",
  inputSchema: z.object({
    firmsJson: z.string().describe("JSON string of qualified firms array"),
  }),
  outputSchema: z.object({
    cabinetCount: z.number(),
    contactCount: z.number(),
    qualificationCount: z.number(),
    scrapingCount: z.number(),
    errorMessage: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const logger = context?.mastra?.getLogger();
    logger?.info("💾 [writeToDb] Writing qualified firms to database...");

    let firms: any[] = [];
    try { firms = JSON.parse(inputData.firmsJson); } catch { firms = []; }

    if (firms.length === 0) {
      logger?.warn("⚠️ [writeToDb] No firms to write");
      return { cabinetCount: 0, contactCount: 0, qualificationCount: 0, scrapingCount: 0 };
    }

    const pool = getPool();
    let cabinetCount = 0;
    let contactCount = 0;
    let qualificationCount = 0;
    let scrapingCount = 0;

    try {
      const today = new Date().toISOString().split("T")[0];

      for (const firm of firms) {
        const website = firm.websiteUrl || firm.website || "";
        let domain = "";
        if (website) {
          try {
            domain = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace("www.", "").toLowerCase();
          } catch { /* skip */ }
        }

        const id = cabinetId(domain, firm.firmName || firm.name || "");
        const nom = firm.firmName || firm.name || "Unknown";

        let ville = "";
        const address = firm.address || "";
        if (address) {
          const parts = address.split(",");
          ville = parts.length > 1 ? parts[parts.length - 2]?.trim() || "" : "";
        }

        try {
          const cabRes = await pool.query(
            `INSERT INTO cabinets (id, nom, pays, ville, adresse, site_web, telephone, source, date_decouverte, statut)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO NOTHING`,
            [id, nom, "Sénégal", ville || null, address || null, website || null, firm.phone || null, firm.source || "Unknown", today, "nouveau"]
          );
          if (cabRes.rowCount && cabRes.rowCount > 0) cabinetCount++;
          logger?.info(`   💾 Cabinet: ${nom} (${id.substring(0, 8)}...)`);
        } catch (err: any) {
          logger?.warn(`   ⚠️ Cabinet insert error for ${nom}: ${err.message}`);
        }

        const emails = firm.emails || [];
        for (const email of emails) {
          try {
            const ctRes = await pool.query(
              `INSERT INTO contacts (cabinet_id, email, confiance_email, methode_trouvaille, date_trouvaille)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (cabinet_id, email) DO NOTHING`,
              [id, email.toLowerCase().trim(), 80, "scraping", today]
            );
            if (ctRes.rowCount && ctRes.rowCount > 0) contactCount++;
          } catch (err: any) {
            logger?.warn(`   ⚠️ Contact insert error: ${err.message}`);
          }
        }

        const score = firm.score || 0;
        if (score > 0) {
          try {
            const qRes = await pool.query(
              `INSERT INTO qualifications (cabinet_id, score, pertinent, raison, projet_recent, typologies, langue, date_qualification)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (cabinet_id) DO NOTHING`,
              [
                id,
                score,
                firm.pertinent || false,
                firm.raison || null,
                firm.projet_recent || null,
                Array.isArray(firm.typologies) ? firm.typologies.join(", ") : (firm.typologies || null),
                firm.langue || "fr",
                today,
              ]
            );
            if (qRes.rowCount && qRes.rowCount > 0) qualificationCount++;
          } catch (err: any) {
            logger?.warn(`   ⚠️ Qualification insert error: ${err.message}`);
          }
        }

        if (firm.scrapedContent || firm.keywords?.length > 0) {
          try {
            const scRes = await pool.query(
              `INSERT INTO scraping (cabinet_id, date_scraping, contenu_texte, mots_cles, projets_detectes, reussi)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                id,
                today,
                (firm.scrapedContent || "").substring(0, 5000),
                Array.isArray(firm.keywords) ? firm.keywords.join(", ") : (firm.keywords || null),
                Array.isArray(firm.projects) ? firm.projects.join(", ") : (firm.projects || null),
                firm.scrapingSuccess || false,
              ]
            );
            if (scRes.rowCount && scRes.rowCount > 0) scrapingCount++;
          } catch (err: any) {
            logger?.warn(`   ⚠️ Scraping insert error: ${err.message}`);
          }
        }
      }

      logger?.info(`✅ [writeToDb] Written: ${cabinetCount} cabinets, ${contactCount} contacts, ${qualificationCount} qualifications, ${scrapingCount} scraping records`);
      return { cabinetCount, contactCount, qualificationCount, scrapingCount };
    } catch (err: any) {
      logger?.error(`❌ [writeToDb] Error: ${err.message}`);
      return { cabinetCount, contactCount, qualificationCount, scrapingCount, errorMessage: err.message };
    } finally {
      await pool.end();
    }
  },
});

export const getDbStatsTool = createTool({
  id: "get-db-stats",
  description: "Get statistics from the database: total cabinets, contacts, qualifications, etc.",
  inputSchema: z.object({
    placeholder: z.string().optional().describe("Placeholder"),
  }),
  outputSchema: z.object({
    totalCabinets: z.number(),
    totalContacts: z.number(),
    totalQualifications: z.number(),
    totalQualified: z.number(),
    totalScraping: z.number(),
    errorMessage: z.string().optional(),
  }),
  execute: async (_inputData, context) => {
    const logger = context?.mastra?.getLogger();
    logger?.info("📊 [getDbStats] Fetching database statistics...");

    const pool = getPool();
    try {
      const cabinetsResult = await pool.query("SELECT COUNT(*) as count FROM cabinets");
      const contactsResult = await pool.query("SELECT COUNT(*) as count FROM contacts");
      const qualificationsResult = await pool.query("SELECT COUNT(*) as count FROM qualifications");
      const qualifiedResult = await pool.query("SELECT COUNT(*) as count FROM qualifications WHERE score >= 3");
      const scrapingResult = await pool.query("SELECT COUNT(*) as count FROM scraping");

      const stats = {
        totalCabinets: parseInt(cabinetsResult.rows[0].count, 10),
        totalContacts: parseInt(contactsResult.rows[0].count, 10),
        totalQualifications: parseInt(qualificationsResult.rows[0].count, 10),
        totalQualified: parseInt(qualifiedResult.rows[0].count, 10),
        totalScraping: parseInt(scrapingResult.rows[0].count, 10),
      };

      logger?.info(`📊 [getDbStats] Stats: ${stats.totalCabinets} cabinets, ${stats.totalContacts} contacts, ${stats.totalQualified} qualified (score>=3), ${stats.totalScraping} scraping records`);
      return stats;
    } catch (err: any) {
      logger?.error(`❌ [getDbStats] Error: ${err.message}`);
      return { totalCabinets: 0, totalContacts: 0, totalQualifications: 0, totalQualified: 0, totalScraping: 0, errorMessage: err.message };
    } finally {
      await pool.end();
    }
  },
});
