import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const searchGooglePlacesTool = createTool({
  id: "search-google-places",
  description: "Search Google Places API for architecture firms in Senegal",
  inputSchema: z.object({
    placeholder: z.string().optional().describe("Placeholder"),
  }),
  outputSchema: z.object({
    firms: z.array(z.object({
      name: z.string(),
      address: z.string().optional(),
      phone: z.string().optional(),
      website: z.string().optional(),
      source: z.string(),
    })),
    count: z.number(),
  }),
  execute: async (inputData, context) => {
    const logger = context?.mastra?.getLogger();
    logger?.info("🔍 [searchGooglePlaces] Searching for architecture firms in Senegal...");

    const cities = ["Dakar", "Thiès", "Saint-Louis", "Kaolack", "Ziguinchor"];
    const queries = [
      "cabinet d'architecture",
      "architecte",
      "bureau d'études architecture",
      "architecture écologique",
    ];

    const firms: Array<{name: string; address?: string; phone?: string; website?: string; source: string}> = [];

    for (const city of cities) {
      for (const query of queries) {
        try {
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + " " + city + " Sénégal")}&num=10&hl=fr`;
          logger?.info(`🔍 [searchGooglePlaces] Searching: ${query} in ${city}`);

          const response = await fetch(searchUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept-Language": "fr-FR,fr;q=0.9",
            },
          });

          if (response.ok) {
            const html = await response.text();
            const urlMatches = html.match(/href="\/url\?q=(https?:\/\/[^&"]+)/g);
            if (urlMatches) {
              for (const match of urlMatches.slice(0, 3)) {
                const url = decodeURIComponent(match.replace('href="/url?q=', ""));
                if (!url.includes("google.") && !url.includes("youtube.") && !url.includes("wikipedia.")) {
                  try {
                    const domain = new URL(url).hostname.replace("www.", "");
                    if (!firms.find(f => f.website && f.website.includes(domain))) {
                      firms.push({
                        name: domain,
                        address: `${city}, Sénégal`,
                        website: url,
                        source: "Google Places",
                      });
                    }
                  } catch { /* skip invalid URL */ }
                }
              }
            }
          }
          await new Promise(r => setTimeout(r, 2000));
        } catch (err) {
          logger?.warn(`⚠️ [searchGooglePlaces] Error: ${err}`);
        }
      }
    }

    logger?.info(`✅ [searchGooglePlaces] Found ${firms.length} firms`);
    return { firms, count: firms.length };
  },
});

export const scrapeGoogleSearchTool = createTool({
  id: "scrape-google-search",
  description: "Scrape Google Search with targeted eco-friendly architecture queries for Senegal",
  inputSchema: z.object({
    placeholder: z.string().optional().describe("Placeholder"),
  }),
  outputSchema: z.object({
    firms: z.array(z.object({
      name: z.string(),
      website: z.string().optional(),
      snippet: z.string().optional(),
      source: z.string(),
    })),
    count: z.number(),
  }),
  execute: async (inputData, context) => {
    const logger = context?.mastra?.getLogger();
    logger?.info("🔍 [scrapeGoogleSearch] Scraping with eco queries...");

    const ecoQueries = [
      "architecture écologique Sénégal",
      "architecture durable Dakar",
      "éco-construction Sénégal",
      "architecte bioclimatique Sénégal",
      "BTC pisé architecture Sénégal",
      "architecture terre crue Sénégal",
      "construction durable Afrique de l'Ouest",
    ];

    const firms: Array<{name: string; website?: string; snippet?: string; source: string}> = [];

    for (const query of ecoQueries) {
      try {
        logger?.info(`🔍 [scrapeGoogleSearch] Query: ${query}`);
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&hl=fr`;

        const response = await fetch(searchUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "fr-FR,fr;q=0.9",
          },
        });

        if (response.ok) {
          const html = await response.text();
          const urlMatches = html.match(/href="\/url\?q=(https?:\/\/[^&"]+)/g);
          if (urlMatches) {
            for (const match of urlMatches.slice(0, 5)) {
              const url = decodeURIComponent(match.replace('href="/url?q=', ""));
              if (!url.includes("google.") && !url.includes("youtube.") && !url.includes("wikipedia.")) {
                try {
                  const domain = new URL(url).hostname.replace("www.", "");
                  if (!firms.find(f => f.website && f.website.includes(domain))) {
                    firms.push({ name: domain, website: url, source: "Google Search" });
                  }
                } catch { /* skip */ }
              }
            }
          }
        }
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        logger?.warn(`⚠️ [scrapeGoogleSearch] Error: ${err}`);
      }
    }

    logger?.info(`✅ [scrapeGoogleSearch] Found ${firms.length} firms`);
    return { firms, count: firms.length };
  },
});

export const extractFromSpecializedSitesTool = createTool({
  id: "extract-from-specialized-sites",
  description: "Scrape specialized sites: Aga Khan, CRAterre, LafargeHolcim, ASF, Afrik21",
  inputSchema: z.object({
    placeholder: z.string().optional().describe("Placeholder"),
  }),
  outputSchema: z.object({
    firms: z.array(z.object({
      name: z.string(),
      website: z.string().optional(),
      description: z.string().optional(),
      source: z.string(),
    })),
    count: z.number(),
  }),
  execute: async (inputData, context) => {
    const logger = context?.mastra?.getLogger();
    logger?.info("🔍 [extractSpecializedSites] Starting extraction from specialized sites...");

    const firms: Array<{name: string; website?: string; description?: string; source: string}> = [];

    const sources = [
      { name: "Aga Khan Award", urls: ["https://archnet.org/collections/34"], keywords: ["Senegal", "Sénégal", "Dakar", "West Africa"] },
      { name: "CRAterre", urls: ["https://craterre.org/"], keywords: ["Senegal", "Sénégal", "terre", "earth"] },
      { name: "LafargeHolcim Foundation", urls: ["https://www.lafargeholcim-foundation.org/projects"], keywords: ["Senegal", "Sénégal", "Africa"] },
      { name: "Architecture sans Frontières", urls: ["https://www.asf-france.com/projets/"], keywords: ["Senegal", "Sénégal", "Afrique"] },
      { name: "Afrik21", urls: ["https://www.afrik21.africa/tag/construction-durable/"], keywords: ["BTC", "pisé", "terre", "bioclimatique", "Sénégal"] },
    ];

    for (const source of sources) {
      for (const url of source.urls) {
        try {
          logger?.info(`🌐 [extractSpecializedSites] Fetching: ${url}`);
          const response = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept-Language": "fr-FR,fr;q=0.9",
            },
            signal: AbortSignal.timeout(15000),
          });

          if (response.ok) {
            const html = await response.text();
            const hasRelevant = source.keywords.some(kw => html.toLowerCase().includes(kw.toLowerCase()));

            if (hasRelevant) {
              const linkMatches = html.match(/href="(https?:\/\/[^"]+)"/g);
              if (linkMatches) {
                for (const match of linkMatches.slice(0, 10)) {
                  const linkUrl = match.replace('href="', "").replace('"', "");
                  if (!linkUrl.includes("google.") && !linkUrl.includes("facebook.") && !linkUrl.includes("twitter.")) {
                    try {
                      const domain = new URL(linkUrl).hostname.replace("www.", "");
                      if (!firms.find(f => f.website && f.website.includes(domain)) && !linkUrl.includes(new URL(url).hostname)) {
                        firms.push({
                          name: domain,
                          website: linkUrl,
                          description: `Discovered via ${source.name}`,
                          source: source.name,
                        });
                      }
                    } catch { /* skip */ }
                  }
                }
              }
            }
          }
          await new Promise(r => setTimeout(r, 1500));
        } catch (err) {
          logger?.warn(`⚠️ [extractSpecializedSites] Error: ${url}: ${err}`);
        }
      }
    }

    logger?.info(`✅ [extractSpecializedSites] Found ${firms.length} firms`);
    return { firms, count: firms.length };
  },
});

export const processFirmWebsiteTool = createTool({
  id: "process-firm-website",
  description: "Visit firm website and extract emails and text content",
  inputSchema: z.object({
    firmName: z.string().describe("Name of the firm"),
    websiteUrl: z.string().describe("URL of the firm website"),
  }),
  outputSchema: z.object({
    firmName: z.string(),
    websiteUrl: z.string(),
    emails: z.array(z.string()),
    websiteContent: z.string(),
  }),
  execute: async (inputData, context) => {
    const logger = context?.mastra?.getLogger();
    logger?.info(`📧 [processFirmWebsite] Processing: ${inputData.websiteUrl}`);

    const emails: string[] = [];
    let websiteContent = "";

    const pagesToCheck = [
      inputData.websiteUrl,
      inputData.websiteUrl.replace(/\/$/, "") + "/contact",
      inputData.websiteUrl.replace(/\/$/, "") + "/about",
      inputData.websiteUrl.replace(/\/$/, "") + "/a-propos",
    ];

    for (const pageUrl of pagesToCheck) {
      try {
        const response = await fetch(pageUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "fr-FR,fr;q=0.9",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const html = await response.text();
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const foundEmails = html.match(emailRegex) || [];
          for (const email of foundEmails) {
            const clean = email.toLowerCase().trim();
            if (!emails.includes(clean) && !clean.includes("example.com") && !clean.includes("wixpress") && !clean.includes("sentry.") && !clean.endsWith(".png") && !clean.endsWith(".jpg")) {
              emails.push(clean);
            }
          }
          const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          websiteContent += text.substring(0, 2000) + "\n";
        }
        await new Promise(r => setTimeout(r, 500));
      } catch { /* page not found or timeout */ }
    }

    logger?.info(`✅ [processFirmWebsite] Found ${emails.length} email(s) for ${inputData.firmName}`);
    return { firmName: inputData.firmName, websiteUrl: inputData.websiteUrl, emails, websiteContent: websiteContent.substring(0, 6000) };
  },
});

export const generateCsvTool = createTool({
  id: "generate-csv",
  description: "Generate CSV report of qualified prospects (score >= 3)",
  inputSchema: z.object({
    firmsJson: z.string().describe("JSON string of firms array"),
  }),
  outputSchema: z.object({
    csvContent: z.string(),
    csvPath: z.string(),
    totalCount: z.number(),
    qualifiedCount: z.number(),
  }),
  execute: async (inputData, context) => {
    const logger = context?.mastra?.getLogger();
    logger?.info("📊 [generateCsv] Generating CSV report...");

    let firms: any[] = [];
    try { firms = JSON.parse(inputData.firmsJson); } catch { firms = []; }

    const qualified = firms.filter((f: any) => f.score >= 3);
    const headers = "Nom,Site Web,Emails,Score,Pertinent,Raison,Projet Recent,Typologies,Langue,Source";
    const rows = qualified.map((f: any) =>
      [
        `"${(f.firmName || f.name || "").replace(/"/g, '""')}"`,
        `"${f.websiteUrl || f.website || ""}"`,
        `"${(f.emails || []).join("; ")}"`,
        f.score || "",
        f.pertinent || "",
        `"${(f.raison || "").replace(/"/g, '""')}"`,
        `"${(f.projet_recent || "").replace(/"/g, '""')}"`,
        `"${(f.typologies || []).join(", ")}"`,
        f.langue || "",
        `"${f.source || ""}"`,
      ].join(",")
    );

    const csvContent = headers + "\n" + rows.join("\n");
    const timestamp = new Date().toISOString().split("T")[0];
    const csvPath = `./qualified_prospects_${timestamp}.csv`;

    try {
      const fsModule = await import("fs");
      fsModule.writeFileSync(csvPath, csvContent, "utf-8");
      logger?.info(`✅ [generateCsv] CSV written to ${csvPath}`);
    } catch (err) {
      logger?.warn(`⚠️ [generateCsv] Could not write file: ${err}`);
    }

    logger?.info(`✅ [generateCsv] Total: ${firms.length}, Qualified: ${qualified.length}`);
    return { csvContent, csvPath, totalCount: firms.length, qualifiedCount: qualified.length };
  },
});

export const sendEmailTool = createTool({
  id: "send-email-summary",
  description: "Send summary email with CSV report to michael@filtreplante.com via Gmail",
  inputSchema: z.object({
    csvContent: z.string().describe("CSV content to attach"),
    totalFirms: z.number().describe("Total firms"),
    qualifiedFirms: z.number().describe("Qualified count"),
    summaryText: z.string().describe("Email body"),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    recipient: z.string(),
    messageId: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const logger = context?.mastra?.getLogger();
    const recipient = process.env.EMAIL_RECIPIENT || "michael@filtreplante.com";
    logger?.info(`📬 [sendEmail] Sending to ${recipient}`);
    logger?.info(`📬 [sendEmail] Total: ${inputData.totalFirms}, Qualified: ${inputData.qualifiedFirms}`);

    try {
      const { getUncachableGmailClient } = await import("./gmailClient");
      const gmail = await getUncachableGmailClient();

      const timestamp = new Date().toISOString().split("T")[0];
      const csvFilename = `prospects_qualifies_${timestamp}.csv`;
      const csvBase64 = Buffer.from(inputData.csvContent, "utf-8").toString("base64");

      const boundary = "boundary_" + Date.now();
      const subject = `FiltrePlante Prospection - ${inputData.qualifiedFirms} cabinets qualifiés (${timestamp})`;

      const rawEmail = [
        `To: ${recipient}`,
        `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        `Content-Transfer-Encoding: quoted-printable`,
        ``,
        inputData.summaryText,
        ``,
        `--${boundary}`,
        `Content-Type: text/csv; charset="UTF-8"; name="${csvFilename}"`,
        `Content-Disposition: attachment; filename="${csvFilename}"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        csvBase64,
        ``,
        `--${boundary}--`,
      ].join("\r\n");

      const encodedMessage = Buffer.from(rawEmail).toString("base64url");

      const result = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedMessage,
        },
      });

      logger?.info(`✅ [sendEmail] Email sent successfully. Message ID: ${result.data.id}`);
      return { sent: true, recipient, messageId: result.data.id || undefined };
    } catch (err) {
      logger?.error(`❌ [sendEmail] Failed to send email: ${err}`);
      logger?.info(`📋 [sendEmail] Fallback: email content logged for manual review`);
      return { sent: false, recipient, messageId: undefined };
    }
  },
});
