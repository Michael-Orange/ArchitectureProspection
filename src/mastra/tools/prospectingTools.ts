import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
];

function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  await new Promise(r => setTimeout(r, delay));
}

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
    logger?.info("🔍 [searchGooglePlaces] Searching via Google Places API...");

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      logger?.error("❌ [searchGooglePlaces] GOOGLE_PLACES_API_KEY not set");
      return { firms: [], count: 0 };
    }

    const queries = [
      "cabinet architecture Sénégal",
      "architecte Sénégal",
      "bureau architecture Sénégal",
      "architectural firm Senegal",
      "architecture durable Sénégal",
      "éco-construction Sénégal",
    ];

    const firms: Array<{name: string; address?: string; phone?: string; website?: string; source: string}> = [];
    const seenDomains = new Set<string>();

    for (const query of queries) {
      try {
        const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?` +
          `query=${encodeURIComponent(query)}` +
          `&key=${apiKey}` +
          `&language=fr`;

        logger?.info(`🔍 [searchGooglePlaces] Query: ${query}`);
        const response = await fetch(placesUrl);
        const data = await response.json();

        if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
          logger?.warn(`⚠️ [searchGooglePlaces] API status: ${data.status} - ${data.error_message || ""}`);
          continue;
        }

        logger?.info(`   📍 Got ${(data.results || []).length} places`);

        for (const place of data.results || []) {
          try {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?` +
              `place_id=${place.place_id}` +
              `&fields=name,formatted_address,website,formatted_phone_number` +
              `&key=${apiKey}`;

            const detailsResponse = await fetch(detailsUrl);
            const details = await detailsResponse.json();

            if (details.status !== "OK") continue;

            const r = details.result;
            const website = r.website || "";
            let domain = "";

            if (website) {
              try {
                domain = new URL(website).hostname.replace("www.", "");
              } catch { /* skip */ }
            }

            if (domain && seenDomains.has(domain)) continue;
            if (domain) seenDomains.add(domain);

            firms.push({
              name: r.name || place.name,
              address: r.formatted_address || place.formatted_address || "Sénégal",
              phone: r.formatted_phone_number || undefined,
              website: website || undefined,
              source: "Google Places API",
            });

            logger?.info(`   ✅ ${r.name} | ${website || "no website"}`);
            await new Promise(r => setTimeout(r, 500));
          } catch (err) {
            logger?.warn(`   ⚠️ Detail fetch error: ${err}`);
          }
        }

        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        logger?.warn(`⚠️ [searchGooglePlaces] Error for "${query}": ${err}`);
      }
    }

    logger?.info(`✅ [searchGooglePlaces] Found ${firms.length} unique firms`);
    return { firms, count: firms.length };
  },
});

export const scrapeGoogleSearchTool = createTool({
  id: "scrape-google-search",
  description: "Search for eco-focused architecture firms in Senegal using SerpAPI",
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
    logger?.info("🔍 [serpApiSearch] Searching via SerpAPI...");

    const apiKey = process.env.SERPAPI;
    if (!apiKey) {
      logger?.error("❌ [serpApiSearch] SERPAPI key not set");
      return { firms: [], count: 0 };
    }

    const ecoQueries = [
      'architecte "BTC" OR "brique de terre comprimée" Sénégal',
      'cabinet architecture "pisé" OR "terre crue" Sénégal',
      'construction "matériaux locaux" OR "bio-sourcés" Sénégal',
      '"architecture bioclimatique" OR "éco-construction" Sénégal',
      '"CRAterre" OR "architecture en terre" Sénégal',
      'architecte français projet Sénégal "développement durable"',
      '"architecture firm" OR "cabinet" project Senegal sustainable',
      '"Aga Khan Award" OR "LafargeHolcim" architecture Senegal project',
    ];

    const excludeDomains = [
      "wikipedia", "archdaily", "pinterest", "facebook", "linkedin", "youtube", "twitter", "instagram",
      "climate-chance.org", "rfi.fr", "dw.com", "africanews.com", "mongabay.com", "construction21.org",
      "scribd.com", "semanticscholar.org", "hal.science", "investissementimmoafrique.com", "resaud.net",
      "vegetal-e.com", "peeb.build", "techtitute.com", "reseauf3e.org", "enviroboite.net",
      "ideassonline.org", "craterre.hypotheses.org", "afrik21.africa",
    ];

    const excludePatterns = [
      "/la-construction/", "/focus/", "/bonne-pratique/", "/case/", "/programme-de-construction",
      "/darchitecture-en-terre-crue", "/blog/", "/article/", "/tag/", "/podcasts/", "/video-",
      "/wp-content/", "/presentation/",
    ];

    const allowedPaths = ["/", "/atelier", "/about", "/projets", "/services", "/presentation", "/equipe", "/contact", "/accueil"];

    const firms: Array<{name: string; website?: string; snippet?: string; source: string}> = [];
    const seenDomains = new Set<string>();

    for (const query of ecoQueries) {
      try {
        const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=10`;

        logger?.info(`🔍 [serpApiSearch] Query: ${query}`);
        const response = await fetch(serpUrl);
        const data = await response.json();

        if (data.error) {
          logger?.warn(`⚠️ [serpApiSearch] API error: ${data.error}`);
          continue;
        }

        const results = data.organic_results || [];
        logger?.info(`   📄 Got ${results.length} organic results`);

        for (const result of results) {
          try {
            const url = new URL(result.link);
            const domain = url.hostname.replace("www.", "");
            const urlPath = url.pathname.replace(/\/$/, "") || "/";

            if (excludeDomains.some(d => domain.includes(d))) {
              logger?.info(`   🚫 Filtered (excluded domain): ${domain} — ${result.title}`);
              continue;
            }

            if (result.link.toLowerCase().endsWith(".pdf")) {
              logger?.info(`   🚫 Filtered (PDF): ${result.link}`);
              continue;
            }

            if (excludePatterns.some(p => url.pathname.toLowerCase().includes(p))) {
              logger?.info(`   🚫 Filtered (article/blog pattern): ${url.pathname} — ${result.title}`);
              continue;
            }

            const isAllowedPath = allowedPaths.some(ap => urlPath === ap || urlPath.startsWith(ap + "/")) || urlPath === "/";
            if (!isAllowedPath) {
              logger?.info(`   🚫 Filtered (non-institutional path): ${urlPath} — ${result.title}`);
              continue;
            }

            if (seenDomains.has(domain)) continue;
            seenDomains.add(domain);

            let cleanName = result.title || domain;
            cleanName = cleanName.replace(/\s*[-|:].*$/, "").trim();
            if (!cleanName) cleanName = domain;

            firms.push({
              name: cleanName,
              website: result.link,
              snippet: result.snippet || "",
              source: "SerpAPI Google Search",
            });

            logger?.info(`   ✅ ${cleanName}`);
          } catch { /* skip invalid URL */ }
        }

        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        logger?.warn(`⚠️ [serpApiSearch] Error for query: ${err}`);
      }
    }

    logger?.info(`✅ [serpApiSearch] Found ${firms.length} unique firms`);
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
      { name: "Aga Khan Award", urls: ["https://archnet.org/collections/34"], keywords: ["Senegal", "Sénégal", "Dakar", "West Africa", "Afrique de l'Ouest", "Sahel"] },
      { name: "CRAterre", urls: ["https://craterre.org/"], keywords: ["Senegal", "Sénégal", "terre", "earth", "Sahel", "UEMOA", "projet"] },
      { name: "LafargeHolcim Foundation", urls: ["https://www.lafargeholcim-foundation.org/projects"], keywords: ["Senegal", "Sénégal", "Africa", "Afrique", "Sahel", "WAEMU"] },
      { name: "Architecture sans Frontières", urls: ["https://www.asf-france.com/projets/"], keywords: ["Senegal", "Sénégal", "Afrique", "Sahel", "projet Sénégal", "project Senegal"] },
      { name: "Afrik21", urls: ["https://www.afrik21.africa/tag/construction-durable/"], keywords: ["BTC", "pisé", "terre", "bioclimatique", "Sénégal", "Senegal", "Sahel"] },
    ];

    const slowSites = ["lafargeholcim", "afrik21"];

    for (const source of sources) {
      for (const url of source.urls) {
        try {
          const ua = getRandomUA();
          const isSlow = slowSites.some(s => url.includes(s));
          const timeout = isSlow ? 30000 : 15000;
          logger?.info(`🌐 [extractSpecializedSites] Fetching: ${url} (timeout: ${timeout / 1000}s)`);
          const response = await fetch(url, {
            headers: {
              "User-Agent": ua,
              "Accept-Language": "fr-FR,fr;q=0.9",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            signal: AbortSignal.timeout(timeout),
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

export const scrapeFirmWebsitesTool = createTool({
  id: "scrape-firm-websites",
  description: "Deep scraping of all firm websites to extract content, emails, keywords and projects",
  inputSchema: z.object({
    firmsJson: z.string().describe("JSON string of firms array to scrape"),
  }),
  outputSchema: z.object({
    firmsJson: z.string(),
    scrapedCount: z.number(),
    totalCount: z.number(),
  }),
  execute: async (inputData, context) => {
    const logger = context?.mastra?.getLogger();
    logger?.info("🌐 [scrapeFirmWebsites] Starting deep scraping of firm websites...");

    let firms: any[] = [];
    try { firms = JSON.parse(inputData.firmsJson); } catch { firms = []; }

    const ecoKeywords = [
      "BTC", "brique de terre comprimée", "pisé", "terre crue",
      "adobe", "banco", "bioclimatique", "durable", "écologique",
      "HQE", "LEED", "BREEAM", "matériaux locaux", "bio-sourcés",
      "développement durable", "éco-construction", "CRAterre",
    ];

    const emailExcludes = ["example.com", "example.", "test@", "noreply@", "no-reply@", "wixpress", "sentry.", "cloudflare", "googleapis"];
    const skipDomains = [
      "scribd.com", "semanticscholar.org", "researchrepository.ilo.org", "hal.science",
      "mongabay.com", "rfi.fr", "dw.com", "africanews.com", "construction21.org", "whc.unesco.org",
      "climate-chance.org", "investissementimmoafrique.com", "resaud.net", "vegetal-e.com",
      "peeb.build", "techtitute.com", "reseauf3e.org", "enviroboite.net", "ideassonline.org",
      "craterre.hypotheses.org", "afrik21.africa",
      "wikipedia.org", "archdaily.com", "pinterest.com", "facebook.com", "linkedin.com",
      "youtube.com", "twitter.com", "instagram.com",
    ];
    const scrapedFirms: any[] = [];

    const scrapeSingleFirm = async (firm: any, index: number): Promise<any> => {
      const firmName = firm.name || "Unknown";
      const website = firm.website || "";

      if (!website) {
        return { ...firm, scrapedContent: "", keywords: [], projects: [], emails: [], scrapingSuccess: false };
      }

      try {
        const urlObj = new URL(website);
        const domain = urlObj.hostname.replace("www.", "").toLowerCase();
        if (skipDomains.some(sd => domain.includes(sd)) || website.endsWith(".pdf")) {
          logger?.info(`   ⏭️ [${index + 1}/${firms.length}] ${firmName} — non-scrapable URL, skipping`);
          return { ...firm, scrapedContent: firm.snippet || "", keywords: [], projects: [], emails: [], scrapingSuccess: false };
        }
      } catch {
        return { ...firm, scrapedContent: "", keywords: [], projects: [], emails: [], scrapingSuccess: false };
      }

      logger?.info(`   🌐 [${index + 1}/${firms.length}] Scraping: ${firmName}`);

      try {
        const baseUrl = website.replace(/\/$/, "");

        const contactPages = [
          `${baseUrl}/contact`,
          `${baseUrl}/contact-us`,
          `${baseUrl}/contactez-nous`,
          `${baseUrl}/nous-contacter`,
          `${baseUrl}/fr/contact`,
          `${baseUrl}/en/contact`,
        ];
        const contentPages = [
          baseUrl,
          `${baseUrl}/about`,
          `${baseUrl}/a-propos`,
          `${baseUrl}/equipe`,
          `${baseUrl}/team`,
          `${baseUrl}/projets`,
          `${baseUrl}/realisations`,
          `${baseUrl}/projects`,
          `${baseUrl}/portfolio`,
        ];

        let fullContent = "";
        const foundEmails: string[] = [];
        const foundKeywords = new Set<string>();
        const foundProjects: string[] = [];

        const fetchPage = async (pageUrl: string): Promise<string | null> => {
          try {
            const response = await fetch(pageUrl, {
              headers: {
                "User-Agent": getRandomUA(),
                "Accept-Language": "fr-FR,fr;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              },
              signal: AbortSignal.timeout(6000),
            });
            if (!response.ok) return null;
            const contentType = response.headers.get("content-type") || "";
            if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return null;
            return await response.text();
          } catch { return null; }
        };

        const extractEmails = (html: string) => {
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const emails = html.match(emailRegex) || [];
          for (const email of emails) {
            const clean = email.toLowerCase().trim();
            if (!foundEmails.includes(clean) && !emailExcludes.some(ex => clean.includes(ex)) && !clean.endsWith(".png") && !clean.endsWith(".jpg") && !clean.endsWith(".svg")) {
              foundEmails.push(clean);
            }
          }
        };

        const extractContent = (html: string) => {
          const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 1500);

          fullContent += text + " ";

          ecoKeywords.forEach(kw => {
            if (text.toLowerCase().includes(kw.toLowerCase())) {
              foundKeywords.add(kw);
            }
          });

          const projectMatches = text.match(/(?:projet|réalisation|project|chantier)\s+([A-ZÀ-Ÿ][a-zà-ÿA-ZÀ-Ÿ\s-]{3,30})/gi);
          if (projectMatches) {
            for (const pm of projectMatches.slice(0, 3)) {
              if (!foundProjects.includes(pm.trim())) foundProjects.push(pm.trim());
            }
          }
        };

        let emailsFoundOnContact = false;
        for (const contactUrl of contactPages) {
          const html = await fetchPage(contactUrl);
          if (html) {
            extractEmails(html);
            extractContent(html);
            if (foundEmails.length > 0) {
              emailsFoundOnContact = true;
              logger?.info(`      📧 Found ${foundEmails.length} email(s) on ${contactUrl}`);
              break;
            }
          }
          await new Promise(r => setTimeout(r, 150));
        }

        let pagesVisited = 0;
        const maxContentPages = 3;
        for (const pageUrl of contentPages) {
          if (pagesVisited >= maxContentPages) break;
          const html = await fetchPage(pageUrl);
          if (html) {
            extractEmails(html);
            extractContent(html);
            pagesVisited++;
          }
          await new Promise(r => setTimeout(r, 200));
        }

        const scrapingSuccess = fullContent.trim().length > 100;
        logger?.info(`      ✅ ${scrapingSuccess ? "OK" : "PARTIAL"}: ${fullContent.trim().length} chars, ${foundKeywords.size} kw, ${foundEmails.length} emails`);

        return {
          ...firm,
          scrapedContent: fullContent.trim().substring(0, 1500),
          keywords: Array.from(foundKeywords),
          projects: foundProjects,
          emails: foundEmails,
          scrapingSuccess,
        };
      } catch (err) {
        logger?.warn(`      ⚠️ Error: ${err}`);
        return { ...firm, scrapedContent: firm.snippet || "", keywords: [], projects: [], emails: [], scrapingSuccess: false };
      }
    };

    const BATCH_SIZE = 5;
    for (let batchStart = 0; batchStart < firms.length; batchStart += BATCH_SIZE) {
      const batch = firms.slice(batchStart, batchStart + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((firm, idx) => scrapeSingleFirm(firm, batchStart + idx))
      );
      scrapedFirms.push(...results);
      if (batchStart + BATCH_SIZE < firms.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    const successCount = scrapedFirms.filter(f => f.scrapingSuccess).length;
    logger?.info(`✅ [scrapeFirmWebsites] Complete: ${successCount}/${firms.length} scraped successfully`);

    return {
      firmsJson: JSON.stringify(scrapedFirms),
      scrapedCount: successCount,
      totalCount: firms.length,
    };
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
